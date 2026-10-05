/**
 * OAuth 2.0 / 2.1 Provider for Model Context Protocol (MCP)
 * Conforms to RFC 8414 (Authorization Server Metadata) and RFC 9728 (Protected Resource Metadata).
 */

export interface AuthCodePayload {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly codeChallenge?: string;
  readonly codeChallengeMethod?: string;
  readonly exp: number;
}

export interface AccessTokenPayload {
  readonly sub: string; // Client ID
  readonly exp: number;
  readonly scope: string;
}

export interface OAuthMetadata {
  readonly resource: string;
  readonly authorizationServers: string[];
}

export interface ClientCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

/**
 * Base64URL string helpers using Web Crypto / standard encoding
 */
export function base64UrlEncode(data: Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else {
    bytes = data;
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Sign data string with HMAC-SHA256
 */
export async function signHmacSha256(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Verify HMAC-SHA256 signature
 */
export async function verifyHmacSha256(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const expectedSig = await signHmacSha256(data, secret);
    return expectedSig === signature;
  } catch {
    return false;
  }
}

/**
 * Compute SHA-256 base64url hash (for PKCE S256 verification)
 */
export async function computeSha256Base64Url(input: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * RFC 9728: OAuth 2.0 Protected Resource Metadata
 */
export function getProtectedResourceMetadata(baseUrl: string) {
  return {
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    scopes_supported: ['mcp'],
    bearer_methods_supported: ['header'],
  };
}

/**
 * RFC 8414: OAuth 2.0 Authorization Server Metadata
 */
export function getAuthorizationServerMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
  };
}

/**
 * Generate HMAC-signed Authorization Code (valid for 10 minutes)
 */
export async function createAuthCode(
  payload: Omit<AuthCodePayload, 'exp'>,
  secret: string,
  ttlMs = 10 * 60 * 1000
): Promise<string> {
  const fullPayload: AuthCodePayload = {
    ...payload,
    exp: Date.now() + ttlMs,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = await signHmacSha256(encodedPayload, secret);
  return `otc_${encodedPayload}.${signature}`;
}

/**
 * Verify Authorization Code
 */
export async function verifyAuthCode(
  code: string,
  secret: string
): Promise<AuthCodePayload | null> {
  if (!code.startsWith('otc_')) return null;
  const raw = code.substring(4);
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  const isValid = await verifyHmacSha256(encodedPayload, signature, secret);
  if (!isValid) return null;

  try {
    const payloadStr = new TextDecoder().decode(base64UrlDecode(encodedPayload));
    const payload: AuthCodePayload = JSON.parse(payloadStr);
    if (Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate HMAC-signed Access Token (valid for 30 days)
 */
export async function createAccessToken(
  clientId: string,
  secret: string,
  ttlSeconds = 30 * 24 * 3600
): Promise<string> {
  const payload: AccessTokenPayload = {
    sub: clientId,
    exp: Date.now() + ttlSeconds * 1000,
    scope: 'mcp',
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signHmacSha256(encodedPayload, secret);
  return `ota_${encodedPayload}.${signature}`;
}

/**
 * Verify Access Token
 */
export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<AccessTokenPayload | null> {
  if (!token.startsWith('ota_')) return null;
  const raw = token.substring(4);
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  const isValid = await verifyHmacSha256(encodedPayload, signature, secret);
  if (!isValid) return null;

  try {
    const payloadStr = new TextDecoder().decode(base64UrlDecode(encodedPayload));
    const payload: AccessTokenPayload = JSON.parse(payloadStr);
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Helper to extract Client Credentials from either:
 * 1. Authorization: Basic base64(client_id:client_secret)
 * 2. Request body params (client_id, client_secret)
 */
export function extractClientCredentials(
  request: Request,
  bodyParams: Record<string, string>
): ClientCredentials | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.substring(6).trim());
      const colonIndex = decoded.indexOf(':');
      if (colonIndex !== -1) {
        return {
          clientId: decoded.substring(0, colonIndex),
          clientSecret: decoded.substring(colonIndex + 1),
        };
      }
    } catch {
      // Fallback to body
    }
  }

  if (bodyParams.client_id && bodyParams.client_secret) {
    return {
      clientId: bodyParams.client_id.trim(),
      clientSecret: bodyParams.client_secret.trim(),
    };
  }

  return null;
}

/**
 * Validates redirect URI to ensure it belongs to Google OAuth redirect or allowed patterns
 */
export function isAllowedRedirectUri(redirectUri: string): boolean {
  try {
    const parsed = new URL(redirectUri);
    // Allow googleusercontent oauth redirect
    if (parsed.hostname.endsWith('.googleusercontent.com')) {
      return true;
    }
    // Allow local development redirect
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Renders HTML consent page for GET /oauth/authorize
 */
export function renderAuthorizeHtml(params: {
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}): string {
  const { clientId, redirectUri, state = '', codeChallenge = '', codeChallengeMethod = '' } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Oaktree MCP</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
      box-sizing: border-box;
    }
    .card {
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(12px);
      border-radius: 1rem;
      max-width: 440px;
      width: 100%;
      padding: 2rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .logo {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }
    h1 {
      font-size: 1.35rem;
      margin: 0 0 0.5rem 0;
      color: #38bdf8;
    }
    p {
      font-size: 0.95rem;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0 0 1.5rem 0;
    }
    .badge {
      display: inline-block;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-family: monospace;
      margin-bottom: 1.25rem;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 0.85rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 0.5rem;
      border: none;
      cursor: pointer;
      transition: background 0.2s;
      box-sizing: border-box;
    }
    .btn-primary {
      background: #0284c7;
      color: white;
      margin-bottom: 0.75rem;
    }
    .btn-primary:hover {
      background: #0369a1;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🌳</div>
    <h1>Authorize Oaktree MCP</h1>
    <div class="badge">Client: ${clientId}</div>
    <p>Google Gemini Spark is requesting access to Oaktree Value Investing MCP tools (Portfolio, Knowledge base, Deep analysis reports).</p>
    
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${clientId}">
      <input type="hidden" name="redirect_uri" value="${redirectUri}">
      <input type="hidden" name="state" value="${state}">
      <input type="hidden" name="code_challenge" value="${codeChallenge}">
      <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod}">
      <button type="submit" class="btn btn-primary">Authorize & Connect</button>
    </form>
  </div>
</body>
</html>`;
}
