import { LogParser, BagModification } from './LogParser';
import { Logger } from './Logger';
import { MIN_BAG_ITEMS_FOR_INIT, MIN_BAG_ITEMS_LEGACY } from './constants';

const logger = Logger.getInstance();

interface ItemInstance {
  fullId: string;
  baseId: string;
  pageId: string;
  slotId: string;
  count: number;
}

export class InventoryTracker {
  private bagState: Map<string, number> = new Map();
  private bagInitialized: boolean = false;
  private initializationComplete: boolean = false;
  private awaitingInitialization: boolean = false;
  private initializationInProgress: boolean = false;
  private firstScan: boolean = true;

  // Phase 2: Sort detection
  private isInSortOperation: boolean = false;
  private sortBuffer: BagModification[] = [];

  // Phase 3: FullId-based tracking
  private itemInstances: Map<string, ItemInstance> = new Map();

  // Phase 4: Batch processing
  private changeBuffer: BagModification[] = [];
  private lastProcessTime: number = 0;
  private readonly BATCH_WINDOW_MS = 1000; // 1 second batch window

  constructor(private logParser: LogParser) {}

  reset(): void {
    this.bagState.clear();
    this.bagInitialized = false;
    this.initializationComplete = false;
    this.awaitingInitialization = false;
    this.initializationInProgress = false;
    this.firstScan = true;
    this.isInSortOperation = false;
    this.sortBuffer = [];
    this.itemInstances.clear();
    this.changeBuffer = [];
    this.lastProcessTime = 0;
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
    this.itemInstances.clear();
    const itemTotals = new Map<string, number>();

    for (const entry of itemChanges) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      this.bagState.set(slotKey, entry.count);

      const current = itemTotals.get(entry.configBaseId) || 0;
      itemTotals.set(entry.configBaseId, current + entry.count);

      // Store instance with fullId from ItemChange events
      if (entry.fullId) {
        this.itemInstances.set(entry.fullId, {
          fullId: entry.fullId,
          baseId: entry.configBaseId,
          pageId: entry.pageId,
          slotId: entry.slotId,
          count: entry.count,
        });
      }
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

  scanForChanges(text: string): Array<[string, number]> {
    // Handle initialization if awaiting
    if (this.awaitingInitialization) {
      const result = this.processInitialization(text);
      if (result.success) {
        return [];
      }
      // If initialization not complete, return empty (don't track until initialized)
      return [];
    }

    // If not initialized yet, return empty (requires manual initialization)
    if (!this.bagInitialized) {
      return [];
    }

    // Phase 2: Check for sort operations
    if (this.logParser.detectResetItemsLayoutStart(text)) {
      this.handleSortStart();
    }

    if (this.logParser.detectResetItemsLayoutEnd(text)) {
      return this.handleSortEnd(text);
    }

    // If in sort operation, buffer changes and return nothing
    if (this.isInSortOperation) {
      const itemChanges = this.logParser.extractItemChanges(text);
      this.sortBuffer.push(...itemChanges);
      return [];
    }

    // Phase 3 & 4: Use ItemChange@ events with fullId tracking
    // This is the ONLY tracking method - no fallbacks to broken slot-based logic
    const itemChanges = this.logParser.extractItemChanges(text);
    if (itemChanges.length > 0) {
      return this.processItemChangesWithFullId(itemChanges);
    }

    // No ItemChange@ events in this batch - return empty
    // (ItemChange@ should always be present when items change)
    return [];
  }

  /**
   * Phase 2: Handle sort operation start.
   */
  private handleSortStart(): void {
    this.isInSortOperation = true;
    this.sortBuffer = [];
    logger.info('Sort operation started - buffering changes');
  }

  /**
   * Phase 2: Handle sort operation end.
   * After sort, process buffered ItemChange@ events to update positions.
   */
  private handleSortEnd(text: string): Array<[string, number]> {
    logger.info('Sort operation ended - processing buffered changes');
    this.isInSortOperation = false;

    // Process buffered ItemChange events from the sort operation
    // These are just movements (slot changes), not quantity changes
    if (this.sortBuffer.length > 0) {
      logger.info(`Processing ${this.sortBuffer.length} buffered ItemChange events from sort`);

      // Update itemInstances with new positions
      for (const change of this.sortBuffer) {
        if (change.fullId) {
          this.itemInstances.set(change.fullId, {
            fullId: change.fullId,
            baseId: change.configBaseId,
            pageId: change.pageId,
            slotId: change.slotId,
            count: change.count,
          });

          // Update bagState
          const slotKey = `${change.pageId}:${change.slotId}:${change.configBaseId}`;
          this.bagState.set(slotKey, change.count);
        }
      }
    }

    // Process any ItemChange events that came after the sort end marker
    const postSortChanges = this.logParser.extractItemChanges(text);
    if (postSortChanges.length > 0) {
      logger.info(`Found ${postSortChanges.length} ItemChange events after sort end`);
      for (const change of postSortChanges) {
        if (change.fullId) {
          this.itemInstances.set(change.fullId, {
            fullId: change.fullId,
            baseId: change.configBaseId,
            pageId: change.pageId,
            slotId: change.slotId,
            count: change.count,
          });

          // Update bagState
          const slotKey = `${change.pageId}:${change.slotId}:${change.configBaseId}`;
          this.bagState.set(slotKey, change.count);
        }
      }
    }

    // Clear sort buffer
    this.sortBuffer = [];
    return [];
  }

  /**
   * Phase 3: Process ItemChange events with fullId tracking.
   * Detects movements vs real changes based on unique item instance IDs.
   */
  private processItemChangesWithFullId(changes: BagModification[]): Array<[string, number]> {
    const realChanges = new Map<string, number>();

    logger.debug(`Processing ${changes.length} ItemChange events with fullId tracking (${this.itemInstances.size} instances tracked)`);

    for (const change of changes) {
      if (!change.fullId) {
        logger.warn(`ItemChange event missing fullId: ${JSON.stringify(change)}`);
        continue; // Skip if no fullId
      }

      const previousInstance = this.itemInstances.get(change.fullId);

      if (change.action === 'Remove') {
        // Item removed completely
        if (previousInstance) {
          const netChange = realChanges.get(previousInstance.baseId) || 0;
          realChanges.set(previousInstance.baseId, netChange - previousInstance.count);
          this.itemInstances.delete(change.fullId);
          logger.debug(`Item removed: ${change.fullId} (${previousInstance.baseId}) x${previousInstance.count}`);
        }
      } else if (change.action === 'Add') {
        // New item added
        this.itemInstances.set(change.fullId, {
          fullId: change.fullId,
          baseId: change.configBaseId,
          pageId: change.pageId,
          slotId: change.slotId,
          count: change.count,
        });

        const netChange = realChanges.get(change.configBaseId) || 0;
        realChanges.set(change.configBaseId, netChange + change.count);
        logger.debug(`Item added: ${change.fullId} (${change.configBaseId}) x${change.count}`);
      } else if (change.action === 'Update') {
        if (previousInstance) {
          // Check if this is a movement or a quantity change
          const slotChanged = previousInstance.slotId !== change.slotId || previousInstance.pageId !== change.pageId;
          const countChanged = previousInstance.count !== change.count;

          if (slotChanged && !countChanged) {
            // Pure movement - ignore
            logger.debug(`Item moved: ${change.fullId} from slot ${previousInstance.slotId} to ${change.slotId} (no change)`);
          } else if (countChanged) {
            // Quantity changed (with or without movement)
            const delta = change.count - previousInstance.count;
            const netChange = realChanges.get(change.configBaseId) || 0;
            realChanges.set(change.configBaseId, netChange + delta);
            logger.debug(`Item quantity changed: ${change.fullId} (${change.configBaseId}) ${previousInstance.count} → ${change.count} (${delta > 0 ? '+' : ''}${delta})`);
          }

          // Update instance state
          this.itemInstances.set(change.fullId, {
            fullId: change.fullId,
            baseId: change.configBaseId,
            pageId: change.pageId,
            slotId: change.slotId,
            count: change.count,
          });
        } else {
          // First time seeing this fullId - might be replacing a synthetic one
          const slotKey = `${change.pageId}:${change.slotId}:${change.configBaseId}`;
          const previousCount = this.bagState.get(slotKey) || 0;

          // Check if there's a synthetic fullId for this slot (from InitBagData)
          const syntheticFullId = `${change.configBaseId}_init_${change.pageId}_${change.slotId}`;
          const syntheticInstance = this.itemInstances.get(syntheticFullId);

          if (syntheticInstance) {
            // Replace synthetic fullId with real one
            this.itemInstances.delete(syntheticFullId);
            logger.debug(`Replacing synthetic fullId ${syntheticFullId} with real fullId ${change.fullId}`);

            // Compare with synthetic instance count
            const delta = change.count - syntheticInstance.count;
            if (delta !== 0) {
              const netChange = realChanges.get(change.configBaseId) || 0;
              realChanges.set(change.configBaseId, netChange + delta);
              logger.debug(`Item count changed: ${change.fullId} (${change.configBaseId}) ${syntheticInstance.count} → ${change.count} (${delta > 0 ? '+' : ''}${delta})`);
            }
          } else {
            // No synthetic fullId - calculate delta from bagState
            const delta = change.count - previousCount;
            if (delta !== 0) {
              const netChange = realChanges.get(change.configBaseId) || 0;
              realChanges.set(change.configBaseId, netChange + delta);
              logger.debug(`Item tracked (first fullId): ${change.fullId} (${change.configBaseId}) ${previousCount} → ${change.count} (${delta > 0 ? '+' : ''}${delta})`);
            }
          }

          // Track this item instance going forward with real fullId
          this.itemInstances.set(change.fullId, {
            fullId: change.fullId,
            baseId: change.configBaseId,
            pageId: change.pageId,
            slotId: change.slotId,
            count: change.count,
          });
        }
      }
    }

    // Update bagState for compatibility with existing code
    for (const change of changes) {
      if (change.fullId) {
        const slotKey = `${change.pageId}:${change.slotId}:${change.configBaseId}`;
        if (change.action === 'Remove') {
          this.bagState.delete(slotKey);
        } else {
          this.bagState.set(slotKey, change.count);
        }
      }
    }

    // Convert to array and filter out zero changes
    const result: Array<[string, number]> = [];
    for (const [itemId, delta] of realChanges) {
      if (delta !== 0) {
        result.push([itemId, delta]);
      }
    }

    if (result.length > 0) {
      logger.info(`Detected ${result.length} real changes via fullId tracking: ${result.map(([id, amt]) => `${id}:${amt > 0 ? '+' : ''}${amt}`).join(', ')}`);
    }

    return result;
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
