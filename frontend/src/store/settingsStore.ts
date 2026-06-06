import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DensityMode = 'compact' | 'cozy' | 'comfort';

interface SettingsState {
  density: DensityMode;
  setDensity: (density: DensityMode) => void;
  showMoneyValues: boolean;
  setShowMoneyValues: (show: boolean) => void;
  usdThbRate: number;
  setUsdThbRate: (rate: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      density: (() => {
        if (typeof window !== 'undefined') {
          const legacy = localStorage.getItem('table_density');
          if (legacy && ['compact', 'cozy', 'comfort'].includes(legacy)) {
            return legacy as DensityMode;
          }
        }
        return 'cozy';
      })(),
      setDensity: (density) => set({ density }),
      showMoneyValues: true,
      setShowMoneyValues: (show) => set({ showMoneyValues: show }),
      usdThbRate: 36.5,
      setUsdThbRate: (rate) => set({ usdThbRate: rate }),
    }),
    {
      name: 'table_density_storage', // Key name in localStorage
      // Custom storage options can be omitted to default to localStorage
    }
  )
);
