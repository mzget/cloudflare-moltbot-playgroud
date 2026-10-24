import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import DCFModel from './DCFModel';

describe('DCFModel Component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }));
  });

  it('renders interactive DCF model header with ticker symbol', () => {
    const html = renderToString(<DCFModel symbol="AAPL" />);
    expect(html).toContain('Interactive DCF Valuation Model');
    expect(html).toContain('AAPL');
  });

  it('renders preset scenario buttons (Bear, Base, Bull)', () => {
    const html = renderToString(<DCFModel symbol="AAPL" />);
    expect(html).toContain('Bear Case');
    expect(html).toContain('Base Case');
    expect(html).toContain('Bull Case');
  });

  it('renders key output cards and projection metrics', () => {
    const html = renderToString(<DCFModel symbol="AAPL" />);
    expect(html).toContain('Intrinsic Value Today');
    expect(html).toContain('Target Price FY');
    expect(html).toContain('Enterprise Value (EV)');
    expect(html).toContain('Model Configuration Mode');
  });
});
