import { create } from 'zustand';
import { Config } from '../types';

interface ConfigStore {
  config: Config;
  setConfig: (config: Config) => void;
  updateConfig: (updates: Partial<Config>) => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: { tax: 1, user: '' },
  setConfig: (config) => set({ config }),
  updateConfig: (updates) =>
    set((state) => ({
      config: { ...state.config, ...updates },
    })),
}));
