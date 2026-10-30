declare module 'simplicity_finance/FinanceApp' {
  import type { ComponentType } from 'react';

  export interface FederatedFinanceProps {
    user?: { email: string; name: string; picture?: string } | null;
    token?: string | null;
    theme?: 'light' | 'dark';
    usdThbRate?: number;
    activeTab?: 'dashboard' | 'transactions' | 'budgets' | 'wallets';
    selectedWalletId?: string;
    onTabChange?: (tab: 'dashboard' | 'transactions' | 'budgets' | 'wallets') => void;
    onWalletChange?: (walletId: string) => void;
    onWalletsSync?: (wallets: any[]) => void;
    apiBaseUrl?: string;
  }

  const FederatedFinanceApp: ComponentType<FederatedFinanceProps>;
  export default FederatedFinanceApp;
}
