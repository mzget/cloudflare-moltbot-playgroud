import { vi, describe, it, expect, beforeEach } from 'vitest';
import { checkAlertRules } from './alerts';

describe('checkAlertRules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return 0 when no active rules exist', async () => {
    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      })),
      batch: vi.fn().mockResolvedValue([]),
    };

    const env = { DB: mockDb as any };
    const res = await checkAlertRules(env as any);
    expect(res.triggeredCount).toBe(0);
    expect(res.errors).toHaveLength(0);
  });

  it('should trigger alert when price crosses up target and lastState was below', async () => {
    const activeRules = [
      {
        id: 1,
        symbol: 'AAPL',
        metric: 'price',
        condition_type: 'cross_up',
        target_value: 150,
        last_checked_value: 145,
        last_checked_state: 'below',
        is_active: 1,
        note: 'Breakout above 150',
      },
    ];

    const marketStats = [
      {
        symbol: 'AAPL',
        price: 155,
        market_cap: 2500000,
        p_e: 28,
        ev_ebit: 22,
        ev_sales: 7,
      },
    ];

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockImplementation(async () => {
          if (sql.includes('FROM alert_rules')) {
            return { results: activeRules };
          }
          if (sql.includes('FROM market_stats')) {
            return { results: marketStats };
          }
          return { results: [] };
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
      })),
      batch: vi.fn().mockResolvedValue([]),
    };

    const env = { DB: mockDb as any };
    const res = await checkAlertRules(env as any);

    expect(res.triggeredCount).toBe(1);
    expect(mockDb.batch).toHaveBeenCalledTimes(1);
  });

  it('should trigger alert when price crosses down target and lastState was above', async () => {
    const activeRules = [
      {
        id: 2,
        symbol: 'TSLA',
        metric: 'price',
        condition_type: 'cross_down',
        target_value: 200,
        last_checked_value: 210,
        last_checked_state: 'above',
        is_active: 1,
        note: 'Stop loss trigger',
      },
    ];

    const marketStats = [
      {
        symbol: 'TSLA',
        price: 195,
        market_cap: 600000,
        p_e: 45,
        ev_ebit: 35,
        ev_sales: 6,
      },
    ];

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockImplementation(async () => {
          if (sql.includes('FROM alert_rules')) {
            return { results: activeRules };
          }
          if (sql.includes('FROM market_stats')) {
            return { results: marketStats };
          }
          return { results: [] };
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
      })),
      batch: vi.fn().mockResolvedValue([]),
    };

    const env = { DB: mockDb as any };
    const res = await checkAlertRules(env as any);

    expect(res.triggeredCount).toBe(1);
  });

  it('should initialize state on first check without triggering alert', async () => {
    const activeRules = [
      {
        id: 3,
        symbol: 'NVDA',
        metric: 'price',
        condition_type: 'cross_up',
        target_value: 120,
        last_checked_value: null,
        last_checked_state: null,
        is_active: 1,
      },
    ];

    const marketStats = [
      {
        symbol: 'NVDA',
        price: 125,
        market_cap: 3000000,
        p_e: 50,
        ev_ebit: 40,
        ev_sales: 20,
      },
    ];

    const mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockImplementation(async () => {
          if (sql.includes('FROM alert_rules')) {
            return { results: activeRules };
          }
          if (sql.includes('FROM market_stats')) {
            return { results: marketStats };
          }
          return { results: [] };
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
      })),
      batch: vi.fn().mockResolvedValue([]),
    };

    const env = { DB: mockDb as any };
    const res = await checkAlertRules(env as any);

    expect(res.triggeredCount).toBe(0);
    expect(mockDb.batch).toHaveBeenCalledTimes(1);
  });
});
