import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (updates: any) => ipcRenderer.invoke('update-config', updates),

  // Stats and Drops
  getStats: () => ipcRenderer.invoke('get-stats'),
  getDrops: () => ipcRenderer.invoke('get-drops'),
  getMapLogs: () => ipcRenderer.invoke('get-map-logs'),

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
  setDisplayItems: (displayItems: any) => ipcRenderer.invoke('set-display-items', displayItems),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowResize: (width: number, height: number) => ipcRenderer.invoke('window-resize', width, height),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),

  // Listen for updates
  onUpdateDisplay: (callback: (data: any) => void) => {
    ipcRenderer.on('update-display', (_, data) => callback(data));
  },

  onInitializationComplete: (callback: () => void) => {
    ipcRenderer.on('initialization-complete', () => callback());
  },

  onOverlayModeChanged: (callback: (overlayMode: boolean) => void) => {
    ipcRenderer.on('overlay-mode-changed', (_, overlayMode) => callback(overlayMode));
  },
});

// Handle interactive elements for click-through functionality
window.addEventListener('DOMContentLoaded', () => {
  const attachHandlers = (element: Element) => {
    element.addEventListener('pointerenter', () => {
      ipcRenderer.send('set-ignore-mouse-events', false);
    });

    element.addEventListener('pointerleave', () => {
      // Only enable click-through if clickThrough is enabled in config
      ipcRenderer.invoke('get-config').then((config: any) => {
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
      getConfig: () => Promise<any>;
      updateConfig: (updates: any) => Promise<any>;
      getStats: () => Promise<any>;
      getDrops: () => Promise<any>;
      getMapLogs: () => Promise<any>;
      initializeTracker: () => Promise<{ success: boolean }>;
      exportExcel: () => Promise<{ success: boolean; filePath?: string }>;
      resetStats: () => Promise<{ success: boolean }>;
      exportDebugLog: () => Promise<{ success: boolean; filePath?: string }>;
      toggleOverlayMode: (enabled: boolean) => Promise<{ success: boolean }>;
      toggleClickThrough: (enabled: boolean) => Promise<{ success: boolean }>;
      setIgnoreMouseEvents: (ignore: boolean) => Promise<{ success: boolean }>;
      setFontSize: (fontSize: number) => Promise<{ success: boolean }>;
      setDisplayItems: (displayItems: any) => Promise<{ success: boolean }>;
      windowMinimize: () => Promise<{ success: boolean }>;
      windowMaximize: () => Promise<{ success: boolean }>;
      windowClose: () => Promise<{ success: boolean }>;
      windowResize: (width: number, height: number) => Promise<{ success: boolean }>;
      getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number }>;
      onUpdateDisplay: (callback: (data: any) => void) => void;
      onInitializationComplete: (callback: () => void) => void;
      onOverlayModeChanged: (callback: (overlayMode: boolean) => void) => void;
    };
  }
}
