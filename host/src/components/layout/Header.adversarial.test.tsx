import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import Header from './Header';
import { useFinanceBridgeStore } from '../../store/financeBridgeStore';

let currentPathname = '/finance';
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

vi.mock('@mui/joy/styles', () => ({
  useColorScheme: () => ({
    mode: 'dark',
    setMode: vi.fn(),
  }),
}));

vi.mock('../../store/settingsStore', () => ({
  useSettingsStore: () => ({
    theme: 'dark',
    setTheme: vi.fn(),
    density: 'medium',
    setDensity: vi.fn(),
    usdThbRate: 36.5,
    setUsdThbRate: vi.fn(),
  }),
}));

// Bridge store SSR client snapshot shim: In Node SSR renderToString, useSyncExternalStore calls getServerSnapshot.
// Attaching getState/setState preserves Zustand store API while reading client state in SSR.
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

// Mock GSAP to prevent animation errors during SSR render
vi.mock('gsap', () => ({
  default: {
    context: (fn: any) => ({ revert: vi.fn() }),
    fromTo: vi.fn(),
    to: vi.fn(),
  },
}));

describe('Adversarial Verification: Header Navigation & Action Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFinanceBridgeStore.getState().reset();
  });

  it('renders Segmented Pill Switcher with Oaktree and Simplicity buttons with native href links for open-in-new-tab capability', () => {
    currentPathname = '/finance';
    const html = renderToString(
      <Header activeTab="finance" />
    );

    expect(html).toContain('data-testid="app-switcher-oaktree"');
    expect(html).toContain('data-testid="app-switcher-simplicity"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/finance?tab=dashboard&amp;wallet=all"');
    expect(html).toContain('🌳 Oaktree');
    expect(html).toContain('💳 Simplicity');
  });

  it('renders all 4 Simplicity finance tabs when activeTab="finance" on Row 2', () => {
    currentPathname = '/finance';
    const html = renderToString(
      <Header activeTab="finance" activeFinanceTab="dashboard" />
    );

    expect(html).toContain('Dashboard');
    expect(html).toContain('Transactions');
    expect(html).toContain('Budgets');
    expect(html).toContain('Wallets');
    expect(html).toContain('/finance?tab=dashboard&amp;wallet=all');
    expect(html).toContain('/finance?tab=transactions&amp;wallet=all');
    expect(html).toContain('/finance?tab=budgets&amp;wallet=all');
    expect(html).toContain('/finance?tab=wallets&amp;wallet=all');
  });

  it('renders all 4 Header action buttons on Row 2 in Simplicity mode', () => {
    currentPathname = '/finance';
    const html = renderToString(
      <Header activeTab="finance" />
    );

    // 1. Wallet Switcher dropdown button
    expect(html).toContain('data-testid="wallet-switcher-btn"');
    expect(html).toContain('All Wallets');

    // 2. AI Scanner button
    expect(html).toContain('data-testid="btn-ai-scan"');
    expect(html).toContain('AI Scanner');

    // 3. CSV Import button
    expect(html).toContain('data-testid="btn-csv-import"');
    expect(html).toContain('CSV Import');

    // 4. + Add Transaction button
    expect(html).toContain('data-testid="btn-add-tx"');
  });

  it('dynamically reflects updated synced wallet name in wallet switcher button', () => {
    currentPathname = '/finance';
    currentSearch = { tab: 'dashboard', wallet: 'wal_kbank' };

    // Synchronize wallets into store
    useFinanceBridgeStore.getState().setWallets([
      { id: 'wal_kbank', name: 'Kasikorn Vault', currency: 'THB', balance: 120000 },
      { id: 'wal_scb', name: 'SCB Prime', currency: 'THB', balance: 50000 },
    ]);

    const html = renderToString(
      <Header
        activeTab="finance"
        selectedWalletId="wal_kbank"
      />
    );

    expect(html).toContain('Kasikorn Vault');
    expect(html).toContain('data-testid="wallet-switcher-btn"');
  });

  it('falls back to "All Wallets" text when selected wallet is deleted', () => {
    currentPathname = '/finance';

    // Set active to wal_deleted
    useFinanceBridgeStore.getState().setSelectedWalletId('wal_deleted');
    // Wallet list syncs without wal_deleted
    useFinanceBridgeStore.getState().setWallets([
      { id: 'wal_kbank', name: 'Kasikorn Vault', currency: 'THB', balance: 120000 },
    ]);

    // Store has fallen back to 'all'
    expect(useFinanceBridgeStore.getState().selectedWalletId).toBe('all');

    const html = renderToString(
      <Header
        activeTab="finance"
        selectedWalletId={useFinanceBridgeStore.getState().selectedWalletId}
      />
    );

    expect(html).toContain('All Wallets');
  });
});
