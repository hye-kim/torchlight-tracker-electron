import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow } from 'electron';
import type winston from 'winston';

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  updateInfo: UpdateInfo | null;
  progress: {
    percent: number;
    transferred: number;
    total: number;
  } | null;
}

export class UpdateManager {
  private logger: winston.Logger;
  private mainWindow: BrowserWindow | null = null;
  private status: UpdateStatus = {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    updateInfo: null,
    progress: null,
  };

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.setupAutoUpdater();
  }

  private setupAutoUpdater(): void {
    // Configure auto-updater
    autoUpdater.autoDownload = false; // User-prompted downloads only
    autoUpdater.autoInstallOnAppQuit = false; // User-prompted installs only

    // Disable signature verification (app is not code-signed)
    // Code signing requires a purchased certificate, so we disable verification for now
    if (process.platform === 'win32') {
      (autoUpdater as any).verifyUpdateCodeSignature = false;
    }

    // Set up event listeners
    autoUpdater.on('checking-for-update', () => {
      this.logger.info('Checking for updates...');
      this.status.checking = true;
      this.status.error = null;
      this.sendStatusToRenderer('checking-for-update');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.logger.info('Update available:', info.version);
      this.status.checking = false;
      this.status.available = true;
      this.status.updateInfo = info;
      this.sendStatusToRenderer('update-available', info);
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.logger.info('No update available. Current version:', info.version);
      this.status.checking = false;
      this.status.available = false;
      this.status.updateInfo = info;
      this.sendStatusToRenderer('update-not-available', info);
    });

    autoUpdater.on('error', (error: Error) => {
      this.logger.error('Update error:', error);
      this.status.checking = false;
      this.status.downloading = false;
      this.status.error = error.message;
      this.sendStatusToRenderer('update-error', { message: error.message });
    });

    autoUpdater.on('download-progress', (progressObj: { percent: number; transferred: number; total: number }) => {
      this.status.progress = {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
      };
      this.logger.info(`Download progress: ${progressObj.percent.toFixed(2)}%`);
      this.sendStatusToRenderer('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.logger.info('Update downloaded:', info.version);
      this.status.downloading = false;
      this.status.downloaded = true;
      this.status.updateInfo = info;
      this.sendStatusToRenderer('update-downloaded', info);
    });
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private sendStatusToRenderer(event: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(event, data);
    }
  }

  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      this.logger.info('Starting update check...');

      // Create a promise that resolves when we get the appropriate event
      const statusPromise = new Promise<boolean>((resolve) => {
        const availableHandler = () => {
          autoUpdater.off('update-not-available', notAvailableHandler);
          resolve(true);
        };
        const notAvailableHandler = () => {
          autoUpdater.off('update-available', availableHandler);
          resolve(false);
        };

        autoUpdater.once('update-available', availableHandler);
        autoUpdater.once('update-not-available', notAvailableHandler);
      });

      const result = await autoUpdater.checkForUpdates();
      const isUpdateAvailable = await statusPromise;

      // Only return updateInfo if an update is actually available
      return isUpdateAvailable ? result?.updateInfo || null : null;
    } catch (error) {
      this.logger.error('Error checking for updates:', error);
      this.status.error = error instanceof Error ? error.message : 'Unknown error';
      return null;
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      if (!this.status.available) {
        throw new Error('No update available to download');
      }

      this.logger.info('Starting update download...');
      this.status.downloading = true;
      this.status.error = null;
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.logger.error('Error downloading update:', error);
      this.status.downloading = false;
      this.status.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  quitAndInstall(): void {
    if (!this.status.downloaded) {
      this.logger.warn('Attempted to install update before download completed');
      return;
    }

    this.logger.info('Quitting and installing update...');
    // setImmediate ensures the renderer has time to clean up
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
  }

  getUpdateStatus(): UpdateStatus {
    return { ...this.status };
  }

  getCurrentVersion(): string {
    return autoUpdater.currentVersion.version;
  }
}
