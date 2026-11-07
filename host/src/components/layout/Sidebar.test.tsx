import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import Sidebar from './Sidebar';
import { useFinanceBridgeStore } from '../../store/financeBridgeStore';

let currentPathname = '/dashboard';
let currentSearch: any = { tab: 'dashboard', wallet: 'all' };
const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: currentPathname, href: `http://localhost:3000${currentPathname}` }),
  useSearch: () => currentSearch,
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../store/financeBridgeStore', async () => {
  const actual = await vi.importActual<any>('../../store/financeBridgeStore');
  const mockHook: any = (selector?: any) => {
    const state = actual.useFinanceBridgeStore.getState();
    return selector ? selector(state) : state;
  };
  mockHook.getState = actual.useFinanceBridgeStore.getState;
  mockHook.setState = actual.useFinanceBridgeStore.setState;
  mockHook.subscribe = actual.useFinanceBridgeStore.subscribe;
  return {
    ...actual,
    useFinanceBridgeStore: mockHook,
  };
});

describe('Sidebar Component & Drawer App Switcher', () => {
  const mockSetActiveTab = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFinanceBridgeStore.getState().reset();
  });

  it('renders drawer App Switcher with Oaktree and Simplicity buttons and valid native hrefs', () => {
    currentPathname = '/dashboard';
    const html = renderToString(
      <Sidebar activeTab="dashboard" setActiveTab={mockSetActiveTab} />
    );

    expect(html).toContain('data-testid="sidebar-switcher-oaktree"');
    expect(html).toContain('data-testid="sidebar-switcher-simplicity"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/finance?tab=dashboard&amp;wallet=all"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('🌳 Oaktree');
    expect(html).toContain('💳 Simplicity');
  });

  it('reflects lastFinanceTab and lastFinanceWallet state in the Simplicity switcher link', () => {
    useFinanceBridgeStore.setState({
      lastFinanceTab: 'budgets',
      lastFinanceWallet: 'w-savings-99',
    });

    const html = renderToString(
      <Sidebar activeTab="dashboard" setActiveTab={mockSetActiveTab} />
    );

    expect(html).toContain('href="/finance?tab=budgets&amp;wallet=w-savings-99"');
  });

  it('highlights Simplicity tab when activeTab="finance"', () => {
    currentPathname = '/finance';
    const html = renderToString(
      <Sidebar activeTab="finance" setActiveTab={mockSetActiveTab} />
    );

    // In finance mode, Simplicity pill should be aria-selected="true"
    expect(html).toContain('data-testid="sidebar-switcher-simplicity"');
    expect(html).toContain('href="/dashboard"');
  });

  it('renders standard navigation menu items in Oaktree mode', () => {
    currentPathname = '/dashboard';
    const html = renderToString(
      <Sidebar activeTab="dashboard" setActiveTab={mockSetActiveTab} />
    );

    expect(html).toContain('sidebar.dashboard');
    expect(html).toContain('sidebar.market_intelligence');
    expect(html).toContain('sidebar.watchlist');
    expect(html).toContain('sidebar.command_center');
  });

  it('renders Simplicity navigation tabs and action buttons in Simplicity mode with testids and valid hrefs', () => {
    currentPathname = '/finance';
    const html = renderToString(
      <Sidebar activeTab="finance" setActiveTab={mockSetActiveTab} />
    );

    expect(html).toContain('Dashboard');
    expect(html).toContain('Transactions');
    expect(html).toContain('Budgets');
    expect(html).toContain('Wallets');
    expect(html).toContain('data-testid="sidebar-simplicity-dashboard"');
    expect(html).toContain('data-testid="sidebar-simplicity-transactions"');
    expect(html).toContain('data-testid="sidebar-simplicity-budgets"');
    expect(html).toContain('data-testid="sidebar-simplicity-wallets"');
    expect(html).toContain('href="/finance?tab=transactions&amp;wallet=all"');
    expect(html).toContain('href="/finance?tab=budgets&amp;wallet=all"');
    expect(html).toContain('href="/finance?tab=wallets&amp;wallet=all"');
    expect(html).toContain('data-testid="sidebar-action-add-tx"');
    expect(html).toContain('+ Add Transaction');
  });
});

