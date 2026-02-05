import { create } from 'zustand';
import { Stats, Drop, MapLog } from '../types';

interface StatsStore {
  stats: Stats | null;
  drops: Drop[];
  costs: Drop[];
  mapLogs: MapLog[];
  setStats: (stats: Stats | null) => void;
  setDrops: (drops: Drop[]) => void;
  setCosts: (costs: Drop[]) => void;
  setMapLogs: (mapLogs: MapLog[]) => void;
  resetStats: () => void;
}

export const useStatsStore = create<StatsStore>((set) => ({
  stats: null,
  drops: [],
  costs: [],
  mapLogs: [],
  setStats: (stats) => set({ stats }),
  setDrops: (drops) => set({ drops }),
  setCosts: (costs) => set({ costs }),
  setMapLogs: (mapLogs) => set({ mapLogs }),
  resetStats: () =>
    set({
      stats: null,
      drops: [],
      costs: [],
      mapLogs: [],
    }),
}));
