import { withCors } from "./http";

function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binString = atob(base64);
  const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
  return new TextDecoder().decode(bytes);
}

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

    const signatureBytes = new Uint8Array(
      atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(c => c.charCodeAt(0))
    );

    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);
    if (!isValid) return null;

    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (payload.exp && Date.now() > payload.exp * 1000) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

export async function authenticateRequest(request: Request, env: any): Promise<{ email: string } | Response> {
  if (env.IS_LOCAL === 'true') {
    return { email: 'local@example.com' };
  }

  const url = new URL(request.url);
  let token = url.searchParams.get("token");

  if (!token) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return new Response("Unauthorized: Missing or invalid token format", { status: 401 });
  }

  const jwtSecret = env.JWT_SECRET || 'dev-secret-key-123456';

  const payload = await verifyJwt(token, jwtSecret);
  if (!payload || !payload.email) {
    return new Response("Unauthorized: Invalid or expired token", { status: 401 });
  }

  return { email: payload.email };
}

/** Authenticate; on failure return the 401 response with the CORS origin applied. */
export async function requireAuth(
  request: Request,
  env: any,
  allowedOrigin: string
): Promise<{ email: string } | Response> {
  const auth = await authenticateRequest(request, env);
  return auth instanceof Response ? withCors(auth, allowedOrigin) : auth;
}

