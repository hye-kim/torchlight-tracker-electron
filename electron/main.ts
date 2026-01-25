import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import { ConfigManager } from './backend/ConfigManager';
import { FileManager } from './backend/FileManager';
import { LogParser } from './backend/LogParser';
import { InventoryTracker } from './backend/InventoryTracker';
import { StatisticsTracker } from './backend/StatisticsTracker';
import { GameDetector } from './backend/GameDetector';
import { LogMonitor } from './backend/LogMonitor';
import { Logger } from './backend/Logger';
import { ExcelExporter } from './backend/ExcelExporter';

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

  mainWindow = new BrowserWindow({
    width: overlayMode ? (config.overlay_width || 400) : (config.window_width || 1200),
    height: overlayMode ? (config.overlay_height || 600) : (config.window_height || 800),
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
    mainWindow.loadURL('http://localhost:5173');
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
  await fileManager.ensureFileExists('config.json', {
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

    // Save current dimensions before switching modes
    if (config.overlayMode) {
      // Currently in overlay mode, save overlay dimensions
      configManager.updateConfig({
        overlay_width: currentBounds.width,
        overlay_height: currentBounds.height,
      });
    } else {
      // Currently in normal mode, save normal dimensions
      configManager.updateConfig({
        window_width: currentBounds.width,
        window_height: currentBounds.height,
      });
    }

    // Update overlay mode
    configManager.setOverlayMode(enabled);
    mainWindow.setAlwaysOnTop(enabled);

    // Resize window to saved dimensions for the new mode
    const updatedConfig = configManager.getConfig();
    if (enabled) {
      // Switching to overlay mode
      mainWindow.setSize(updatedConfig.overlay_width || 400, updatedConfig.overlay_height || 600);
    } else {
      // Switching to normal mode
      mainWindow.setSize(updatedConfig.window_width || 1200, updatedConfig.window_height || 800);
    }

    // Restart app to apply changes
    setTimeout(() => {
      app.relaunch();
      app.exit();
    }, 100);
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
