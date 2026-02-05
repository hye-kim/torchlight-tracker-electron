import { create } from 'zustand';

interface InitStore {
  isInitialized: boolean;
  isWaitingForInit: boolean;
  setIsInitialized: (initialized: boolean) => void;
  setIsWaitingForInit: (waiting: boolean) => void;
}

export const useInitStore = create<InitStore>((set) => ({
  isInitialized: false,
  isWaitingForInit: false,
  setIsInitialized: (initialized) => set({ isInitialized: initialized }),
  setIsWaitingForInit: (waiting) => set({ isWaitingForInit: waiting }),
}));
