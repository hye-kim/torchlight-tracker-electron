import { create } from 'zustand';
import { Drop } from '../types';

interface InventoryStore {
  bagInventory: Drop[];
  setBagInventory: (inventory: Drop[]) => void;
  resetInventory: () => void;
}

export const useInventoryStore = create<InventoryStore>((set) => ({
  bagInventory: [],
  setBagInventory: (inventory) => set({ bagInventory: inventory }),
  resetInventory: () => set({ bagInventory: [] }),
}));
