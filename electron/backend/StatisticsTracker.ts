/**
 * Statistics tracking for the Torchlight Infinite Price Tracker.
 * Manages drop statistics, income calculations, and map tracking.
 */

import { EventEmitter } from 'events';
import { FileManager, ItemData } from './FileManager';
import { ConfigManager } from './ConfigManager';
import { calculatePriceWithTax } from './constants';
import { Logger } from './Logger';

const logger = Logger.getInstance();

export interface ProcessedItem {
  itemId: string;
  itemName: string;
  amount: number;
  price: number;
}

export interface MapStats {
  drops: Record<string, number>;
  income: number;
  duration: number;
  incomePerMinute: number;
}

export interface TotalStats {
  drops: Record<string, number>;
  income: number;
  duration: number;
  mapCount: number;
  incomePerMinute: number;
}

export interface MapItemData {
  itemId: string;
  quantity: number;
}

export interface MapLog {
  mapNumber: number;
  mapName: string;
  startTime: number;
  revenue: number;
  cost: number;
  profit: number;
  duration: number;
  drops: MapItemData[];
  costs: MapItemData[];
}

export class StatisticsTracker extends EventEmitter {
  private isInMap: boolean = false;
  private mapStartTime: number = Date.now();
  private totalTime: number = 0.0;
  private mapCount: number = 0;

  private dropList: Map<string, number> = new Map();
  private dropListAll: Map<string, number> = new Map();
  private costList: Map<string, number> = new Map();
  private income: number = 0.0;
  private incomeAll: number = 0.0;
  private currentMapCost: number = 0.0;

  private excludeList: Set<string> = new Set();
  private pendingItems: Map<string, number> = new Map();

  // Map log tracking
  private mapLogs: MapLog[] = [];
  private currentMapName: string = '';
  private currentSubregion: string | null = null;

  constructor(
    private fileManager: FileManager,
    private configManager: ConfigManager
  ) {
    super();
  }

  /**
   * Reset all statistics.
   */
  reset(): void {
    this.dropList.clear();
    this.dropListAll.clear();
    this.costList.clear();
    this.income = 0.0;
    this.incomeAll = 0.0;
    this.currentMapCost = 0.0;
    this.totalTime = 0.0;
    this.mapCount = 0;
    this.isInMap = false;
    this.mapStartTime = Date.now();
    this.pendingItems.clear();
    this.mapLogs = [];
    this.currentMapName = '';
    this.currentSubregion = null;
    logger.info('Statistics reset');
    this.emit('reset');
  }

  /**
   * Mark entering a map.
   * @param subregion Optional formatted subregion name (e.g., "7-0 Steel Forge")
   */
  enterMap(subregion?: string | null): void {
    this.isInMap = true;
    this.mapStartTime = Date.now();
    this.dropList.clear();
    this.costList.clear();
    this.income = 0.0;
    this.currentMapCost = 0.0;
    this.mapCount += 1;

    // Store subregion and set map name
    if (subregion) {
      this.currentSubregion = subregion;
      this.currentMapName = subregion;
      logger.info(`Entered ${subregion} (Map #${this.mapCount})`);
    } else if (this.currentSubregion) {
      this.currentMapName = this.currentSubregion;
      logger.info(`Entered ${this.currentSubregion} (Map #${this.mapCount})`);
    } else {
      this.currentMapName = `Map ${this.mapCount}`;
      logger.info(`Entered map #${this.mapCount}`);
    }
    this.emit('enterMap', this.mapCount);
  }

  /**
   * Update the current subregion name.
   * @param subregion Formatted subregion name (e.g., "7-0 Steel Forge")
   */
  updateSubregion(subregion: string): void {
    if (this.currentSubregion !== subregion) {
      this.currentSubregion = subregion;
      this.currentMapName = subregion;
      logger.info(`Subregion: ${subregion}`);
    }
  }

  /**
   * Mark exiting a map.
   */
  exitMap(): void {
    if (this.isInMap) {
      const duration = (Date.now() - this.mapStartTime) / 1000;
      this.totalTime += duration;

      // Capture current drops and costs for this map
      const mapDrops: MapItemData[] = [];
      for (const [itemId, quantity] of this.dropList) {
        mapDrops.push({ itemId, quantity });
      }

      const mapCosts: MapItemData[] = [];
      for (const [itemId, quantity] of this.costList) {
        mapCosts.push({ itemId, quantity });
      }

      // Create map log entry with drops and costs
      const mapLog: MapLog = {
        mapNumber: this.mapCount,
        mapName: this.currentMapName,
        startTime: this.mapStartTime,
        revenue: this.income,
        cost: this.currentMapCost,
        profit: this.income - this.currentMapCost,
        duration,
        drops: mapDrops,
        costs: mapCosts,
      };
      this.mapLogs.push(mapLog);

      this.isInMap = false;
      logger.info(`Exited map (duration: ${duration.toFixed(1)}s, profit: ${mapLog.profit.toFixed(2)} FE)`);
      this.emit('exitMap', duration);
      this.emit('mapCompleted', mapLog);
    }
  }

  /**
   * Process item changes and update statistics.
   */
  processItemChanges(changes: Array<[string, number]>): ProcessedItem[] {
    const fullTable = this.fileManager.loadFullTable();
    const processed: ProcessedItem[] = [];

    // Consolidate changes for the same item
    const consolidated = new Map<string, number>();
    for (const [itemId, amount] of changes) {
      const id = String(itemId);
      consolidated.set(id, (consolidated.get(id) || 0) + amount);
    }

    // Process each consolidated change
    for (const [itemId, amount] of consolidated) {
      const result = this.processSingleItemChange(itemId, amount, fullTable);
      if (result) {
        processed.push(result);
      }
    }

    if (processed.length > 0) {
      this.emit('itemsProcessed', processed);
    }

    return processed;
  }

  /**
   * Process a single item change.
   */
  private processSingleItemChange(
    itemId: string,
    amount: number,
    fullTable: Record<string, ItemData>
  ): ProcessedItem | null {
    // Get item name - ensure it's always a string
    let itemName: string;
    if (fullTable[itemId]) {
      const itemData = fullTable[itemId];
      // Try multiple name fields and ensure we get a string
      let rawName = itemData.name || itemData.name_en || null;

      // If rawName is an object (shouldn't happen), try to extract string value
      if (rawName && typeof rawName === 'object') {
        logger.warn(`Item ${itemId} has object as name, attempting to extract string`);
        rawName = (rawName as any).name_en || (rawName as any).name || null;
      }

      itemName = (typeof rawName === 'string' ? rawName : null) || `Unknown item (ID: ${itemId})`;
    } else {
      itemName = `Unknown item (ID: ${itemId})`;
      if (!this.pendingItems.has(itemId)) {
        logger.warn(`Unknown item ID: ${itemId}`);
        this.pendingItems.set(itemId, amount);
      } else {
        this.pendingItems.set(itemId, this.pendingItems.get(itemId)! + amount);
      }
      return null;
    }

    // Check if excluded
    if (this.excludeList.has(itemName)) {
      logger.debug(`Excluded: ${itemName} x${amount}`);
      return null;
    }

    // Update drop lists or cost lists based on amount
    if (amount > 0) {
      // Positive = loot/drops
      this.dropList.set(itemId, (this.dropList.get(itemId) || 0) + amount);
      this.dropListAll.set(itemId, (this.dropListAll.get(itemId) || 0) + amount);
    } else {
      // Negative = costs (items consumed)
      this.costList.set(itemId, (this.costList.get(itemId) || 0) + Math.abs(amount));
    }

    // Calculate price
    let price = 0.0;
    if (fullTable[itemId]) {
      const basePrice = fullTable[itemId].price || 0.0;
      // Apply tax if enabled using centralized calculation
      const taxEnabled = this.configManager.getTaxMode() === 1;
      price = calculatePriceWithTax(basePrice, itemId, taxEnabled);

      if (amount > 0) {
        // Positive = income (loot)
        this.income += price * amount;
        this.incomeAll += price * amount;
      } else {
        // Negative = cost
        this.currentMapCost += price * Math.abs(amount);
      }
    }

    // Log to file
    this.logItemChange(itemName, amount, price);

    // Log to console
    if (amount > 0) {
      logger.info(`Drop: ${itemName} x${amount} (${price.toFixed(3)}/each)`);
    } else {
      logger.info(`Consumed: ${itemName} x${Math.abs(amount)} (${price.toFixed(3)}/each)`);
    }

    return {
      itemId,
      itemName,
      amount,
      price,
    };
  }

  /**
   * Log item change to drop log file.
   */
  private logItemChange(itemName: string, amount: number, price: number): void {
    let message: string;
    if (amount > 0) {
      message = `Drop: ${itemName} x${amount} (${price.toFixed(3)}/each)`;
    } else {
      message = `Consumed: ${itemName} x${Math.abs(amount)} (${price.toFixed(3)}/each)`;
    }

    this.fileManager.logDrop(itemName, amount, price);
  }

  /**
   * Get statistics for the current map.
   */
  getCurrentMapStats(): MapStats {
    const duration = this.isInMap ? (Date.now() - this.mapStartTime) / 1000 : 0;

    const drops: Record<string, number> = {};
    for (const [itemId, count] of this.dropList) {
      drops[itemId] = count;
    }

    return {
      drops,
      income: this.income,
      duration,
      incomePerMinute: duration > 0 ? this.income / (duration / 60) : 0,
    };
  }

  /**
   * Get total statistics across all maps.
   */
  getTotalStats(): TotalStats {
    let totalTime = this.totalTime;
    if (this.isInMap) {
      totalTime += (Date.now() - this.mapStartTime) / 1000;
    }

    const drops: Record<string, number> = {};
    for (const [itemId, count] of this.dropListAll) {
      drops[itemId] = count;
    }

    return {
      drops,
      income: this.incomeAll,
      duration: totalTime,
      mapCount: this.mapCount,
      incomePerMinute: totalTime > 0 ? this.incomeAll / (totalTime / 60) : 0,
    };
  }

  /**
   * Format seconds as "Xm Ys" string.
   * @deprecated Use formatDuration from constants module instead.
   */
  getFormattedTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m${s}s`;
  }

  /**
   * Set the exclude list for filtering items.
   */
  setExcludeList(excludeList: string[]): void {
    this.excludeList = new Set(excludeList);
  }

  /**
   * Get the current map number.
   */
  getMapCount(): number {
    return this.mapCount;
  }

  /**
   * Check if currently in a map.
   */
  getIsInMap(): boolean {
    return this.isInMap;
  }

  /**
   * Set whether currently in a map (for external control).
   */
  setIsInMap(isInMap: boolean): void {
    this.isInMap = isInMap;
  }

  /**
   * Get map logs (history of completed maps).
   */
  getMapLogs(): MapLog[] {
    return this.mapLogs;
  }

  /**
   * Get current map costs as an array.
   */
  getCurrentCosts(): Array<{ itemId: string; quantity: number }> {
    const costs: Array<{ itemId: string; quantity: number }> = [];
    for (const [itemId, quantity] of this.costList) {
      costs.push({ itemId, quantity });
    }
    return costs;
  }

  /**
   * Get current map drops as an array.
   */
  getCurrentDrops(): Array<{ itemId: string; quantity: number }> {
    const drops: Array<{ itemId: string; quantity: number }> = [];
    for (const [itemId, quantity] of this.dropList) {
      drops.push({ itemId, quantity });
    }
    return drops;
  }

  /**
   * Get current map data for displaying the active map in the UI.
   */
  getCurrentMapData(): MapLog | null {
    if (!this.isInMap) {
      return null;
    }

    const duration = (Date.now() - this.mapStartTime) / 1000;

    // Get current drops and costs
    const currentDrops: MapItemData[] = [];
    for (const [itemId, quantity] of this.dropList) {
      currentDrops.push({ itemId, quantity });
    }

    const currentCosts: MapItemData[] = [];
    for (const [itemId, quantity] of this.costList) {
      currentCosts.push({ itemId, quantity });
    }

    return {
      mapNumber: this.mapCount,
      mapName: this.currentMapName,
      startTime: this.mapStartTime,
      revenue: this.income,
      cost: this.currentMapCost,
      profit: this.income - this.currentMapCost,
      duration,
      drops: currentDrops,
      costs: currentCosts,
    };
  }
}
