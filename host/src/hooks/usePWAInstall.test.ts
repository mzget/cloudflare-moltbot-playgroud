import { describe, it, expect, vi } from 'vitest';
import { checkIsStandalone, checkIsIOS } from './usePWAInstall';

describe('usePWAInstall Unit Tests', () => {
  describe('checkIsStandalone', () => {
    it('returns false when window and navigator are null', () => {
      expect(checkIsStandalone(null, null)).toBe(false);
    });

    it('returns true when display-mode: standalone matches', () => {
      const mockWin = {
        matchMedia: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(display-mode: standalone)',
        })),
      } as unknown as Window;

      expect(checkIsStandalone(mockWin, null)).toBe(true);
    });

    it('returns true when navigator.standalone is true (iOS Home Screen)', () => {
      const mockWin = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      } as unknown as Window;
      const mockNav = { standalone: true } as unknown as Navigator;

      expect(checkIsStandalone(mockWin, mockNav)).toBe(true);
    });

    it('returns false in a standard browser tab', () => {
      const mockWin = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      } as unknown as Window;
      const mockNav = { standalone: false } as unknown as Navigator;

      expect(checkIsStandalone(mockWin, mockNav)).toBe(false);
    });
  });

  describe('checkIsIOS', () => {
    it('returns false when navigator is null', () => {
      expect(checkIsIOS(null)).toBe(false);
    });

    it('identifies iPhone user agent', () => {
      const mockNav = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)',
        platform: 'iPhone',
      } as unknown as Navigator;

      expect(checkIsIOS(mockNav)).toBe(true);
    });

    it('identifies iPad user agent', () => {
      const mockNav = {
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)',
        platform: 'iPad',
      } as unknown as Navigator;

      expect(checkIsIOS(mockNav)).toBe(true);
    });

    it('identifies modern iPadOS (MacIntel with touch points)', () => {
      const mockNav = {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      } as unknown as Navigator;

      expect(checkIsIOS(mockNav)).toBe(true);
    });

    it('returns false for Android or Windows Desktop', () => {
      const mockNav = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        platform: 'Win32',
        maxTouchPoints: 0,
      } as unknown as Navigator;

      expect(checkIsIOS(mockNav)).toBe(false);
    });
  });
});
