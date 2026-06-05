import { describe, it, expect } from 'vitest';
import { sortTransactions } from './portfolioUtils';

describe('sortTransactions', () => {
  it('should sort transactions by date ascending', () => {
    const txs = [
      { id: 1, date: '2026-05-12', type: 'Buy' },
      { id: 2, date: '2026-03-04', type: 'Buy' },
      { id: 3, date: '2026-04-28', type: 'Buy' },
    ];
    const sorted = sortTransactions(txs);
    expect(sorted.map(t => t.date)).toEqual([
      '2026-03-04',
      '2026-04-28',
      '2026-05-12',
    ]);
  });

  it('should sort Buy before Sell when transactions occur on the same day', () => {
    const txs = [
      { id: 1, date: '2025-08-07', type: 'Sell', shares: 36 },
      { id: 2, date: '2025-08-07', type: 'Buy', shares: 13 },
      { id: 3, date: '2025-08-07', type: 'Buy', shares: 15 },
    ];
    const sorted = sortTransactions(txs);
    
    // Both Buys must precede the Sell transaction
    expect(sorted[0]).toEqual({ id: 2, date: '2025-08-07', type: 'Buy', shares: 13 });
    expect(sorted[1]).toEqual({ id: 3, date: '2025-08-07', type: 'Buy', shares: 15 });
    expect(sorted[2]).toEqual({ id: 1, date: '2025-08-07', type: 'Sell', shares: 36 });
  });

  it('should sort Buy before Sell on the same day regardless of input order', () => {
    const txs = [
      { id: 1, date: '2025-08-07', type: 'Buy', shares: 13 },
      { id: 2, date: '2025-08-07', type: 'Sell', shares: 36 },
      { id: 3, date: '2025-08-07', type: 'Buy', shares: 15 },
    ];
    const sorted = sortTransactions(txs);
    
    expect(sorted[0].type).toBe('Buy');
    expect(sorted[1].type).toBe('Buy');
    expect(sorted[2].type).toBe('Sell');
  });

  it('should default missing types to Buy', () => {
    const txs = [
      { id: 1, date: '2025-08-07', type: 'Sell', shares: 10 },
      { id: 2, date: '2025-08-07', shares: 10 }, // default is 'Buy'
    ];
    const sorted = sortTransactions(txs);
    expect(sorted[0].id).toBe(2);
    expect(sorted[1].id).toBe(1);
  });
});
