// Core Shell Components
export { HostAppShell, installAuthFetchInterceptor, router, createHostRouter, getHostRouter } from './components/HostAppShell';
export type { HostAppShellProps } from './components/HostAppShell';
export { default as RoutesLayout, HostShellContext } from './components/layout/RoutesLayout';
export type { OaktreeFeatureViews, HostShellContextValue } from './components/layout/RoutesLayout';
export { default as Header } from './components/layout/Header';
export type { HeaderProps } from './components/layout/Header';
export { default as Sidebar } from './components/layout/Sidebar';
export type { SidebarProps } from './components/layout/Sidebar';

// Common Components & Contexts
export { AuthContext } from './components/common/AuthContext';
export type { User, AuthContextType } from './components/common/AuthContext';
export { ThemeProvider } from './components/common/ThemeProvider';
export type { ThemeProviderProps } from './components/common/ThemeProvider';
export { default as OaktreeIcon } from './components/common/OaktreeIcon';
export { default as NotFoundPage } from './components/features/error/NotFoundPage';
export { default as LoginScreen } from './components/features/auth/LoginScreen';
export type { LoginScreenProps } from './components/features/auth/LoginScreen';

// Federation
export {
  RemoteFinanceContainer,
  getSimplicityRemoteUrl,
  getSimplicityApiBaseUrl,
  isLocalEnvironment,
} from './components/federation/remotes/finance/RemoteFinanceContainer';
export type { RemoteFinanceContainerProps } from './components/federation/remotes/finance/RemoteFinanceContainer';
export { FederatedErrorBoundary } from './components/federation/core/FederatedErrorBoundary';
export type { FederatedErrorBoundaryProps, FederatedErrorBoundaryState } from './components/federation/core/FederatedErrorBoundary';

// Stores
export { useSettingsStore } from './store/settingsStore';
export type { SettingsState, DensityMode, ThemeMode } from './store/settingsStore';
export { useFinanceBridgeStore, dispatchFinanceAction } from './store/financeBridgeStore';
export type { Wallet, FinanceTab, FinanceActionType, FinanceBridgeState } from './store/financeBridgeStore';

// Router & Validation Schemas
export {
  analysisSearchSchema,
  financeSearchSchema,
  generalSearchSchema,
} from './router/schemas';
export type { FinanceSearch, FinanceTab as FinanceTabType } from './router/schemas';

// Config, Styles, i18n
export { glassStyle } from './styles/glass';
export { API_BASE_URL, MCP_WORKER_URL } from './config';
export { default as i18n } from './i18n';

