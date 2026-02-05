import { create } from 'zustand';
import { CurrentMapData } from '../types';

interface MapStore {
  currentMap: CurrentMapData | null;
  isInMap: boolean;
  selectedMapNumber: number | null;
  setCurrentMap: (currentMap: CurrentMapData | null) => void;
  setIsInMap: (isInMap: boolean) => void;
  setSelectedMapNumber: (mapNumber: number | null) => void;
  resetMap: () => void;
}

export const useMapStore = create<MapStore>((set) => ({
  currentMap: null,
  isInMap: false,
  selectedMapNumber: null,
  setCurrentMap: (currentMap) => set({ currentMap }),
  setIsInMap: (isInMap) => set({ isInMap }),
  setSelectedMapNumber: (mapNumber) => set({ selectedMapNumber: mapNumber }),
  resetMap: () =>
    set({
      currentMap: null,
      isInMap: false,
      selectedMapNumber: null,
    }),
}));
