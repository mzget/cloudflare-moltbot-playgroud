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
 * Validates the extracted token against the expected secret string.
 */
export function validateMcpToken(
  request: Request,
  expectedSecret?: string
): TokenValidationResult {
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

  if (token !== expectedSecret.trim()) {
    return {
      isValid: false,
      token,
      reason: 'invalid_token',
    };
  }

  return {
    isValid: true,
    token,
  };
}
