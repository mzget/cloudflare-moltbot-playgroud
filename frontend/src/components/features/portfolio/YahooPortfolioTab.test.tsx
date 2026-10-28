import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import YahooPortfolio from './YahooPortfolio';

let mockSearch: any = {};
const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => mockSearch,
  useNavigate: () => mockNavigate,
}));

vi.mock('./hooks/usePortfolio', () => ({
  usePortfolio: () => ({
    holdings: [{ symbol: 'AAPL', shares: 10, price: 150, current_price: 155, status: 'Open' }],
    summary: { total_market_value: 1550, total_cost: 1500, cash: 500, day_change_amt: 50, day_change_pct: 3.3 },
    loading: false,
    watchlist: [],
    fetchAll: vi.fn(),
  }),
}));

vi.mock('./HoldingsTab', () => ({
  default: () => <div data-testid="mock-holdings-tab">Mock Holdings Tab</div>,
}));

vi.mock('./SummaryTab', () => ({
  default: () => <div data-testid="mock-summary-tab">Mock Summary Tab</div>,
}));

vi.mock('./RiskSizingTab', () => ({
  default: () => <div data-testid="mock-risk-sizing-tab">Mock Risk Sizing Tab</div>,
}));

vi.mock('../error/NotFoundPage', () => ({
  default: () => <div data-testid="mock-not-found-page">404 Not Found Page</div>,
}));

describe('YahooPortfolio Dashboard Tab & 404 Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch = {};
  });

  it('defaults to Holdings tab when no tab parameter is passed', () => {
    mockSearch = {};
    const html = renderToString(<YahooPortfolio />);

    expect(html).toContain('Holdings');
    expect(html).toContain('Summary');
    expect(html).toContain('Risk &amp; Sizing');
    // Fundamentals must NOT be in Dashboard tabs anymore
    expect(html).not.toContain('Fundamentals');

    expect(html).toContain('Mock Holdings Tab');
    expect(html).not.toContain('Mock Summary Tab');
    expect(html).not.toContain('Mock Risk Sizing Tab');
  });

  it('renders Summary tab when tab=summary is passed', () => {
    mockSearch = { tab: 'summary' };
    const html = renderToString(<YahooPortfolio />);

    expect(html).toContain('Mock Summary Tab');
    expect(html).not.toContain('Mock Holdings Tab');
  });

  it('renders Risk & Sizing tab when tab=risk is passed', () => {
    mockSearch = { tab: 'risk' };
    const html = renderToString(<YahooPortfolio />);

    expect(html).toContain('Mock Risk Sizing Tab');
    expect(html).not.toContain('Mock Holdings Tab');
  });

  it('renders 404 NotFoundPage when tab=fundamentals is requested on Dashboard', () => {
    mockSearch = { tab: 'fundamentals' };
    const html = renderToString(<YahooPortfolio />);

    expect(html).toContain('404 Not Found Page');
    expect(html).not.toContain('Mock Holdings Tab');
    expect(html).not.toContain('Mock Summary Tab');
  });

  it('renders 404 NotFoundPage when an unknown tab is requested on Dashboard', () => {
    mockSearch = { tab: 'invalid-tab-xyz' };
    const html = renderToString(<YahooPortfolio />);

    expect(html).toContain('404 Not Found Page');
    expect(html).not.toContain('Mock Holdings Tab');
  });
});
