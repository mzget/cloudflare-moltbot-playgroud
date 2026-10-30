import { create } from 'zustand';

export interface Wallet {
  id: string;
  name: string;
  currency: string;
  balance?: number;
  currentBalance?: number;
  computed_balance?: number;
  type?: 'cash' | 'bank' | 'credit' | 'savings' | 'crypto' | string;
  color?: string;
  icon?: string;
  orderIndex?: number;
  status?: 'active' | 'archived' | 'deleted' | string;
  createdAt?: string;
  [key: string]: unknown;
}

export type FinanceTab = 'dashboard' | 'transactions' | 'budgets' | 'wallets';

export type FinanceActionType = 'add-tx' | 'ai-scan' | 'csv-import' | 'add-wallet';

export interface FinanceBridgeState {
  wallets: Wallet[];
  selectedWalletId: string;
  activeTab: FinanceTab | string;
  pendingAction: FinanceActionType | null;
  lastFinanceTab: FinanceTab;
  lastFinanceWallet: string;
  lastFinanceUrl: string;

  setWallets: (wallets: Wallet[]) => void;
  setSelectedWalletId: (walletId: string) => void;
  setActiveTab: (tab: FinanceTab | string) => void;
  setPendingAction: (action: FinanceActionType | null) => void;
  consumePendingAction: () => FinanceActionType | null;
  setLastFinanceState: (tab: FinanceTab, wallet: string) => void;
  setLastFinanceUrl: (url: string) => void;
  reset: () => void;
}

export const useFinanceBridgeStore = create<FinanceBridgeState>((set, get) => ({
  wallets: [],
  selectedWalletId: 'all',
  activeTab: 'dashboard',
  pendingAction: null,
  lastFinanceTab: 'dashboard',
  lastFinanceWallet: 'all',
  lastFinanceUrl: '/finance?tab=dashboard&wallet=all',

  setWallets: (wallets: Wallet[]) => {
    const safeWallets = Array.isArray(wallets) ? wallets : [];
    const currentSelected = get().selectedWalletId;
    // Boundary F-11-B5: If selected wallet was deleted, fall back to 'all'
    const exists = currentSelected === 'all' || safeWallets.some((w) => w.id === currentSelected);
    set({
      wallets: safeWallets,
      selectedWalletId: exists ? currentSelected : 'all',
    });
  },

  setSelectedWalletId: (selectedWalletId: string) => {
    set({ selectedWalletId: selectedWalletId || 'all' });
  },

  setActiveTab: (activeTab: FinanceTab | string) => {
    set({ activeTab: activeTab || 'dashboard' });
  },

  setPendingAction: (action: FinanceActionType | null) => {
    set({ pendingAction: action });
  },

  consumePendingAction: () => {
    const action = get().pendingAction;
    if (action) {
      set({ pendingAction: null });
    }
    return action;
  },

  setLastFinanceState: (tab: FinanceTab, wallet: string) => {
    const safeTab = tab || 'dashboard';
    const safeWallet = wallet || 'all';
    set({
      lastFinanceTab: safeTab,
      lastFinanceWallet: safeWallet,
      lastFinanceUrl: `/finance?tab=${safeTab}&wallet=${safeWallet}`,
    });
  },

  setLastFinanceUrl: (lastFinanceUrl: string) => {
    set({ lastFinanceUrl: lastFinanceUrl || '/finance?tab=dashboard&wallet=all' });
  },

  reset: () => {
    set({
      wallets: [],
      selectedWalletId: 'all',
      activeTab: 'dashboard',
      pendingAction: null,
      lastFinanceTab: 'dashboard',
      lastFinanceWallet: 'all',
      lastFinanceUrl: '/finance?tab=dashboard&wallet=all',
    });
  },
}));

export function dispatchFinanceAction(action: FinanceActionType) {
  if (typeof window === 'undefined') return;

  // 1. Buffer action in store in case remote is mounting
  useFinanceBridgeStore.getState().setPendingAction(action);

  // 2. Dispatch CustomEvent for active remote listener
  window.dispatchEvent(
    new CustomEvent('oaktree:finance-action', {
      detail: { action },
    })
  );
}

export default useFinanceBridgeStore;
