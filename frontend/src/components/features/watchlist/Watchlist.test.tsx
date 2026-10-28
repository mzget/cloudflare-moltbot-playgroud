import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import Watchlist from './Watchlist';

let mockSearch: any = {};
const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => mockSearch,
  useNavigate: () => mockNavigate,
}));

vi.mock('./MyWatchlist', () => ({
  default: () => <div data-testid="mock-my-watchlist">Mock My Watchlist Component</div>,
}));

vi.mock('./MarketBreakouts', () => ({
  default: () => <div data-testid="mock-market-breakouts">Mock Market Breakouts Component</div>,
}));

vi.mock('../portfolio/FundamentalDashboard', () => ({
  default: () => <div data-testid="mock-fundamental-dashboard">Mock Fundamental Dashboard Component</div>,
}));

vi.mock('../error/NotFoundPage', () => ({
  default: () => <div data-testid="mock-not-found-page">404 Not Found Page</div>,
}));

describe('Watchlist Component Tabs & 404 Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch = {};
  });

  it('renders default sub-tab "My Watchlist" when no tab parameter is specified', () => {
    mockSearch = {};
    const html = renderToString(<Watchlist />);

    expect(html).toContain('Investment Watchlist');
    expect(html).toContain('My Watchlist');
    expect(html).toContain('Fundamentals');
    expect(html).toContain('Watchlist Breakouts');

    expect(html).toContain('Mock My Watchlist Component');
    expect(html).not.toContain('Mock Fundamental Dashboard Component');
    expect(html).not.toContain('Mock Market Breakouts Component');
  });

  it('renders "Fundamentals" when tab=fundamentals is provided', () => {
    mockSearch = { tab: 'fundamentals' };
    const html = renderToString(<Watchlist />);

    expect(html).toContain('Mock Fundamental Dashboard Component');
    expect(html).not.toContain('Mock My Watchlist Component');
    expect(html).not.toContain('Mock Market Breakouts Component');
  });

  it('renders "Watchlist Breakouts" when tab=market-breakouts is provided', () => {
    mockSearch = { tab: 'market-breakouts' };
    const html = renderToString(<Watchlist />);

    expect(html).toContain('Mock Market Breakouts Component');
    expect(html).not.toContain('Mock My Watchlist Component');
    expect(html).not.toContain('Mock Fundamental Dashboard Component');
  });

  it('renders 404 NotFoundPage when an invalid tab query parameter is provided', () => {
    mockSearch = { tab: 'unknown-tab' };
    const html = renderToString(<Watchlist />);

    expect(html).toContain('404 Not Found Page');
    expect(html).not.toContain('Mock My Watchlist Component');
    expect(html).not.toContain('Mock Fundamental Dashboard Component');
  });
});
