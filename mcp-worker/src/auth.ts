import { verifyAccessToken } from './oauth';

/**
 * MCP Authentication Utility
 * Extracts and verifies access tokens from HTTP requests for Gemini Spark and external MCP clients.
 */

export interface TokenValidationResult {
  readonly isValid: boolean;
  readonly token: string | null;
  readonly reason?: 'missing_secret' | 'missing_token' | 'invalid_token';
}

/**
 * Extracts MCP access token from either:
 * 1. Authorization header ("Bearer <token>")
 * 2. URL search parameters ("?token=<token>" or "?key=<token>")
 */
export function extractMcpToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const headerToken = authHeader.substring(7).trim();
    if (headerToken.length > 0) {
      return headerToken;
    }
  }

  try {
    const url = new URL(request.url);
    const queryToken = url.searchParams.get('token') || url.searchParams.get('key');
    if (queryToken && queryToken.trim().length > 0) {
      return queryToken.trim();
    }
  } catch {
    // If URL parsing fails, return null
  }

  return null;
}

/**
 * Validates the extracted token against the expected secret string
 * or as an HMAC-signed OAuth access token.
 */
export async function validateMcpToken(
  request: Request,
  expectedSecret?: string
): Promise<TokenValidationResult> {
  if (!expectedSecret || expectedSecret.trim().length === 0) {
    return {
      isValid: false,
      token: null,
      reason: 'missing_secret',
    };
  }

  const token = extractMcpToken(request);
  if (!token) {
    return {
      isValid: false,
      token: null,
      reason: 'missing_token',
    };
  }

  const trimmedSecret = expectedSecret.trim();

  // 1. Direct static secret match (Bearer or query token)
  if (token === trimmedSecret) {
    return {
      isValid: true,
      token,
    };
  }

  // 2. OAuth access token verification (signed with expectedSecret)
  if (token.startsWith('ota_')) {
    const verified = await verifyAccessToken(token, trimmedSecret);
    if (verified) {
      return {
        isValid: true,
        token,
      };
    }
  }

  return {
    isValid: false,
    token,
    reason: 'invalid_token',
  };
}
