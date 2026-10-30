import { describe, it, expect } from 'vitest';
import { financeSearchSchema } from '../../../App';

describe('financeSearchSchema - Tab & Wallet Routing / Direct URL Handling', () => {
  it('defaults to dashboard when tab parameter is omitted', () => {
    const result = financeSearchSchema.parse({});
    expect(result).toEqual({ tab: 'dashboard', wallet: 'all' });
  });

  it('preserves valid tab=transactions and custom wallet', () => {
    const result = financeSearchSchema.parse({ tab: 'transactions', wallet: 'wal_kbank' });
    expect(result).toEqual({ tab: 'transactions', wallet: 'wal_kbank' });
  });

  it('preserves valid tab=budgets with default wallet', () => {
    const result = financeSearchSchema.parse({ tab: 'budgets' });
    expect(result).toEqual({ tab: 'budgets', wallet: 'all' });
  });

  it('preserves valid tab=wallets', () => {
    const result = financeSearchSchema.parse({ tab: 'wallets', wallet: 'all' });
    expect(result).toEqual({ tab: 'wallets', wallet: 'all' });
  });

  it('sanitizes invalid tab to dashboard', () => {
    const result = financeSearchSchema.parse({ tab: 'invalid-tab' as any });
    expect(result.tab).toBe('dashboard');
  });

  it('sanitizes script injection in tab to dashboard', () => {
    const result = financeSearchSchema.parse({ tab: '<script>alert(1)</script>' as any });
    expect(result.tab).toBe('dashboard');
  });

  it('handles empty query string params ?tab=&wallet= with canonical defaults', () => {
    const result = financeSearchSchema.parse({ tab: '' as any, wallet: '' });
    expect(result).toEqual({ tab: 'dashboard', wallet: 'all' });
  });

  it('safely parses SQL injection strings in wallet without crashing', () => {
    const result = financeSearchSchema.parse({ wallet: "' OR '1'='1" });
    expect(result.wallet).toBe("' OR '1'='1");
  });
});

