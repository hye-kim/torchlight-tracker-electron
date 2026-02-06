import { create } from 'zustand';
import type { UpdateInfo } from '../types';

interface UpdateStore {
  updateInfo: UpdateInfo | null;
  showUpdateNotification: boolean;
  showUpdateDialog: boolean;
  setUpdateInfo: (info: UpdateInfo | null) => void;
  setShowUpdateNotification: (show: boolean) => void;
  setShowUpdateDialog: (show: boolean) => void;
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  updateInfo: null,
  showUpdateNotification: false,
  showUpdateDialog: false,
  setUpdateInfo: (info) => set({ updateInfo: info }),
  setShowUpdateNotification: (show) => set({ showUpdateNotification: show }),
  setShowUpdateDialog: (show) => set({ showUpdateDialog: show }),
}));
