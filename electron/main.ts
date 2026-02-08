import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  session,
  IpcMainInvokeEvent,
  IpcMainEvent,
} from 'electron';
import path from 'path';
import { ConfigManager, Config } from './backend/core/ConfigManager';
import { FileManager } from './backend/data/FileManager';
import { LogParser } from './backend/game/LogParser';
import { InventoryTracker } from './backend/tracking/InventoryTracker';
import { StatisticsTracker } from './backend/tracking/StatisticsTracker';
import { GameDetector } from './backend/game/GameDetector';
import { LogMonitor } from './backend/game/LogMonitor';
import { Logger } from './backend/core/Logger';
import { ExcelExporter } from './backend/export/ExcelExporter';
import { UpdateManager } from './backend/updates/UpdateManager';
import { SessionManager } from './backend/tracking/SessionManager';
import { CONFIG_FILE, COMPREHENSIVE_ITEM_DATABASE_FILE, calculatePriceWithTax } from './backend/core/constants';

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
const sessionManager = new SessionManager(fileManager, configManager);
const gameDetector = new GameDetector();
const excelExporter = new ExcelExporter(fileManager);
const updateManager = new UpdateManager(logger);

function createWindow(): void {
  const config = configManager.getConfig();
  // Always start in non-overlay mode with click through disabled
  const overlayMode = false;

  const width = overlayMode ? (config.overlay_width ?? 400) : (config.window_width ?? 1300);
  const height = overlayMode ? (config.overlay_height ?? 1000) : (config.window_height ?? 900);

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
    icon: path.join(__dirname, '../../build-resources/icon.ico'),
  });

  // Click through is always disabled on startup
  // No need to apply click-through settings

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist-react/index.html'));
  }

  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();

      // Always save dimensions as normal window (non-overlay mode)
      // since app always starts in non-overlay mode
      configManager.updateConfig({
        window_x: bounds.x,
        window_y: bounds.y,
        window_width: bounds.width,
        window_height: bounds.height,
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

void app.whenReady().then(() => {
  logger.info('=== Torchlight Infinite Price Tracker Starting (Electron) ===');

  // Set up web request interceptor to fix 403 errors from CDN
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://cdn.tlidb.com/*'] },
    (
      details: Electron.OnBeforeSendHeadersListenerDetails,
      callback: (beforeSendResponse: Electron.BeforeSendResponse) => void
    ) => {
      details.requestHeaders['User-Agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      details.requestHeaders['Referer'] = 'https://www.tlidb.com/';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  // Initialize data files
  fileManager.ensureFileExists(CONFIG_FILE, {
    tax: 1,
    user: '',
  });
  fileManager.initializeFullTableFromEnTable();

  // Initialize session manager (cleanup old sessions, but don't start a new one yet)
  sessionManager.cleanupOldSessions();

  // Sync prices from API in the background
  logger.info('Fetching latest prices from API...');
  fileManager
    .syncAllPricesFromAPI()
    .then((count) => {
      if (count > 0) {
        logger.info(`Successfully synced ${count} prices from API`);
      } else {
        logger.warn('No prices synced from API (API may be unavailable)');
      }
    })
    .catch((error) => {
      logger.error('Failed to sync prices from API:', error);
    });

  // Periodically refresh prices from API every hour
  setInterval(() => {
    logger.info('Periodic API price refresh...');
    fileManager
      .syncAllPricesFromAPI()
      .then((count) => {
        if (count > 0) {
          logger.info(`Periodic refresh: synced ${count} prices from API`);
        }
      })
      .catch((error) => {
        logger.error('Periodic API refresh failed:', error);
      });
  }, 3600 * 1000); // 1 hour in milliseconds

  // Detect game
  const { gameFound, logFilePath } = gameDetector.detectGame();

  createWindow();

  // Set main window for update manager
  if (mainWindow) {
    updateManager.setMainWindow(mainWindow);
  }

  // Check for updates on startup (after 5 second delay)
  if (mainWindow && !isDev) {
    setTimeout(() => {
      void (async () => {
        const shouldCheck = configManager.getAutoCheckUpdates();
        if (shouldCheck) {
          logger.info('Checking for updates on startup...');
          try {
            const updateInfo = await updateManager.checkForUpdates();
            const skipVersion = configManager.getSkipVersion();

            // Don't notify if this version was explicitly skipped
            if (updateInfo && skipVersion !== updateInfo.version) {
              configManager.setLastCheckTime(Date.now());
            }
          } catch (error) {
            logger.error('Startup update check failed:', error);
          }
        }
      })();
    }, 5000); // 5 second delay
  }

  // Show warning if game not found
  if (!gameFound && mainWindow) {
    const window = mainWindow;
    setTimeout(() => {
      void dialog.showMessageBox(window, {
        type: 'warning',
        title: 'Game Not Found',
        message:
          'Could not find Torchlight: Infinite game process or log file.\n\n' +
          "The tool will continue running but won't be able to track drops " +
          'until the game is started.\n\n' +
          'Please make sure the game is running with logging enabled, ' +
          'then restart this tool.',
      });
    }, 500);
  }

  // Set up StatisticsTracker event listener for map completion
  statisticsTracker.on('mapCompleted', (mapLog) => {
    sessionManager.addMapToCurrentSession(mapLog);
    sessionManager.saveSessions();
  });

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

  // End current session and save
  sessionManager.endCurrentSession();
  sessionManager.saveSessions();

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

ipcMain.handle('update-config', (_event: IpcMainInvokeEvent, updates: Partial<Config>) => {
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
      name: itemData?.name ?? `Item ${itemId}`,
      quantity,
      price: itemData?.price ?? 0,
      type: itemData?.type ?? 'Unknown',
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
      name: itemData?.name ?? `Item ${itemId}`,
      quantity,
      price: itemData?.price ?? 0,
      type: itemData?.type ?? 'Unknown',
      imageUrl: itemData?.imageUrl,
    };
  });

  return bagArray;
});

ipcMain.handle('get-current-prices', () => {
  const fullTable = fileManager.loadFullTable();
  const taxEnabled = configManager.getTaxMode() === 1;

  const prices: Record<string, { price: number; taxedPrice: number }> = {};
  for (const [itemId, itemData] of Object.entries(fullTable)) {
    const basePrice = itemData.price ?? 0;
    prices[itemId] = {
      price: basePrice,
      taxedPrice: calculatePriceWithTax(basePrice, itemId, taxEnabled),
    };
  }
  return prices;
});

ipcMain.handle('initialize-tracker', () => {
  // End current session if one exists, then start a new session
  const currentSession = sessionManager.getCurrentSession();
  if (currentSession) {
    sessionManager.endCurrentSession();
  }
  sessionManager.startNewSession();
  sessionManager.saveSessions();

  inventoryTracker.startInitialization();
  return { success: true };
});

ipcMain.handle('export-excel', async () => {
  if (!mainWindow) {
    return { success: false, error: 'No main window' };
  }
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'torchlight_drops.xlsx',
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  });

  if (filePath) {
    try {
      const totalStats = statisticsTracker.getTotalStats();
      const allCosts = statisticsTracker.getAllCosts();
      const fullTable = fileManager.loadFullTable();
      const config = configManager.getConfig();

      // Convert drops to DropRecord format
      const dropRecords = Object.entries(totalStats.drops).map(([itemId, quantity]) => {
        const itemData = fullTable[itemId];
        return {
          itemId,
          name: itemData?.name ?? `Item ${itemId}`,
          quantity,
          price: itemData?.price ?? 0,
          type: itemData?.type ?? 'Unknown',
          timestamp: Date.now(),
        };
      });

      // Convert costs to DropRecord format
      const costRecords = Object.entries(allCosts).map(([itemId, quantity]) => {
        const itemData = fullTable[itemId];
        return {
          itemId,
          name: itemData?.name ?? `Item ${itemId}`,
          quantity,
          price: itemData?.price ?? 0,
          type: itemData?.type ?? 'Unknown',
          timestamp: Date.now(),
        };
      });

      await excelExporter.exportDropsToExcel(dropRecords, costRecords, filePath, config.tax === 1);
      return { success: true, filePath };
    } catch (error) {
      logger.error('Error exporting to Excel:', error);
      return { success: false, error: String(error) };
    }
  }
  return { success: false };
});

ipcMain.handle('reset-stats', () => {
  // End current session when stats are reset
  const currentSession = sessionManager.getCurrentSession();
  if (currentSession) {
    sessionManager.endCurrentSession();
  }

  statisticsTracker.reset();

  // Start a new session
  sessionManager.startNewSession();
  sessionManager.saveSessions();

  return { success: true };
});

ipcMain.handle('export-debug-log', async () => {
  if (!mainWindow) {
    return { success: false, error: 'No main window' };
  }
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'debug_log.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }],
  });

  if (filePath) {
    fileManager.exportDebugLog(filePath);
    return { success: true, filePath };
  }
  return { success: false };
});

// Overlay mode IPC handlers
ipcMain.handle('toggle-overlay-mode', (_event: IpcMainInvokeEvent, enabled: boolean) => {
  if (mainWindow) {
    const config = configManager.getConfig();
    const currentBounds = mainWindow.getBounds();

    // Prepare config update for window dimensions only (not overlay mode state)
    const configUpdate: Partial<Config> = {};

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

    // Save only window dimensions, not overlay mode state
    if (Object.keys(configUpdate).length > 0) {
      configManager.updateConfig(configUpdate);
    }

    // Notify renderer to update UI layout
    mainWindow.webContents.send('overlay-mode-changed', enabled);
  }
  return { success: true };
});

ipcMain.handle('toggle-click-through', (_event: IpcMainInvokeEvent, enabled: boolean) => {
  // Apply click-through to window but don't save to config
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
  }
  return { success: true };
});

ipcMain.handle('set-ignore-mouse-events', (_event: IpcMainInvokeEvent, ignore: boolean) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
  return { success: true };
});

// Handle set-ignore-mouse-events from ipcRenderer.send (used by preload for interactive elements)
ipcMain.on(
  'set-ignore-mouse-events',
  (_event: IpcMainEvent, ignore: boolean, options?: { forward: boolean }) => {
    if (mainWindow) {
      mainWindow.setIgnoreMouseEvents(ignore, options ?? { forward: true });
    }
  }
);

ipcMain.handle('set-font-size', (_event: IpcMainInvokeEvent, fontSize: number) => {
  configManager.setFontSize(fontSize);
  return { success: true };
});

ipcMain.handle(
  'set-display-items',
  (_event: IpcMainInvokeEvent, displayItems: Config['displayItems']) => {
    if (displayItems) {
      configManager.setDisplayItems(displayItems);
    }
    return { success: true };
  }
);

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

ipcMain.handle('window-resize', (_event: IpcMainInvokeEvent, width: number, height: number) => {
  if (mainWindow) {
    const currentSize = mainWindow.getSize();
    const currentWidth = currentSize[0];
    const currentHeight = currentSize[1];
    mainWindow.setSize(width ?? currentWidth ?? 400, height ?? currentHeight ?? 600, true);
  }
  return { success: true };
});

ipcMain.handle('get-window-bounds', () => {
  if (mainWindow) {
    return mainWindow.getBounds();
  }
  return { x: 0, y: 0, width: 400, height: 600 };
});

// Update IPC handlers
ipcMain.handle('check-for-updates', async () => {
  try {
    const updateInfo = await updateManager.checkForUpdates();
    if (updateInfo) {
      configManager.setLastCheckTime(Date.now());
    }
    return { success: true, updateInfo };
  } catch (error) {
    logger.error('Error checking for updates:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await updateManager.downloadUpdate();
    return { success: true };
  } catch (error) {
    logger.error('Error downloading update:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('install-update', () => {
  updateManager.quitAndInstall();
  return { success: true };
});

ipcMain.handle('get-app-version', () => {
  return updateManager.getCurrentVersion();
});

ipcMain.handle('get-update-status', () => {
  return updateManager.getUpdateStatus();
});

ipcMain.handle('get-update-config', () => {
  return configManager.getUpdateConfig();
});

ipcMain.handle(
  'set-update-config',
  (_event: IpcMainInvokeEvent, updateConfig: { autoCheck: boolean; skipVersion?: string }) => {
    configManager.setUpdateConfig(updateConfig);
    return { success: true };
  }
);

ipcMain.handle('skip-update-version', (_event: IpcMainInvokeEvent, version: string) => {
  configManager.setSkipVersion(version);
  return { success: true };
});

// Session management IPC handlers
ipcMain.handle('get-sessions', () => {
  const sessions = sessionManager.getAllSessions();
  const fullTable = fileManager.loadFullTable();
  const itemMapping = fileManager.loadBundledJson<
    Record<string, { id: string; img?: string; name_en?: string; type_en?: string }>
  >(COMPREHENSIVE_ITEM_DATABASE_FILE, {});

  // Helper to get item image URL from comprehensive mapping
  const getItemImageUrl = (itemId: string): string | undefined => {
    const item = itemMapping[itemId];
    return item?.img;
  };

  // Enrich drops and costs in each mapLog with item data
  // Use stored historical prices instead of current prices
  return sessions.map((session) => ({
    ...session,
    mapLogs: session.mapLogs.map((mapLog) => ({
      ...mapLog,
      drops:
        mapLog.drops?.map((drop) => {
          const itemData = fullTable[drop.itemId];
          return {
            itemId: drop.itemId,
            name: itemData?.name ?? `Item ${drop.itemId}`,
            quantity: drop.quantity,
            price: drop.price, // Use stored historical price
            type: itemData?.type ?? 'Unknown',
            timestamp: mapLog.startTime,
            imageUrl: getItemImageUrl(drop.itemId),
          };
        }) ?? [],
      costs:
        mapLog.costs?.map((cost) => {
          const itemData = fullTable[cost.itemId];
          return {
            itemId: cost.itemId,
            name: itemData?.name ?? `Item ${cost.itemId}`,
            quantity: cost.quantity,
            price: cost.price, // Use stored historical price
            type: itemData?.type ?? 'Unknown',
            timestamp: mapLog.startTime,
            imageUrl: getItemImageUrl(cost.itemId),
          };
        }) ?? [],
    })),
  }));
});

ipcMain.handle('get-session', (_event: IpcMainInvokeEvent, sessionId: string) => {
  return sessionManager.getSessionById(sessionId);
});

ipcMain.handle('get-current-session', () => {
  return sessionManager.getCurrentSession();
});

ipcMain.handle('delete-sessions', (_event: IpcMainInvokeEvent, sessionIds: string[]) => {
  sessionManager.deleteSessions(sessionIds);
  return { success: true };
});
