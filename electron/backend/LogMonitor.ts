/**
 * Log monitoring for the Torchlight Infinite Price Tracker.
 * Monitors the game log file and processes events.
 */

import fs from 'fs';
import { EventEmitter } from 'events';
import { Logger } from './Logger';
import { LogParser } from './LogParser';
import { FileManager } from './FileManager';
import { InventoryTracker } from './InventoryTracker';
import { StatisticsTracker } from './StatisticsTracker';
import {
  LOG_FILE_REOPEN_INTERVAL,
  LOG_FILE_ROTATION_MAX_RETRIES,
  LOG_FILE_ROTATION_RETRY_DELAY,
  LOG_POLL_INTERVAL,
  COMPREHENSIVE_ITEM_DATABASE_FILE,
} from './constants';

const logger = Logger.getInstance();

export interface LogMonitorEvents {
  initializationComplete: (itemCount: number) => void;
  updateDisplay: () => void;
  reshowDrops: () => void;
  error: (error: Error) => void;
}

export class LogMonitor extends EventEmitter {
  private logFilePath: string | null;
  private logParser: LogParser;
  private fileManager: FileManager;
  private inventoryTracker: InventoryTracker;
  private statisticsTracker: StatisticsTracker;
  private running: boolean = false;
  private logFileHandle: number | null = null;
  private logFilePosition: number = 0;
  private lastReopenCheck: number = Date.now();

  // Polling interval handle
  private pollIntervalHandle: NodeJS.Timeout | null = null;

  // Pending subregion for map entry
  private pendingSubregion: string | null = null;

  // Buffer for multi-line patterns (like price searches)
  private priceBuffer: string[] = [];
  private lastPriceCheck: number = Date.now();
  private readonly PRICE_BUFFER_INTERVAL = 1000; // Check price buffer every 1 second

  constructor(
    logFilePath: string | null,
    logParser: LogParser,
    fileManager: FileManager,
    inventoryTracker: InventoryTracker,
    statisticsTracker: StatisticsTracker
  ) {
    super();
    this.logFilePath = logFilePath;
    this.logParser = logParser;
    this.fileManager = fileManager;
    this.inventoryTracker = inventoryTracker;
    this.statisticsTracker = statisticsTracker;
  }

  /**
   * Open the log file and seek to end.
   */
  private openLogFile(): boolean {
    if (!this.logFilePath) {
      return false;
    }

    try {
      this.logFileHandle = fs.openSync(this.logFilePath, 'r');
      const stats = fs.fstatSync(this.logFileHandle);
      this.logFilePosition = stats.size; // Seek to end
      logger.info('Log file opened successfully');
      return true;
    } catch (error) {
      logger.error(`Could not open log file: ${error}`);
      this.logFileHandle = null;
      return false;
    }
  }

  /**
   * Close the log file if open.
   */
  private closeLogFile(): void {
    if (this.logFileHandle !== null) {
      try {
        fs.closeSync(this.logFileHandle);
        logger.info('Log file closed');
      } catch (error) {
        logger.error(`Error closing log file: ${error}`);
      } finally {
        this.logFileHandle = null;
        this.logFilePosition = 0;
      }
    }
  }

  /**
   * Check if log file needs reopening (e.g., was deleted or rotated).
   */
  private checkAndReopenLogFile(): void {
    const now = Date.now();
    if (now - this.lastReopenCheck < LOG_FILE_REOPEN_INTERVAL * 1000) {
      return;
    }

    this.lastReopenCheck = now;

    // Check if file still exists and is accessible
    if (this.logFilePath) {
      if (!fs.existsSync(this.logFilePath)) {
        logger.warn('Log file no longer exists, attempting to reopen');
        this.closeLogFile();
        this.handleFileRotation();
      }
    }
  }

  /**
   * Handle game log file rotation/rename with retry logic.
   * The game may temporarily delete and recreate the log file.
   */
  private handleFileRotation(): boolean {
    if (!this.logFilePath) {
      return false;
    }

    for (let attempt = 0; attempt < LOG_FILE_ROTATION_MAX_RETRIES; attempt++) {
      try {
        // Check if file exists
        if (fs.existsSync(this.logFilePath)) {
          // File is back, reopen it
          if (this.openLogFile()) {
            logger.info('Log file recreated, successfully reopened');
            return true;
          }
        }

        logger.info(
          `Waiting for log file to be recreated... (${attempt + 1}/${LOG_FILE_ROTATION_MAX_RETRIES})`
        );

        // Sleep synchronously (blocking, but this is in a monitoring context)
        const sleepMs = LOG_FILE_ROTATION_RETRY_DELAY * 1000;
        const start = Date.now();
        while (Date.now() - start < sleepMs) {
          // Busy wait
        }
      } catch (error) {
        logger.error(`Error checking log file during rotation: ${error}`);
      }
    }

    logger.error(
      `Log file not recreated after ${LOG_FILE_ROTATION_MAX_RETRIES} attempts. Monitoring may be interrupted.`
    );
    return false;
  }

  /**
   * Read new lines from the log file.
   */
  private readLogFile(): string | null {
    if (this.logFileHandle === null || !this.logFilePath) {
      return null;
    }

    try {
      const stats = fs.fstatSync(this.logFileHandle);
      const currentSize = stats.size;

      // Check if file was truncated (size decreased)
      if (currentSize < this.logFilePosition) {
        logger.warn('Log file appears to have been truncated, reopening');
        this.closeLogFile();
        this.handleFileRotation();
        return null;
      }

      // Check if there's new data
      if (currentSize === this.logFilePosition) {
        return null; // No new data
      }

      // Read new data
      const bufferSize = currentSize - this.logFilePosition;
      const buffer = Buffer.alloc(bufferSize);
      fs.readSync(this.logFileHandle, buffer, 0, bufferSize, this.logFilePosition);
      this.logFilePosition = currentSize;

      return buffer.toString('utf-8');
    } catch (error) {
      logger.error(`Error reading log file: ${error}`);
      // Try to reopen the file with rotation handling
      this.closeLogFile();
      this.handleFileRotation();
      return null;
    }
  }

  /**
   * Start monitoring the log file.
   */
  start(): void {
    if (this.running) {
      logger.warn('Log monitor is already running');
      return;
    }

    if (!this.logFilePath) {
      logger.warn('No log file path provided');
      return;
    }

    this.running = true;

    // Open log file initially
    this.openLogFile();

    // Start polling loop
    this.pollIntervalHandle = setInterval(() => {
      this.pollLogFile();
    }, LOG_POLL_INTERVAL * 1000);

    logger.info('Log monitor started');
  }

  /**
   * Stop monitoring the log file.
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Stop polling
    if (this.pollIntervalHandle) {
      clearInterval(this.pollIntervalHandle);
      this.pollIntervalHandle = null;
    }

    // Process any remaining price buffer before shutdown
    if (this.priceBuffer.length > 0) {
      logger.info(`Processing ${this.priceBuffer.length} remaining price buffer lines before shutdown`);
      try {
        const text = this.priceBuffer.join('\n');
        this.processPriceUpdates(text);
      } catch (error) {
        logger.error(`Error processing remaining price buffer: ${error}`);
      }
    }

    // Ensure log file is closed
    this.closeLogFile();

    logger.info('Log monitor stopped');
  }

  /**
   * Poll the log file for new data.
   */
  private pollLogFile(): void {
    if (!this.running) {
      return;
    }

    try {
      // Check if log file needs reopening
      this.checkAndReopenLogFile();

      // Read and process log file lines immediately
      const text = this.readLogFile();
      if (text) {
        this.processLogLines(text);
      }

      // Process price buffer periodically
      const now = Date.now();
      if (this.priceBuffer.length > 0 && now - this.lastPriceCheck >= this.PRICE_BUFFER_INTERVAL) {
        this.lastPriceCheck = now;
        const bufferedText = this.priceBuffer.join('\n');
        this.processPriceUpdates(bufferedText);
        this.priceBuffer = [];
      }

      // Update display with current stats, drops, costs, and map logs
      const currentStats = this.statisticsTracker.getCurrentMapStats();
      const totalStats = this.statisticsTracker.getTotalStats();
      const fullTable = this.fileManager.loadFullTable();
      const itemMapping = this.fileManager.loadJson<Record<string, { id: string; img?: string; name_en?: string; type_en?: string }>>(COMPREHENSIVE_ITEM_DATABASE_FILE, {});

      // Helper to get item image URL from comprehensive mapping
      const getItemImageUrl = (itemId: string): string | undefined => {
        return itemMapping[itemId]?.img;
      };

      // Convert drops to array format for UI
      const dropsArray = Object.entries(totalStats.drops).map(([itemId, quantity]) => {
        const itemData = fullTable[itemId];
        const mappingData = itemMapping[itemId];
        let itemName = itemData?.name || mappingData?.name_en || `Item ${itemId}`;
        // Ensure name is a string
        if (typeof itemName !== 'string') {
          itemName = `Item ${itemId}`;
        }
        return {
          itemId,
          name: itemName,
          quantity,
          price: itemData?.price || 0,
          type: mappingData?.type_en || itemData?.type || 'Unknown',
          timestamp: Date.now(),
          imageUrl: getItemImageUrl(itemId),
        };
      });

      // Convert costs to array format for UI
      const currentCosts = this.statisticsTracker.getCurrentCosts();
      const costsArray = currentCosts.map(({ itemId, quantity }) => {
        const itemData = fullTable[itemId];
        const mappingData = itemMapping[itemId];
        let itemName = itemData?.name || mappingData?.name_en || `Item ${itemId}`;
        // Ensure name is a string
        if (typeof itemName !== 'string') {
          itemName = `Item ${itemId}`;
        }
        return {
          itemId,
          name: itemName,
          quantity,
          price: itemData?.price || 0,
          type: mappingData?.type_en || itemData?.type || 'Unknown',
          timestamp: Date.now(),
          imageUrl: getItemImageUrl(itemId),
        };
      });

      // Get map logs and current map state
      const mapLogs = this.statisticsTracker.getMapLogs();
      const isInMap = this.statisticsTracker.getIsInMap();
      const currentMap = this.statisticsTracker.getCurrentMapData();

      this.emit('updateDisplay', {
        stats: {
          currentMap: {
            mapCount: totalStats.mapCount,
            duration: currentStats.duration,
            feIncome: currentStats.profit,
            incomePerMinute: currentStats.profitPerMinute,
          },
          total: {
            mapCount: totalStats.mapCount,
            duration: totalStats.duration,
            feIncome: totalStats.profit,
            incomePerMinute: totalStats.profitPerMinute,
          },
        },
        drops: dropsArray,
        costs: costsArray,
        mapLogs: mapLogs,
        isInMap: isInMap,
        currentMap: currentMap,
      });
    } catch (error) {
      logger.error(`Error in log monitor poll: ${error}`);
      this.emit('error', error as Error);
    }
  }

  /**
   * Process log lines immediately (line-by-line).
   * This ensures map state and item tracking remain consistent.
   */
  private processLogLines(text: string): void {
    if (!text) {
      return;
    }

    // Split into lines and process each immediately
    const lines = text.split('\n');
    for (const line of lines) {
      if (!this.logParser.shouldProcessLine(line)) {
        continue; // Skip noise
      }

      // Add to price buffer for later processing (prices need multi-line context)
      if (line.includes('XchgSearchPrice') || line.includes('+refer')) {
        this.priceBuffer.push(line);
      }

      // Process line immediately for map state and item changes
      this.processLogLine(line);
    }
  }

  /**
   * Process price updates from buffered lines.
   * Price extraction needs multi-line context, so we buffer and process periodically.
   */
  private async processPriceUpdates(text: string): Promise<void> {
    const pricesUpdated = await this.logParser.updatePricesInTable(text);

    if (pricesUpdated > 0) {
      this.statisticsTracker.recalculateIncomeAndCosts();
      this.emit('reshowDrops');
      logger.debug(`Updated ${pricesUpdated} prices from buffer`);
    }
  }

  /**
   * Process a single log line for map state and item tracking.
   */
  private processLogLine(line: string): void {
    // Check for initialization completion
    if (this.inventoryTracker['awaitingInitialization']) {
      const result = this.inventoryTracker.processInitialization(line);
      if (result.success && result.itemCount) {
        this.emit('initializationComplete', result.itemCount);
      }
    }

    // Detect subregion entry
    const subregion = this.logParser.detectSubregionEntry(line);
    if (subregion) {
      if (this.statisticsTracker.getIsInMap()) {
        this.statisticsTracker.updateSubregion(subregion);
      } else {
        this.pendingSubregion = subregion;
      }
    }

    // Detect map changes and update state BEFORE processing items
    const mapChange = this.logParser.detectMapChange(line);

    if (mapChange.entering) {
      this.statisticsTracker.enterMap(this.pendingSubregion || subregion);
      this.pendingSubregion = null;
      this.inventoryTracker.resetMapBaseline();
    }

    if (mapChange.exiting) {
      this.statisticsTracker.exitMap();
    }

    // Process item changes with current map state
    // This ensures items are tracked with the correct isInMap state
    const changes = this.inventoryTracker.scanForChanges(line);
    if (changes.length > 0 && this.statisticsTracker.getIsInMap()) {
      this.statisticsTracker.processItemChanges(changes);
      this.emit('reshowDrops');
    }
  }


  /**
   * Update the log file path and restart monitoring if running.
   */
  setLogFilePath(logFilePath: string | null): void {
    const wasRunning = this.running;

    if (wasRunning) {
      this.stop();
    }

    this.logFilePath = logFilePath;

    if (wasRunning && logFilePath) {
      this.start();
    }
  }

  /**
   * Check if the monitor is running.
   */
  isRunning(): boolean {
    return this.running;
  }
}
