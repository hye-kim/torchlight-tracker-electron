import { contextBridge, ipcRenderer } from 'electron';
import type {
  Config,
  Stats,
  Drop,
  MapLog,
  UpdateInfo,
  UpdateConfig,
  UpdateStatus,
  DownloadProgress,
  DisplayItem,
  Session,
} from '../src/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (updates: Partial<Config>) => ipcRenderer.invoke('update-config', updates),

  // Stats and Drops
  getStats: () => ipcRenderer.invoke('get-stats'),
  getDrops: () => ipcRenderer.invoke('get-drops'),
  getMapLogs: () => ipcRenderer.invoke('get-map-logs'),
  getBagState: () => ipcRenderer.invoke('get-bag-state'),
  getCurrentPrices: () => ipcRenderer.invoke('get-current-prices'),

  // Actions
  initializeTracker: () => ipcRenderer.invoke('initialize-tracker'),
  exportExcel: () => ipcRenderer.invoke('export-excel'),
  resetStats: () => ipcRenderer.invoke('reset-stats'),
  exportDebugLog: () => ipcRenderer.invoke('export-debug-log'),

  // Overlay mode controls
  toggleOverlayMode: (enabled: boolean) => ipcRenderer.invoke('toggle-overlay-mode', enabled),
  toggleClickThrough: (enabled: boolean) => ipcRenderer.invoke('toggle-click-through', enabled),
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.invoke('set-ignore-mouse-events', ignore),
  setFontSize: (fontSize: number) => ipcRenderer.invoke('set-font-size', fontSize),
  setDisplayItems: (displayItems: DisplayItem[]) =>
    ipcRenderer.invoke('set-display-items', displayItems),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowResize: (width: number, height: number) =>
    ipcRenderer.invoke('window-resize', width, height),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),

  // Update checks
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  getUpdateConfig: () => ipcRenderer.invoke('get-update-config'),
  setUpdateConfig: (updateConfig: UpdateConfig) =>
    ipcRenderer.invoke('set-update-config', updateConfig),
  skipUpdateVersion: (version: string) => ipcRenderer.invoke('skip-update-version', version),

  // Session management
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  getSession: (sessionId: string) => ipcRenderer.invoke('get-session', sessionId),
  getCurrentSession: () => ipcRenderer.invoke('get-current-session'),
  deleteSessions: (sessionIds: string[]) => ipcRenderer.invoke('delete-sessions', sessionIds),

  // Listen for updates
  onUpdateDisplay: (
    callback: (data: {
      stats: Stats;
      drops: Drop[];
      costs: Drop[];
      mapLogs: MapLog[];
      bagInventory: Drop[];
      isInMap: boolean;
      currentMap: MapLog | null;
    }) => void
  ) => {
    ipcRenderer.on(
      'update-display',
      (
        _event: Electron.IpcRendererEvent,
        data: {
          stats: Stats;
          drops: Drop[];
          costs: Drop[];
          mapLogs: MapLog[];
          bagInventory: Drop[];
          isInMap: boolean;
          currentMap: MapLog | null;
        }
      ) => callback(data)
    );
  },

  // Update event listeners
  onCheckingForUpdate: (callback: () => void) => {
    ipcRenderer.on('checking-for-update', () => callback());
  },

  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
    ipcRenderer.on('update-available', (_event: Electron.IpcRendererEvent, info: UpdateInfo) =>
      callback(info)
    );
  },

  onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => {
    ipcRenderer.on('update-not-available', (_event: Electron.IpcRendererEvent, info: UpdateInfo) =>
      callback(info)
    );
  },

  onUpdateError: (callback: (error: Error) => void) => {
    ipcRenderer.on('update-error', (_event: Electron.IpcRendererEvent, error: Error) =>
      callback(error)
    );
  },

  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    ipcRenderer.on(
      'download-progress',
      (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => callback(progress)
    );
  },

  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => {
    ipcRenderer.on('update-downloaded', (_event: Electron.IpcRendererEvent, info: UpdateInfo) =>
      callback(info)
    );
  },

  onInitializationComplete: (callback: () => void) => {
    ipcRenderer.on('initialization-complete', () => callback());
  },

  onOverlayModeChanged: (callback: (overlayMode: boolean) => void) => {
    ipcRenderer.on(
      'overlay-mode-changed',
      (_event: Electron.IpcRendererEvent, overlayMode: boolean) => callback(overlayMode)
    );
  },
});

// Handle interactive elements for click-through functionality
window.addEventListener('DOMContentLoaded', () => {
  const attachHandlers = (element: Element): void => {
    element.addEventListener('pointerenter', () => {
      ipcRenderer.send('set-ignore-mouse-events', false);
    });

    element.addEventListener('pointerleave', () => {
      // Only enable click-through if clickThrough is enabled in config
      void ipcRenderer.invoke('get-config').then((config: Config) => {
        if (config.clickThrough) {
          ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
        }
      });
    });
  };

  // Attach handlers to existing interactive elements
  document.querySelectorAll('.interactive').forEach(attachHandlers);

  // Watch for new interactive elements being added
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          // Check if the added node itself has interactive class
          if (node.classList.contains('interactive')) {
            attachHandlers(node);
          }
          // Check if any children have interactive class
          node.querySelectorAll('.interactive').forEach(attachHandlers);
        }
      });
    });
  });

  // Start observing the document with the configured parameters
  observer.observe(document.body, { childList: true, subtree: true });
});

// Type definitions for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<Config>;
      updateConfig: (updates: Partial<Config>) => Promise<Config>;
      getStats: () => Promise<Stats>;
      getDrops: () => Promise<Drop[]>;
      getMapLogs: () => Promise<MapLog[]>;
      getBagState: () => Promise<Drop[]>;
      getCurrentPrices: () => Promise<Record<string, { price: number; taxedPrice: number }>>;
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
          costs: Drop[];
          mapLogs: MapLog[];
          bagInventory: Drop[];
          isInMap: boolean;
          currentMap: MapLog | null;
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
