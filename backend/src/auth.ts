// backend/src/auth.ts

// AES-GCM encryption helper
export async function encryptToken(text: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret.padEnd(32, "0").slice(0, 32)), // Ensure 256-bit key
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    enc.encode(text)
  );
  
  const buffer = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + buffer.length);
  combined.set(iv);
  combined.set(buffer, iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// AES-GCM decryption helper
export async function decryptToken(encryptedBase64: string, secret: string): Promise<string> {
  const enc = new TextDecoder();
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    data
  );
  return enc.decode(decrypted);
}

// Custom Base64Url encoder/decoder for Web Crypto compatibility and UTF-8 safety
export function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binString = atob(base64);
  const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
  return new TextDecoder().decode(bytes);
}

/**
 * Signs a payload to generate an HMAC-SHA256 JWT.
 */
export async function signJwt(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  
  const encoder = new TextEncoder();
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
    
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies an HMAC-SHA256 JWT and returns the parsed payload if valid.
 */
export async function verifyJwt(token: string, secret: string): Promise<any | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Decode signature from base64url
    const signatureBytes = new Uint8Array(
      atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(c => c.charCodeAt(0))
    );
    
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);
    if (!isValid) return null;
    
    // Decode payload
    const payloadStr = base64urlDecode(encodedPayload);
    const payload = JSON.parse(payloadStr);
    
    // Check expiration (exp is in seconds)
    if (payload.exp && Date.now() > payload.exp * 1000) {
      return null;
    }
    
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch Google User Info using the Google Access Token.
 */
export async function fetchGoogleUserProfile(accessToken: string): Promise<{ email: string; name: string; picture: string }> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch Google profile: ${response.statusText} - ${errText}`);
  }

  const profile = await response.json() as any;
  return {
    email: profile.email || '',
    name: profile.name || '',
    picture: profile.picture || '',
  };
}

/**
 * Verifies if an email is authorized to access the system.
 */
export function isEmailAuthorized(email: string, allowedEmailsConfig?: string): boolean {
  if (!allowedEmailsConfig || allowedEmailsConfig.trim() === '') {
    return true;
  }
  
  const allowedEmails = allowedEmailsConfig
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
    
  return allowedEmails.includes(email.toLowerCase());
}

/**
 * Extract and check authorization headers.
 */
export async function checkAuth(request: Request, secret: string): Promise<any | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  return await verifyJwt(token, secret);
}

/**
 * Generates the Google OAuth login URL for the user.
 */
export function getUserLoginAuthUrl(clientId: string, redirectUri: string): string {
  const scopes = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state: 'user-login',
    prompt: 'select_account'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
