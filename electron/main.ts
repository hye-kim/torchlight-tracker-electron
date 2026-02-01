import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import { ConfigManager, Config } from './backend/ConfigManager';
import { FileManager } from './backend/FileManager';
import { LogParser } from './backend/LogParser';
import { InventoryTracker } from './backend/InventoryTracker';
import { StatisticsTracker } from './backend/StatisticsTracker';
import { GameDetector } from './backend/GameDetector';
import { LogMonitor } from './backend/LogMonitor';
import { Logger } from './backend/Logger';
import { ExcelExporter } from './backend/ExcelExporter';
import { CONFIG_FILE } from './backend/constants';

const logger = Logger.getInstance();
const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let logMonitor: LogMonitor | null = null;

// Core components
const configManager = new ConfigManager();
const fileManager = new FileManager();
const logParser = new LogParser(fileManager);
const inventoryTracker = new InventoryTracker(logParser);
const statisticsTracker = new StatisticsTracker(fileManager, configManager);
const gameDetector = new GameDetector();
const excelExporter = new ExcelExporter(fileManager);

function createWindow() {
  const config = configManager.getConfig();
  const overlayMode = config.overlayMode ?? false;

  const width = overlayMode ? (config.overlay_width || 400) : (config.window_width || 1300);
  const height = overlayMode ? (config.overlay_height || 1000) : (config.window_height || 900);

  mainWindow = new BrowserWindow({
    width,
    height,
    x: config.window_x,
    y: config.window_y,
    frame: false,
    transparent: true,
    titleBarStyle: 'hidden',
    alwaysOnTop: overlayMode,
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../build-resources/icon.ico'),
  });

  // Apply click-through if enabled
  if (config.clickThrough) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-react/index.html'));
  }

  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      const currentConfig = configManager.getConfig();
      const isOverlay = currentConfig.overlayMode ?? false;

      // Save dimensions based on current mode
      if (isOverlay) {
        configManager.updateConfig({
          window_x: bounds.x,
          window_y: bounds.y,
          overlay_width: bounds.width,
          overlay_height: bounds.height,
        });
      } else {
        configManager.updateConfig({
          window_x: bounds.x,
          window_y: bounds.y,
          window_width: bounds.width,
          window_height: bounds.height,
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  logger.info('=== Torchlight Infinite Price Tracker Starting (Electron) ===');

  // Set up web request interceptor to fix 403 errors from CDN
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://cdn.tlidb.com/*'] },
    (details, callback) => {
      details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      details.requestHeaders['Referer'] = 'https://www.tlidb.com/';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  // Initialize data files
  await fileManager.ensureFileExists(CONFIG_FILE, {
    tax: 1,
    user: '',
  });
  await fileManager.initializeFullTableFromEnTable();

  // Sync prices from API in the background
  logger.info('Fetching latest prices from API...');
  fileManager.syncAllPricesFromAPI().then((count) => {
    if (count > 0) {
      logger.info(`Successfully synced ${count} prices from API`);
    } else {
      logger.warn('No prices synced from API (API may be unavailable)');
    }
  }).catch((error) => {
    logger.error('Failed to sync prices from API:', error);
  });

  // Periodically refresh prices from API every hour
  setInterval(() => {
    logger.info('Periodic API price refresh...');
    fileManager.syncAllPricesFromAPI().then((count) => {
      if (count > 0) {
        logger.info(`Periodic refresh: synced ${count} prices from API`);
      }
    }).catch((error) => {
      logger.error('Periodic API refresh failed:', error);
    });
  }, 3600 * 1000); // 1 hour in milliseconds

  // Detect game
  const { gameFound, logFilePath } = await gameDetector.detectGame();

  createWindow();

  // Show warning if game not found
  if (!gameFound && mainWindow) {
    setTimeout(() => {
      dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        title: 'Game Not Found',
        message:
          'Could not find Torchlight: Infinite game process or log file.\n\n' +
          'The tool will continue running but won\'t be able to track drops ' +
          'until the game is started.\n\n' +
          'Please make sure the game is running with logging enabled, ' +
          'then restart this tool.',
      });
    }, 500);
  }

  // Start log monitoring
  if (logFilePath) {
    logMonitor = new LogMonitor(
      logFilePath,
      logParser,
      fileManager,
      inventoryTracker,
      statisticsTracker
    );

    // Set up event listeners
    logMonitor.on('updateDisplay', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('update-display', data);
      }
    });

    logMonitor.on('reshowDrops', () => {
      if (mainWindow) {
        mainWindow.webContents.send('reshow-drops');
      }
    });

    logMonitor.on('initializationComplete', () => {
      if (mainWindow) {
        mainWindow.webContents.send('initialization-complete');
      }
    });

    logMonitor.start();
  }

  logger.info('Application started');
});

app.on('window-all-closed', () => {
  if (logMonitor) {
    logMonitor.stop();
  }
  logger.info('Application shut down');
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('get-config', () => {
  return configManager.getConfig();
});

ipcMain.handle('update-config', (_, updates) => {
  configManager.updateConfig(updates);
  return configManager.getConfig();
});

ipcMain.handle('get-stats', () => {
  const currentMap = statisticsTracker.getCurrentMapStats();
  const total = statisticsTracker.getTotalStats();

  return {
    currentMap: {
      mapCount: total.mapCount,
      duration: currentMap.duration,
      feIncome: currentMap.income,
      incomePerMinute: currentMap.incomePerMinute,
    },
    total: {
      mapCount: total.mapCount,
      duration: total.duration,
      feIncome: total.income,
      incomePerMinute: total.incomePerMinute,
    },
  };
});

ipcMain.handle('get-drops', () => {
  const totalStats = statisticsTracker.getTotalStats();
  const fullTable = fileManager.loadFullTable();

  // Convert drops object to array format expected by UI
  const dropsArray = Object.entries(totalStats.drops).map(([itemId, quantity]) => {
    const itemData = fullTable[itemId];
    return {
      itemId,
      name: itemData?.name || `Item ${itemId}`,
      quantity,
      price: itemData?.price || 0,
      type: itemData?.type || 'Unknown',
      timestamp: Date.now(),
    };
  });

  return dropsArray;
});

ipcMain.handle('get-map-logs', () => {
  return statisticsTracker.getMapLogs();
});

ipcMain.handle('get-bag-state', () => {
  const bagState = inventoryTracker.getBagStateSummary();
  const fullTable = fileManager.loadFullTable();

  // Convert bag state to array format with item details
  const bagArray = Object.entries(bagState).map(([itemId, quantity]) => {
    const itemData = fullTable[itemId];
    return {
      itemId,
      name: itemData?.name || `Item ${itemId}`,
      quantity,
      price: itemData?.price || 0,
      type: itemData?.type || 'Unknown',
      imageUrl: itemData?.imageUrl,
    };
  });

  return bagArray;
});

ipcMain.handle('initialize-tracker', async () => {
  inventoryTracker.startInitialization();
  return { success: true };
});

ipcMain.handle('export-excel', async () => {
  const { filePath } = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: 'torchlight_drops.xlsx',
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  });

  if (filePath) {
    try {
      const totalStats = statisticsTracker.getTotalStats();
      const fullTable = fileManager.loadFullTable();
      const config = configManager.getConfig();

      // Convert drops to DropRecord format
      const dropRecords = Object.entries(totalStats.drops).map(([itemId, quantity]) => {
        const itemData = fullTable[itemId];
        return {
          itemId,
          name: itemData?.name || `Item ${itemId}`,
          quantity,
          price: itemData?.price || 0,
          type: itemData?.type || 'Unknown',
          timestamp: Date.now(),
        };
      });

      await excelExporter.exportDropsToExcel(dropRecords, filePath, config.tax === 1);
      return { success: true, filePath };
    } catch (error) {
      logger.error('Error exporting to Excel:', error);
      return { success: false, error: String(error) };
    }
  }
  return { success: false };
});

ipcMain.handle('reset-stats', () => {
  statisticsTracker.reset();
  return { success: true };
});

ipcMain.handle('export-debug-log', async () => {
  const { filePath } = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: 'debug_log.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }],
  });

  if (filePath) {
    await fileManager.exportDebugLog(filePath);
    return { success: true, filePath };
  }
  return { success: false };
});

// Overlay mode IPC handlers
ipcMain.handle('toggle-overlay-mode', (_, enabled: boolean) => {
  if (mainWindow) {
    const config = configManager.getConfig();
    const currentBounds = mainWindow.getBounds();

    // Prepare config update with current dimensions and new overlay mode
    const configUpdate: Partial<Config> = {
      overlayMode: enabled,
    };

    // Save current dimensions to the mode we're switching FROM
    // If enabled=true, we're switching TO overlay, so we're currently in normal mode
    // If enabled=false, we're switching TO normal, so we're currently in overlay mode
    if (enabled) {
      // Switching TO overlay mode, save current size as normal mode dimensions
      configUpdate.window_width = currentBounds.width;
      configUpdate.window_height = currentBounds.height;

      // Apply overlay window properties
      const overlayWidth = config.overlay_width ?? 400;
      const overlayHeight = config.overlay_height ?? 1000;
      mainWindow.setBounds({
        width: overlayWidth,
        height: overlayHeight,
        x: currentBounds.x,
        y: currentBounds.y,
      });
      mainWindow.setAlwaysOnTop(true);
    } else {
      // Switching TO normal mode, save current size as overlay mode dimensions
      configUpdate.overlay_width = currentBounds.width;
      configUpdate.overlay_height = currentBounds.height;

      // Apply normal window properties
      const normalWidth = config.window_width ?? 1300;
      const normalHeight = config.window_height ?? 900;
      mainWindow.setBounds({
        width: normalWidth,
        height: normalHeight,
        x: currentBounds.x,
        y: currentBounds.y,
      });
      mainWindow.setAlwaysOnTop(false);
    }

    // Apply all config updates at once
    configManager.updateConfig(configUpdate);

    // Notify renderer to update UI layout
    mainWindow.webContents.send('overlay-mode-changed', enabled);
  }
  return { success: true };
});

ipcMain.handle('toggle-click-through', (_, enabled: boolean) => {
  configManager.setClickThrough(enabled);
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
  }
  return { success: true };
});

ipcMain.handle('set-ignore-mouse-events', (_, ignore: boolean) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
  return { success: true };
});

// Handle set-ignore-mouse-events from ipcRenderer.send (used by preload for interactive elements)
ipcMain.on('set-ignore-mouse-events', (_, ignore: boolean, options?: any) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, options || { forward: true });
  }
});

ipcMain.handle('set-font-size', (_, fontSize: number) => {
  configManager.setFontSize(fontSize);
  return { success: true };
});

ipcMain.handle('set-display-items', (_, displayItems) => {
  configManager.setDisplayItems(displayItems);
  return { success: true };
});

// Window controls
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
  return { success: true };
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
  return { success: true };
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
  return { success: true };
});

ipcMain.handle('window-resize', (_, width: number, height: number) => {
  if (mainWindow) {
    const currentSize = mainWindow.getSize();
    mainWindow.setSize(width || currentSize[0], height || currentSize[1], true);
  }
  return { success: true };
});

ipcMain.handle('get-window-bounds', () => {
  if (mainWindow) {
    return mainWindow.getBounds();
  }
  return { x: 0, y: 0, width: 400, height: 600 };
});
