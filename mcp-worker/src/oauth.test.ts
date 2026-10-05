import { describe, it, expect } from 'vitest';
import {
  base64UrlEncode,
  base64UrlDecode,
  signHmacSha256,
  verifyHmacSha256,
  computeSha256Base64Url,
  getProtectedResourceMetadata,
  getAuthorizationServerMetadata,
  createAuthCode,
  verifyAuthCode,
  createAccessToken,
  verifyAccessToken,
  extractClientCredentials,
  isAllowedRedirectUri,
  renderAuthorizeHtml,
} from './oauth';

describe('OAuth 2.0 Provider (oauth.ts)', () => {
  const SECRET = 'ot_mcp_test_secret_key_12345';
  const BASE_URL = 'https://oaktree-mcp.nattapon-r.workers.dev';

  describe('Base64URL and Crypto Helpers', () => {
    it('should correctly encode and decode text using base64url', () => {
      const testString = 'Hello, Oaktree & Gemini! 🌲✨';
      const encoded = base64UrlEncode(testString);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');

      const decodedBytes = base64UrlDecode(encoded);
      const decodedString = new TextDecoder().decode(decodedBytes);
      expect(decodedString).toBe(testString);
    });

    it('should sign and verify data using HMAC-SHA256', async () => {
      const data = 'payload_to_verify_123';
      const sig = await signHmacSha256(data, SECRET);
      expect(sig.length).toBeGreaterThan(10);

      const isValid = await verifyHmacSha256(data, sig, SECRET);
      expect(isValid).toBe(true);

      const isInvalidData = await verifyHmacSha256('tampered_payload', sig, SECRET);
      expect(isInvalidData).toBe(false);

      const isInvalidSecret = await verifyHmacSha256(data, sig, 'wrong_secret');
      expect(isInvalidSecret).toBe(false);
    });

    it('should compute SHA-256 base64url hash for PKCE', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await computeSha256Base64Url(verifier);
      expect(challenge).toBeTruthy();
      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
    });
  });

  describe('Metadata Discovery (RFC 9728 & RFC 8414)', () => {
    it('should generate valid RFC 9728 Protected Resource Metadata', () => {
      const metadata = getProtectedResourceMetadata(BASE_URL);
      expect(metadata.resource).toBe(`${BASE_URL}/mcp`);
      expect(metadata.authorization_servers).toEqual([BASE_URL]);
      expect(metadata.scopes_supported).toContain('mcp');
      expect(metadata.bearer_methods_supported).toContain('header');
    });

    it('should generate valid RFC 8414 Authorization Server Metadata', () => {
      const metadata = getAuthorizationServerMetadata(BASE_URL);
      expect(metadata.issuer).toBe(BASE_URL);
      expect(metadata.authorization_endpoint).toBe(`${BASE_URL}/oauth/authorize`);
      expect(metadata.token_endpoint).toBe(`${BASE_URL}/oauth/token`);
      expect(metadata.response_types_supported).toContain('code');
      expect(metadata.grant_types_supported).toContain('authorization_code');
      expect(metadata.code_challenge_methods_supported).toContain('S256');
    });
  });

  describe('Authorization Code Flow', () => {
    const CLIENT_ID = 'oaktree-gemini';
    const REDIRECT_URI = 'https://oauth-redirect.googleusercontent.com/r/user_bound_custom';

    it('should generate and verify an authorization code', async () => {
      const code = await createAuthCode(
        {
          clientId: CLIENT_ID,
          redirectUri: REDIRECT_URI,
          codeChallenge: 'test_challenge_hash',
          codeChallengeMethod: 'S256',
        },
        SECRET
      );

      expect(code.startsWith('otc_')).toBe(true);

      const verified = await verifyAuthCode(code, SECRET);
      expect(verified).not.toBeNull();
      expect(verified?.clientId).toBe(CLIENT_ID);
      expect(verified?.redirectUri).toBe(REDIRECT_URI);
      expect(verified?.codeChallenge).toBe('test_challenge_hash');
    });

    it('should reject an expired authorization code', async () => {
      // Create code with negative TTL (-10 seconds)
      const expiredCode = await createAuthCode(
        {
          clientId: CLIENT_ID,
          redirectUri: REDIRECT_URI,
        },
        SECRET,
        -10000
      );

      const verified = await verifyAuthCode(expiredCode, SECRET);
      expect(verified).toBeNull();
    });

    it('should reject a tampered authorization code', async () => {
      const code = await createAuthCode(
        {
          clientId: CLIENT_ID,
          redirectUri: REDIRECT_URI,
        },
        SECRET
      );

      const tampered = code + 'tampered';
      const verified = await verifyAuthCode(tampered, SECRET);
      expect(verified).toBeNull();
    });
  });

  describe('Access Token Flow', () => {
    const CLIENT_ID = 'oaktree-gemini';

    it('should create and verify an access token', async () => {
      const token = await createAccessToken(CLIENT_ID, SECRET);
      expect(token.startsWith('ota_')).toBe(true);

      const verified = await verifyAccessToken(token, SECRET);
      expect(verified).not.toBeNull();
      expect(verified?.sub).toBe(CLIENT_ID);
      expect(verified?.scope).toBe('mcp');
    });

    it('should reject an expired access token', async () => {
      const expiredToken = await createAccessToken(CLIENT_ID, SECRET, -60);
      const verified = await verifyAccessToken(expiredToken, SECRET);
      expect(verified).toBeNull();
    });

    it('should reject an access token signed with a different secret', async () => {
      const token = await createAccessToken(CLIENT_ID, 'other_secret');
      const verified = await verifyAccessToken(token, SECRET);
      expect(verified).toBeNull();
    });
  });

  describe('Client Credentials Extraction', () => {
    it('should extract credentials from Authorization Basic header', () => {
      const authHeader = 'Basic ' + btoa('my-client:my-secret');
      const request = new Request('https://example.com/oauth/token', {
        headers: { Authorization: authHeader },
      });

      const creds = extractClientCredentials(request, {});
      expect(creds).toEqual({
        clientId: 'my-client',
        clientSecret: 'my-secret',
      });
    });

    it('should extract credentials from body params if no Basic header', () => {
      const request = new Request('https://example.com/oauth/token');
      const creds = extractClientCredentials(request, {
        client_id: 'body-client',
        client_secret: 'body-secret',
      });
      expect(creds).toEqual({
        clientId: 'body-client',
        clientSecret: 'body-secret',
      });
    });

    it('should return null when no credentials provided', () => {
      const request = new Request('https://example.com/oauth/token');
      expect(extractClientCredentials(request, {})).toBeNull();
    });
  });

  describe('Redirect URI Validation', () => {
    it('should allow googleusercontent redirect URIs', () => {
      expect(
        isAllowedRedirectUri(
          'https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-108294695677105089532-oaktree-mcp_nattapon-r_workers_dev'
        )
      ).toBe(true);
    });

    it('should allow localhost redirect URIs for dev', () => {
      expect(isAllowedRedirectUri('http://localhost:3000/callback')).toBe(true);
    });

    it('should reject untrusted or invalid redirect URIs', () => {
      expect(isAllowedRedirectUri('https://malicious-site.com/callback')).toBe(false);
      expect(isAllowedRedirectUri('not-a-valid-url')).toBe(false);
    });
  });

  describe('HTML Consent Rendering', () => {
    it('should render HTML with client_id and redirect_uri', () => {
      const html = renderAuthorizeHtml({
        clientId: 'oaktree-gemini',
        redirectUri: 'https://oauth-redirect.googleusercontent.com/r/test',
        state: 'xyz_state',
      });
      expect(html).toContain('Authorize Oaktree MCP');
      expect(html).toContain('Client: oaktree-gemini');
      expect(html).toContain('value="xyz_state"');
      expect(html).toContain('value="https://oauth-redirect.googleusercontent.com/r/test"');
    });
  });
});
