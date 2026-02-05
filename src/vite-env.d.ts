/// <reference types="vite/client" />

import type {
  Config,
  Stats,
  Drop,
  MapLog,
  BagState,
  UpdateInfo,
  UpdateConfig,
  UpdateStatus,
  DownloadProgress,
  DisplayItem,
  Session,
} from './types';

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<Config>;
      updateConfig: (updates: Partial<Config>) => Promise<Config>;
      getStats: () => Promise<Stats>;
      getDrops: () => Promise<Drop[]>;
      getMapLogs: () => Promise<MapLog[]>;
      getBagState: () => Promise<BagState>;
      initializeTracker: () => Promise<{ success: boolean }>;
      exportExcel: () => Promise<{ success: boolean; filePath?: string }>;
      resetStats: () => Promise<{ success: boolean }>;
      exportDebugLog: () => Promise<{ success: boolean; filePath?: string }>;
      toggleOverlayMode: (enabled: boolean) => Promise<{ success: boolean }>;
      toggleClickThrough: (enabled: boolean) => Promise<{ success: boolean }>;
      setIgnoreMouseEvents: (ignore: boolean) => Promise<{ success: boolean }>;
      setFontSize: (fontSize: number) => Promise<{ success: boolean }>;
      setDisplayItems: (displayItems: DisplayItem[]) => Promise<{ success: boolean }>;
      windowMinimize: () => Promise<{ success: boolean }>;
      windowMaximize: () => Promise<{ success: boolean }>;
      windowClose: () => Promise<{ success: boolean }>;
      windowResize: (width: number, height: number) => Promise<{ success: boolean }>;
      getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number }>;
      checkForUpdates: () => Promise<{ success: boolean; updateInfo?: UpdateInfo }>;
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
      installUpdate: () => Promise<{ success: boolean }>;
      getAppVersion: () => Promise<string>;
      getUpdateStatus: () => Promise<UpdateStatus>;
      getUpdateConfig: () => Promise<UpdateConfig>;
      setUpdateConfig: (updateConfig: UpdateConfig) => Promise<{ success: boolean }>;
      skipUpdateVersion: (version: string) => Promise<{ success: boolean }>;
      getSessions: () => Promise<Session[]>;
      getSession: (sessionId: string) => Promise<Session | null>;
      getCurrentSession: () => Promise<Session | null>;
      deleteSessions: (sessionIds: string[]) => Promise<{ success: boolean }>;
      onUpdateDisplay: (
        callback: (data: {
          stats: Stats;
          drops: Drop[];
          mapLogs: MapLog[];
          bagState: BagState;
        }) => void
      ) => void;
      onCheckingForUpdate: (callback: () => void) => void;
      onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
      onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => void;
      onUpdateError: (callback: (error: Error) => void) => void;
      onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
      onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
      onInitializationComplete: (callback: () => void) => void;
      onOverlayModeChanged: (callback: (overlayMode: boolean) => void) => void;
    };
  }
}

export {};
