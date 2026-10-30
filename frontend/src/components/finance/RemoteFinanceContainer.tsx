import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Zustand from 'zustand';
import { Box, CircularProgress, Typography } from '@mui/joy';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useColorScheme } from '@mui/joy/styles';
import { AuthContext } from '../common/AuthContext';
import { useSettingsStore } from '../../store/settingsStore';
import { useFinanceBridgeStore, type Wallet } from '../../store/financeBridgeStore';
import { FederatedErrorBoundary } from './FederatedErrorBoundary';
import type { FederatedFinanceProps } from 'simplicity_finance/FinanceApp';

const DEFAULT_REMOTE_ENTRY_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_SIMPLICITY_REMOTE_URL) ||
  'http://localhost:5173/assets/remoteEntry.js';

/**
 * Loads the Federated FinanceApp module from remoteEntry.js at runtime.
 * Appends a cache-busting query parameter on retry so the browser re-fetches
 * remoteEntry.js after a transient network outage (e.g. when the remote server restarts).
 */
async function loadFederatedFinanceModule(retryAttempt: number): Promise<{ default: React.ComponentType<FederatedFinanceProps> }> {
  const separator = DEFAULT_REMOTE_ENTRY_URL.includes('?') ? '&' : '?';
  const entryUrl =
    retryAttempt > 0
      ? `${DEFAULT_REMOTE_ENTRY_URL}${separator}t=${Date.now()}_${retryAttempt}`
      : DEFAULT_REMOTE_ENTRY_URL;

  const container: any = await import(/* @vite-ignore */ entryUrl);
  if (!container || typeof container.get !== 'function') {
    throw new Error(`Invalid federation container returned from ${DEFAULT_REMOTE_ENTRY_URL}`);
  }

  if (typeof container.init === 'function') {
    await container.init({
      react: {
        '19.3.0': {
          get: () => Promise.resolve(() => React),
          loaded: true,
          from: 'oaktree_host',
        },
      },
      'react-dom': {
        '19.3.0': {
          get: () => Promise.resolve(() => ReactDOM),
          loaded: true,
          from: 'oaktree_host',
        },
      },
      zustand: {
        '5.0.15': {
          get: () => Promise.resolve(() => Zustand),
          loaded: true,
          from: 'oaktree_host',
        },
      },
    });
  }

  const factory = await container.get('./FinanceApp');
  const mod = typeof factory === 'function' ? factory() : factory;
  const ResolvedComponent = mod?.default || mod?.FederatedFinanceApp || mod;

  if (!ResolvedComponent) {
    throw new Error('Remote FinanceApp component export not found');
  }

  return { default: ResolvedComponent };
}

export interface RemoteFinanceContainerProps extends Partial<FederatedFinanceProps> {}

export const RemoteFinanceContainer: React.FC<RemoteFinanceContainerProps> = (props) => {
  // 1. Astro SSG/SSR Guard: Do not execute on server
  if (typeof window === 'undefined') {
    return null;
  }

  // 2. Resolve Context and Stores
  const { user: authUser } = React.useContext(AuthContext);
  const { mode } = useColorScheme();
  const storeUsdThbRate = useSettingsStore((s) => s.usdThbRate);
  const search = useSearch({ strict: false }) as any;
  const navigate = useNavigate();

  const setBridgeWallets = useFinanceBridgeStore((s) => s.setWallets);
  const consumePendingAction = useFinanceBridgeStore((s) => s.consumePendingAction);

  // Replay any pending action once mounted
  React.useEffect(() => {
    const pending = consumePendingAction();
    if (pending && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('oaktree:finance-action', { detail: { action: pending } }));
    }
  }, [consumePendingAction]);

  // 3. Retry state: incrementing retryKey creates a fresh React.lazy instance
  const [retryKey, setRetryKey] = React.useState(0);

  const FederatedComponent = React.useMemo(() => {
    return React.lazy(() => {
      if (typeof window === 'undefined') {
        return Promise.resolve({ default: () => null as any });
      }
      return loadFederatedFinanceModule(retryKey);
    });
  }, [retryKey]);

  const handleRetry = React.useCallback(() => {
    setRetryKey((prev) => prev + 1);
  }, []);

  // 4. Resolve Props (explicit props take precedence over stores/context)
  const resolvedUser = props.user !== undefined ? props.user : authUser;
  const resolvedToken = props.token !== undefined ? props.token : (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
  const resolvedTheme = props.theme !== undefined ? props.theme : (mode === 'light' ? 'light' : 'dark');
  const resolvedUsdThbRate = props.usdThbRate !== undefined ? props.usdThbRate : storeUsdThbRate;

  const searchTab = (search?.tab as 'dashboard' | 'transactions' | 'budgets' | 'wallets') || 'dashboard';
  const resolvedActiveTab = props.activeTab || searchTab;

  const searchWallet = (search?.wallet as string) || 'all';
  const resolvedSelectedWalletId = props.selectedWalletId || searchWallet;

  // 5. Echo prevention guards
  const lastDispatchedTabRef = React.useRef(searchTab);
  const lastDispatchedWalletRef = React.useRef(searchWallet);

  React.useEffect(() => {
    lastDispatchedTabRef.current = searchTab;
  }, [searchTab]);

  React.useEffect(() => {
    lastDispatchedWalletRef.current = searchWallet;
  }, [searchWallet]);

  // 6. Callback handlers
  const handleTabChange = React.useCallback(
    (tab: 'dashboard' | 'transactions' | 'budgets' | 'wallets') => {
      if (tab === lastDispatchedTabRef.current) {
        return;
      }
      lastDispatchedTabRef.current = tab;
      if (props.onTabChange) {
        props.onTabChange(tab);
      } else {
        navigate({ search: ((old: any) => ({ ...old, tab })) as any });
      }
    },
    [navigate, props.onTabChange]
  );

  const handleWalletChange = React.useCallback(
    (walletId: string) => {
      const normalized = walletId || 'all';
      if (normalized === lastDispatchedWalletRef.current) {
        return;
      }
      lastDispatchedWalletRef.current = normalized;
      if (props.onWalletChange) {
        props.onWalletChange(normalized);
      } else {
        navigate({ search: ((old: any) => ({ ...old, wallet: normalized })) as any });
      }
    },
    [navigate, props.onWalletChange]
  );

  const handleWalletsSync = React.useCallback(
    (wallets: any[]) => {
      if (Array.isArray(wallets)) {
        setBridgeWallets(wallets as Wallet[]);
      }
      if (props.onWalletsSync) {
        props.onWalletsSync(wallets);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('oaktree:wallets-synced', { detail: { wallets } }));
      }
    },
    [props.onWalletsSync, setBridgeWallets]
  );

  return (
    <FederatedErrorBoundary key={retryKey} onRetry={handleRetry}>
      <React.Suspense
        fallback={
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '50vh',
              gap: 2,
            }}
          >
            <CircularProgress size="lg" variant="soft" color="primary" />
            <Typography level="body-sm" sx={{ opacity: 0.7 }}>
              Connecting to Simplicity Finance...
            </Typography>
          </Box>
        }
      >
        <FederatedComponent
          user={resolvedUser}
          token={resolvedToken}
          theme={resolvedTheme}
          usdThbRate={resolvedUsdThbRate}
          activeTab={resolvedActiveTab}
          selectedWalletId={resolvedSelectedWalletId}
          onTabChange={handleTabChange}
          onWalletChange={handleWalletChange}
          onWalletsSync={handleWalletsSync}
          apiBaseUrl={props.apiBaseUrl}
        />
      </React.Suspense>
    </FederatedErrorBoundary>
  );
};

export default RemoteFinanceContainer;
