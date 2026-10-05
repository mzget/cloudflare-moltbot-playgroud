import { describe, it, expect } from 'vitest';
import { extractMcpToken, validateMcpToken } from './auth';

describe('MCP Authentication (auth.ts)', () => {
  const EXPECTED_SECRET = 'ot_mcp_test_secret_key_12345';

  describe('extractMcpToken', () => {
    it('should extract token from Authorization Bearer header', () => {
      const request = new Request('https://example.com/mcp', {
        headers: {
          Authorization: `Bearer ${EXPECTED_SECRET}`,
        },
      });
      expect(extractMcpToken(request)).toBe(EXPECTED_SECRET);
    });

    it('should extract token from URL search param "token"', () => {
      const request = new Request(`https://example.com/mcp?token=${EXPECTED_SECRET}`);
      expect(extractMcpToken(request)).toBe(EXPECTED_SECRET);
    });

    it('should extract token from URL search param "key"', () => {
      const request = new Request(`https://example.com/mcp?key=${EXPECTED_SECRET}`);
      expect(extractMcpToken(request)).toBe(EXPECTED_SECRET);
    });

    it('should prioritize Authorization header over search param if both exist', () => {
      const request = new Request('https://example.com/mcp?token=param_token', {
        headers: {
          Authorization: `Bearer ${EXPECTED_SECRET}`,
        },
      });
      expect(extractMcpToken(request)).toBe(EXPECTED_SECRET);
    });

    it('should trim surrounding whitespace from extracted token', () => {
      const request = new Request('https://example.com/mcp?token=  token_with_spaces  ');
      expect(extractMcpToken(request)).toBe('token_with_spaces');
    });

    it('should return null when neither header nor param is provided', () => {
      const request = new Request('https://example.com/mcp');
      expect(extractMcpToken(request)).toBeNull();
    });

    it('should return null when Authorization header does not use Bearer format', () => {
      const request = new Request('https://example.com/mcp', {
        headers: {
          Authorization: 'Basic dXNlcjpwYXNz',
        },
      });
      expect(extractMcpToken(request)).toBeNull();
    });

    it('should return null when token parameter is empty', () => {
      const request = new Request('https://example.com/mcp?token=   ');
      expect(extractMcpToken(request)).toBeNull();
    });
  });

  describe('validateMcpToken', () => {
    it('should validate successfully when token matches expected secret', () => {
      const request = new Request(`https://example.com/mcp?token=${EXPECTED_SECRET}`);
      const result = validateMcpToken(request, EXPECTED_SECRET);
      expect(result.isValid).toBe(true);
      expect(result.token).toBe(EXPECTED_SECRET);
      expect(result.reason).toBeUndefined();
    });

    it('should reject when expectedSecret is empty or undefined', () => {
      const request = new Request(`https://example.com/mcp?token=${EXPECTED_SECRET}`);
      const resultEmpty = validateMcpToken(request, '');
      expect(resultEmpty.isValid).toBe(false);
      expect(resultEmpty.reason).toBe('missing_secret');

      const resultUndefined = validateMcpToken(request, undefined);
      expect(resultUndefined.isValid).toBe(false);
      expect(resultUndefined.reason).toBe('missing_secret');
    });

    it('should reject when request has no token', () => {
      const request = new Request('https://example.com/mcp');
      const result = validateMcpToken(request, EXPECTED_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.token).toBeNull();
      expect(result.reason).toBe('missing_token');
    });

    it('should reject when token is incorrect', () => {
      const request = new Request('https://example.com/mcp?token=wrong_secret');
      const result = validateMcpToken(request, EXPECTED_SECRET);
      expect(result.isValid).toBe(false);
      expect(result.token).toBe('wrong_secret');
      expect(result.reason).toBe('invalid_token');
    });
  });
});
