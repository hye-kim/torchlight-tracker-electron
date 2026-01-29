import { LogParser, BagModification } from './LogParser';
import { Logger } from './Logger';

const logger = Logger.getInstance();
const MIN_BAG_ITEMS_FOR_INIT = 20;
const MIN_BAG_ITEMS_LEGACY = 10;

export class InventoryTracker {
  private bagState: Map<string, number> = new Map();
  private bagInitialized: boolean = false;
  private initializationComplete: boolean = false;
  private awaitingInitialization: boolean = false;
  private initializationInProgress: boolean = false;
  private firstScan: boolean = true;

  constructor(private logParser: LogParser) {}

  reset(): void {
    this.bagState.clear();
    this.bagInitialized = false;
    this.initializationComplete = false;
    this.awaitingInitialization = false;
    this.initializationInProgress = false;
    this.firstScan = true;
    logger.info('Inventory tracker reset');
  }

  startInitialization(): boolean {
    if (this.initializationInProgress) {
      logger.warn('Initialization already in progress');
      return false;
    }

    this.awaitingInitialization = true;
    this.initializationInProgress = true;
    logger.info('Initialization started - waiting for bag update');
    return true;
  }

  processInitialization(text: string): { success: boolean; itemCount?: number } {
    if (!this.awaitingInitialization) {
      return { success: false };
    }

    const itemChanges = this.logParser.extractItemChanges(text);

    if (itemChanges.length < MIN_BAG_ITEMS_FOR_INIT) {
      return { success: false };
    }

    logger.info(`Found ${itemChanges.length} ItemChange entries - initializing`);

    this.bagState.clear();
    const itemTotals = new Map<string, number>();

    for (const entry of itemChanges) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      this.bagState.set(slotKey, entry.count);

      const current = itemTotals.get(entry.configBaseId) || 0;
      itemTotals.set(entry.configBaseId, current + entry.count);
    }

    // Store initial totals as baseline
    for (const [itemId, total] of itemTotals) {
      this.bagState.set(`init:${itemId}`, total);
    }

    this.bagInitialized = true;
    this.initializationComplete = true;
    this.awaitingInitialization = false;
    this.initializationInProgress = false;

    logger.info(
      `Initialization complete: ${itemTotals.size} unique items, ${itemChanges.length} inventory slots`
    );

    return { success: true, itemCount: itemTotals.size };
  }

  initializeBagStateLegacy(text: string): boolean {
    if (!this.firstScan) {
      return false;
    }

    this.firstScan = false;

    if (this.logParser.detectPlayerLogin(text)) {
      logger.info('Detected player login - resetting bag state');
      this.bagState.clear();
      return true;
    }

    const itemChanges = this.logParser.extractItemChanges(text);

    if (itemChanges.length > MIN_BAG_ITEMS_LEGACY) {
      logger.info(`Found ${itemChanges.length} ItemChange events - initializing (legacy)`);

      const itemTotals = new Map<string, number>();

      for (const entry of itemChanges) {
        const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
        this.bagState.set(slotKey, entry.count);

        const current = itemTotals.get(entry.configBaseId) || 0;
        itemTotals.set(entry.configBaseId, current + entry.count);
      }

      // Store initial totals as baseline
      for (const [itemId, total] of itemTotals) {
        this.bagState.set(`init:${itemId}`, total);
      }

      this.bagInitialized = true;
      return true;
    }

    return false;
  }

  detectBagChanges(text: string): Array<[string, number]> {
    if (!this.bagInitialized) {
      return [];
    }

    const itemChanges = this.logParser.extractItemChanges(text);
    if (itemChanges.length === 0) {
      return [];
    }

    const changes: Array<[string, number]> = [];

    // Update bagState with all ItemChange events
    for (const entry of itemChanges) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      this.bagState.set(slotKey, entry.count);
    }

    // Calculate current totals and compare with baseline
    const modifiedItems = new Set<string>();
    for (const entry of itemChanges) {
      modifiedItems.add(entry.configBaseId);
    }

    for (const itemId of modifiedItems) {
      const initKey = `init:${itemId}`;
      const baselineTotal = this.bagState.get(initKey) || 0;

      // Calculate current total by summing ALL slots for this itemId
      let currentTotal = 0;
      for (const [key, value] of this.bagState) {
        if (!key.startsWith('init:') && key.endsWith(`:${itemId}`)) {
          currentTotal += value;
        }
      }

      const netChange = currentTotal - baselineTotal;

      if (netChange !== 0) {
        changes.push([itemId, netChange]);
        // Update baseline to current total
        this.bagState.set(initKey, currentTotal);
      }
    }

    return changes;
  }

  scanForChanges(text: string): Array<[string, number]> {
    // Handle initialization if awaiting
    if (this.awaitingInitialization) {
      const result = this.processInitialization(text);
      if (result.success) {
        return [];
      }
    }

    // If initialized and complete, detect changes
    if (this.bagInitialized && this.initializationComplete) {
      return this.detectBagChanges(text);
    }

    // Try legacy initialization if not initialized
    if (!this.bagInitialized) {
      if (this.initializeBagStateLegacy(text)) {
        return [];
      }
    }

    // Fallback: simple detection without initialization
    return this.detectChangesWithoutInit(text);
  }

  private detectChangesWithoutInit(text: string): Array<[string, number]> {
    const itemChanges = this.logParser.extractItemChanges(text);
    if (itemChanges.length === 0) {
      return [];
    }

    const changes: Array<[string, number]> = [];

    // Calculate previous totals by summing all slots per itemId
    const previousTotals = new Map<string, number>();
    for (const [slotKey, qty] of this.bagState) {
      if (!slotKey.startsWith('init:')) {
        const parts = slotKey.split(':');
        if (parts.length === 3) {
          const itemId = parts[2];
          previousTotals.set(itemId, (previousTotals.get(itemId) || 0) + qty);
        }
      }
    }

    // Update bagState with all ItemChange events
    const modifiedItems = new Set<string>();
    for (const entry of itemChanges) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      this.bagState.set(slotKey, entry.count);
      modifiedItems.add(entry.configBaseId);
    }

    // Calculate current totals by summing all slots per itemId
    const currentTotals = new Map<string, number>();
    for (const [slotKey, qty] of this.bagState) {
      if (!slotKey.startsWith('init:')) {
        const parts = slotKey.split(':');
        if (parts.length === 3) {
          const itemId = parts[2];
          currentTotals.set(itemId, (currentTotals.get(itemId) || 0) + qty);
        }
      }
    }

    // Track ALL changes (both increases and decreases) for modified items
    // Positive = drops, Negative = costs
    for (const itemId of modifiedItems) {
      const currentTotal = currentTotals.get(itemId) || 0;
      const previousTotal = previousTotals.get(itemId) || 0;
      const change = currentTotal - previousTotal;
      if (change !== 0) {
        changes.push([itemId, change]);
      }
    }

    return changes;
  }

  resetMapBaseline(): number {
    const itemTotals = new Map<string, number>();

    // Calculate totals by summing all slots for each itemId
    for (const [key, value] of this.bagState) {
      if (!key.startsWith('init:') && key.includes(':')) {
        const parts = key.split(':');
        if (parts.length === 3) {
          const itemId = parts[2];
          itemTotals.set(itemId, (itemTotals.get(itemId) || 0) + value);
        }
      }
    }

    // Update baselines
    for (const [itemId, total] of itemTotals) {
      this.bagState.set(`init:${itemId}`, total);
    }

    logger.info(`Reset map baseline for ${itemTotals.size} items`);
    return itemTotals.size;
  }

  getBagStateSummary(): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const [key, amount] of this.bagState) {
      let itemId: string;

      if (key.startsWith('init:')) {
        itemId = key.split(':')[1];
      } else if (key.includes(':') && key.split(':').length === 3) {
        itemId = key.split(':')[2];
      } else {
        itemId = key;
      }

      grouped[itemId] = (grouped[itemId] || 0) + amount;
    }

    return grouped;
  }
}
