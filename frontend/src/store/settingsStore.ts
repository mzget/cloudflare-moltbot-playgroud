import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE_URL } from '../config';

export type DensityMode = 'compact' | 'cozy' | 'comfort';
export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode, sync?: boolean) => void;
  density: DensityMode;
  setDensity: (density: DensityMode, sync?: boolean) => void;
  showMoneyValues: boolean;
  setShowMoneyValues: (show: boolean) => void;
  currency: string;
  setCurrency: (currency: string, sync?: boolean) => void;
  usdThbRate: number;
  setUsdThbRate: (rate: number, sync?: boolean) => void;
  
  fetchPreferences: () => Promise<void>;
  syncPreferences: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => {
      const getAuthHeaders = (): Record<string, string> => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        return token ? { 'Authorization': `Bearer ${token}` } : {};
      };

      const syncWithBackend = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        if (!token) return;

        try {
          await fetch(`${API_BASE_URL}/api/user/preferences`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({
              theme: get().theme,
              table_density: get().density,
              currency: get().currency,
              exchange_rate: get().usdThbRate,
            }),
          });
        } catch (e) {
          console.error('Failed to sync preferences with backend:', e);
        }
      };

      return {
        theme: 'system',
        setTheme: (theme, sync = true) => {
          set({ theme });
          if (sync) syncWithBackend();
        },
        density: (() => {
          if (typeof window !== 'undefined') {
            const legacy = localStorage.getItem('table_density');
            if (legacy && ['compact', 'cozy', 'comfort'].includes(legacy)) {
              return legacy as DensityMode;
            }
          }
          return 'cozy';
        })(),
        setDensity: (density, sync = true) => {
          set({ density });
          if (sync) syncWithBackend();
        },
        showMoneyValues: true,
        setShowMoneyValues: (show) => set({ showMoneyValues: show }),
        currency: 'USD',
        setCurrency: (currency, sync = true) => {
          set({ currency });
          if (sync) syncWithBackend();
        },
        usdThbRate: 36.5,
        setUsdThbRate: (rate, sync = true) => {
          set({ usdThbRate: rate });
          if (sync) syncWithBackend();
        },

        fetchPreferences: async () => {
          const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
          if (!token) return;

          try {
            const res = await fetch(`${API_BASE_URL}/api/user/preferences`, {
              headers: getAuthHeaders(),
            });
            if (res.ok) {
              const data = await res.json();
              set({
                theme: data.theme || 'system',
                density: data.table_density || 'cozy',
                currency: data.currency || 'USD',
                usdThbRate: data.exchange_rate || 36.5,
              });
            }
          } catch (e) {
            console.error('Failed to fetch preferences:', e);
          }
        },

        syncPreferences: async () => {
          await syncWithBackend();
        },
      };
    },
    {
      name: 'table_density_storage',
    }
  )
);
