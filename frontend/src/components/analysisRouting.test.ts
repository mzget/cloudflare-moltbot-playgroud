import { describe, it, expect } from 'vitest';
import { analysisSearchSchema } from './App';

describe('analysisSearchSchema - Tab Routing & Direct URL Handling', () => {
  it('defaults to dossier (Cockpit) when tab parameter is omitted', () => {
    const result = analysisSearchSchema.parse({ symbol: 'NVDA' });
    expect(result).toEqual({ symbol: 'NVDA', tab: 'dossier' });
  });

  it('defaults to dossier (Cockpit) when both symbol and tab are omitted', () => {
    const result = analysisSearchSchema.parse({});
    expect(result).toEqual({ symbol: undefined, tab: 'dossier' });
  });

  it('preserves explicit tab=report from direct URL', () => {
    const result = analysisSearchSchema.parse({ symbol: 'AAPL', tab: 'report' });
    expect(result).toEqual({ symbol: 'AAPL', tab: 'report' });
  });

  it('preserves explicit tab=overview from direct URL', () => {
    const result = analysisSearchSchema.parse({ symbol: 'MSFT', tab: 'overview' });
    expect(result).toEqual({ symbol: 'MSFT', tab: 'overview' });
  });

  it('preserves explicit tab=dcf-model from direct URL', () => {
    const result = analysisSearchSchema.parse({ symbol: 'GOOGL', tab: 'dcf-model' });
    expect(result).toEqual({ symbol: 'GOOGL', tab: 'dcf-model' });
  });

  it('preserves explicit tab=stock-thesis from direct URL', () => {
    const result = analysisSearchSchema.parse({ symbol: 'AMZN', tab: 'stock-thesis' });
    expect(result).toEqual({ symbol: 'AMZN', tab: 'stock-thesis' });
  });

  it('preserves explicit tab=dossier from direct URL', () => {
    const result = analysisSearchSchema.parse({ symbol: 'META', tab: 'dossier' });
    expect(result).toEqual({ symbol: 'META', tab: 'dossier' });
  });

  it('falls back to dossier (Cockpit) when an invalid tab is passed', () => {
    const result = analysisSearchSchema.parse({ symbol: 'TSLA', tab: 'invalid-tab' as any });
    expect(result).toEqual({ symbol: 'TSLA', tab: 'dossier' });
  });
});
