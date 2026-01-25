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
  LOG_BATCH_INTERVAL,
  LOG_BATCH_SIZE,
  LOG_FILE_REOPEN_INTERVAL,
  LOG_FILE_ROTATION_MAX_RETRIES,
  LOG_FILE_ROTATION_RETRY_DELAY,
  LOG_POLL_INTERVAL,
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

  // Message batching
  private messageQueue: string[] = [];
  private batchProcessing: boolean = false;
  private lastBatchTime: number = Date.now();

  // Polling interval handle
  private pollIntervalHandle: NodeJS.Timeout | null = null;

  // Pending subregion for map entry
  private pendingSubregion: string | null = null;

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

    // Process any remaining messages in queue before shutdown
    if (this.messageQueue.length > 0) {
      logger.info(`Processing ${this.messageQueue.length} remaining messages before shutdown`);
      try {
        const text = this.messageQueue.join('\n');
        this.processLogText(text);
      } catch (error) {
        logger.error(`Error processing remaining messages: ${error}`);
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

      // Read and queue log file lines for batch processing
      const text = this.readLogFile();
      if (text) {
        this.queueLogLines(text);
      }

      // Process any remaining messages in queue
      if (this.messageQueue.length > 0 && !this.batchProcessing) {
        const now = Date.now();
        if (now - this.lastBatchTime >= LOG_BATCH_INTERVAL * 1000) {
          this.processMessageBatch();
        }
      }

      // Update display with current stats, drops, costs, and map logs
      const currentStats = this.statisticsTracker.getCurrentMapStats();
      const totalStats = this.statisticsTracker.getTotalStats();
      const fullTable = this.fileManager.loadFullTable();
      const itemMapping = this.fileManager.loadJson<Record<string, { id: string; img?: string; name_en?: string; type_en?: string }>>('comprehensive_item_mapping.json', {});

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
            feIncome: currentStats.income,
            incomePerMinute: currentStats.incomePerMinute,
          },
          total: {
            mapCount: totalStats.mapCount,
            duration: totalStats.duration,
            feIncome: totalStats.income,
            incomePerMinute: totalStats.incomePerMinute,
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
   * Add log lines to the processing queue with noise filtering.
   */
  private queueLogLines(text: string): void {
    if (!text) {
      return;
    }

    // Split into lines and filter noise
    const lines = text.split('\n');
    for (const line of lines) {
      if (this.logParser.shouldProcessLine(line)) {
        this.messageQueue.push(line);
      }
    }

    // Process batch if queue is large enough or enough time has passed
    const now = Date.now();
    const shouldProcessBySize = this.messageQueue.length >= LOG_BATCH_SIZE;
    const shouldProcessByTime = now - this.lastBatchTime >= LOG_BATCH_INTERVAL * 1000;

    if (shouldProcessBySize || shouldProcessByTime) {
      this.processMessageBatch();
    }
  }

  /**
   * Process queued messages in a batch for better performance.
   */
  private processMessageBatch(): void {
    if (this.batchProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.batchProcessing = true;
    this.lastBatchTime = Date.now();

    try {
      // Get batch of messages to process
      const batchSize = Math.min(this.messageQueue.length, LOG_BATCH_SIZE);
      const batch = this.messageQueue.splice(0, batchSize);

      // Combine batch into single text block for processing
      const text = batch.join('\n');

      // Process the batch
      this.processLogText(text);

      logger.debug(
        `Processed batch of ${batchSize} lines, ${this.messageQueue.length} remaining in queue`
      );
    } catch (error) {
      logger.error(`Error processing message batch: ${error}`);
    } finally {
      this.batchProcessing = false;
    }
  }

  /**
   * Process new log text.
   */
  private async processLogText(text: string): Promise<void> {
    // Update prices
    const pricesUpdated = await this.logParser.updatePricesInTable(text);

    // If prices were updated, recalculate income/costs and refresh the drops display
    if (pricesUpdated > 0) {
      this.statisticsTracker.recalculateIncomeAndCosts();
      this.emit('reshowDrops');
    }

    // Check for initialization completion
    if (this.inventoryTracker['awaitingInitialization']) {
      const result = this.inventoryTracker.processInitialization(text);
      if (result.success && result.itemCount) {
        this.emit('initializationComplete', result.itemCount);
      }
    }

    // Detect subregion entry (before map change detection so we can use it)
    const subregion = this.logParser.detectSubregionEntry(text);
    if (subregion) {
      // Update subregion for current map or store for upcoming map entry
      if (this.statisticsTracker.getIsInMap()) {
        this.statisticsTracker.updateSubregion(subregion);
      } else {
        // Store for upcoming map entry
        this.pendingSubregion = subregion;
      }
    }

    // Detect map changes
    const mapChange = this.logParser.detectMapChange(text);

    if (mapChange.entering) {
      // Use pending subregion if available
      this.statisticsTracker.enterMap(this.pendingSubregion || subregion);
      this.pendingSubregion = null;
      this.inventoryTracker.resetMapBaseline();
    }

    if (mapChange.exiting) {
      this.statisticsTracker.exitMap();
    }

    // Detect item changes - only process if we're actually in a map
    // This prevents false positives from inventory sorting, buying/selling items outside maps
    const changes = this.inventoryTracker.scanForChanges(text);
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
