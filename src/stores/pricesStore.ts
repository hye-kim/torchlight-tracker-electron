import { create } from 'zustand';

interface CurrentPrices {
  [itemId: string]: {
    price: number; // Base price (for costs)
    taxedPrice: number; // Taxed price (for drops)
  };
}

interface PricesState {
  currentPrices: CurrentPrices;
  lastUpdated: number;
  setCurrentPrices: (prices: CurrentPrices) => void;
}

export const usePricesStore = create<PricesState>((set) => ({
  currentPrices: {},
  lastUpdated: 0,
  setCurrentPrices: (prices) => set({ currentPrices: prices, lastUpdated: Date.now() }),
}));
