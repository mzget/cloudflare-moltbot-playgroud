import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPct } from './YahooPortfolio';

describe('YahooPortfolio formatting utilities', () => {
  describe('formatCurrency', () => {
    it('should format null/undefined as double dashes', () => {
      expect(formatCurrency(null)).toBe('--');
      expect(formatCurrency(undefined)).toBe('--');
    });

    it('should format positive currency value with plus sign', () => {
      expect(formatCurrency(1234.56)).toBe('+$1,234.56');
    });

    it('should format negative currency value (strips sign by default)', () => {
      expect(formatCurrency(-1234.56)).toBe('$1,234.56');
    });

    it('should format positive currency value without sign if showSign is false', () => {
      expect(formatCurrency(1234.56, false)).toBe('$1,234.56');
    });
  });

  describe('formatPct', () => {
    it('should format null/undefined as double dashes', () => {
      expect(formatPct(null)).toBe('--');
      expect(formatPct(undefined)).toBe('--');
    });

    it('should format positive percentage with plus sign and fixed 2 decimals', () => {
      expect(formatPct(5.678)).toBe('+5.68%');
    });

    it('should format negative percentage with negative sign and fixed 2 decimals', () => {
      expect(formatPct(-5.678)).toBe('-5.68%');
    });
  });
});
