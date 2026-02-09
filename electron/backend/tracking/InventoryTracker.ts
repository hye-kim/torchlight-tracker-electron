import { LogParser, BagModification } from '../game/LogParser';
import { Logger } from '../core/Logger';
import { FileManager } from '../data/FileManager';
import { MIN_BAG_ITEMS_FOR_INIT, MIN_BAG_ITEMS_LEGACY } from '../core/constants';

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
  private awaitingInitialization: boolean = false;
  private initializationInProgress: boolean = false;
  private firstScan: boolean = true;

  // Phase 2: Sort detection (for logging and safety)
  private isInSortOperation: boolean = false;
  private sortStartTime: number = 0;
  private readonly SORT_TIMEOUT_MS = 5000; // 5 seconds timeout for stuck sort state

  // Phase 3: FullId-based tracking
  private itemInstances: Map<string, ItemInstance> = new Map();

  constructor(
    private logParser: LogParser,
    private fileManager: FileManager
  ) {}

  /**
   * Normalize an item ID to its inventory form.
   * For legendary gear, converts baseItemId (pickup ID) to inventory ID.
   * For other items, returns the ID unchanged.
   */
  private normalizeItemId(itemId: string): string {
    const normalizer = this.fileManager.getItemIdNormalizer();
    return normalizer.toInventoryId(itemId);
  }

  isAwaitingInitialization(): boolean {
    return this.awaitingInitialization;
  }

  reset(): void {
    this.bagState.clear();
    this.bagInitialized = false;
    this.awaitingInitialization = false;
    this.initializationInProgress = false;
    this.firstScan = true;
    this.isInSortOperation = false;
    this.sortStartTime = 0;
    this.itemInstances.clear();
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

    // Use BagMgr@:InitBagData for initialization (provides complete inventory state for all pages)
    const bagData = this.logParser.extractBagData(text);

    if (bagData.length < MIN_BAG_ITEMS_FOR_INIT) {
      return { success: false };
    }

    logger.info(`Found ${bagData.length} BagMgr@:InitBagData entries - initializing`);

    this.bagState.clear();
    this.itemInstances.clear();
    const itemTotals = new Map<string, number>();

    for (const entry of bagData) {
      // Normalize item ID (convert legendary baseItemId to inventory ID)
      const normalizedId = this.normalizeItemId(entry.configBaseId);

      const slotKey = `${entry.pageId}:${entry.slotId}:${normalizedId}`;
      this.bagState.set(slotKey, entry.count);

      const current = itemTotals.get(normalizedId) ?? 0;
      itemTotals.set(normalizedId, current + entry.count);

      // Store instance with synthetic fullId (will be replaced when real ItemChange@ appears)
      if (entry.fullId) {
        this.itemInstances.set(entry.fullId, {
          fullId: entry.fullId,
          baseId: normalizedId,
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
    this.awaitingInitialization = false;
    this.initializationInProgress = false;

    logger.info(
      `Initialization complete: ${itemTotals.size} unique items, ${bagData.length} inventory slots (all pages)`
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
        // Normalize item ID (convert legendary baseItemId to inventory ID)
        const normalizedId = this.normalizeItemId(entry.configBaseId);

        const slotKey = `${entry.pageId}:${entry.slotId}:${normalizedId}`;
        this.bagState.set(slotKey, entry.count);

        const current = itemTotals.get(normalizedId) ?? 0;
        itemTotals.set(normalizedId, current + entry.count);
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

    // Check for stuck sort state and auto-recover
    if (this.isInSortOperation) {
      const now = Date.now();
      if (now - this.sortStartTime > this.SORT_TIMEOUT_MS) {
        logger.warn(
          `Sort operation timed out after ${this.SORT_TIMEOUT_MS}ms - auto-recovering from stuck state`
        );
        this.isInSortOperation = false;
        this.sortStartTime = 0;
      }
    }

    // Detect sort operations for logging purposes
    if (this.logParser.detectResetItemsLayoutStart(text)) {
      this.isInSortOperation = true;
      this.sortStartTime = Date.now();
      logger.info('Sort operation started - continuing to track item changes normally');
    }

    if (this.logParser.detectResetItemsLayoutEnd(text)) {
      logger.info('Sort operation ended');
      this.isInSortOperation = false;
      this.sortStartTime = 0;
    }

    // Process all ItemChange@ events normally, regardless of sort state
    // The fullId-based tracking already distinguishes movements from quantity changes
    const itemChanges = this.logParser.extractItemChanges(text);
    if (itemChanges.length > 0) {
      return this.processItemChangesWithFullId(itemChanges);
    }

    // No ItemChange@ events in this batch - return empty
    return [];
  }

  /**
   * Phase 3: Process ItemChange events with fullId tracking.
   * Detects movements vs real changes based on unique item instance IDs.
   */
  private processItemChangesWithFullId(changes: BagModification[]): Array<[string, number]> {
    const realChanges = new Map<string, number>();
    const affectedPages = new Set<string>();

    logger.debug(
      `Processing ${changes.length} ItemChange events with fullId tracking (${this.itemInstances.size} instances tracked)`
    );

    for (const change of changes) {
      if (!change.fullId) {
        logger.warn(`ItemChange event missing fullId: ${JSON.stringify(change)}`);
        continue; // Skip if no fullId
      }

      // Normalize item ID (convert legendary baseItemId to inventory ID)
      const normalizedId = this.normalizeItemId(change.configBaseId);
      if (normalizedId !== change.configBaseId) {
        logger.debug(
          `Normalized legendary item ID: ${change.configBaseId} -> ${normalizedId} for ${change.action} event`
        );
      }

      // Track which pages are affected by this batch
      affectedPages.add(change.pageId);

      const previousInstance = this.itemInstances.get(change.fullId);

      if (change.action === 'Remove') {
        // Item removed completely
        if (previousInstance) {
          const netChange = realChanges.get(previousInstance.baseId) ?? 0;
          realChanges.set(previousInstance.baseId, netChange - previousInstance.count);
          this.itemInstances.delete(change.fullId);
          logger.debug(
            `Item removed: ${change.fullId} (${previousInstance.baseId}) x${previousInstance.count}`
          );
        } else {
          // No previousInstance - use bagState as fallback
          const slotKey = `${change.pageId}:${change.slotId}:${normalizedId}`;
          const previousCount = this.bagState.get(slotKey) ?? 0;
          if (previousCount > 0) {
            const netChange = realChanges.get(normalizedId) ?? 0;
            realChanges.set(normalizedId, netChange - previousCount);
            logger.debug(
              `Item removed (no instance): ${change.fullId} (${normalizedId}) x${previousCount} from bagState`
            );
          }
        }
      } else if (change.action === 'Add') {
        // New item added
        if (previousInstance) {
          // Unexpected: Add for an item we're already tracking
          // Treat as an Update instead
          logger.warn(`Add event for existing fullId: ${change.fullId} - treating as Update`);
          const delta = change.count - previousInstance.count;
          if (delta !== 0) {
            const netChange = realChanges.get(normalizedId) ?? 0;
            realChanges.set(normalizedId, netChange + delta);
            logger.debug(
              `Item count changed (Add as Update): ${change.fullId} (${normalizedId}) ${previousInstance.count} → ${change.count} (${delta > 0 ? '+' : ''}${delta})`
            );
          }
        } else {
          // Normal Add - new item
          const netChange = realChanges.get(normalizedId) ?? 0;
          realChanges.set(normalizedId, netChange + change.count);
          logger.debug(`Item added: ${change.fullId} (${normalizedId}) x${change.count}`);
        }

        // Update itemInstances regardless (store normalized ID as baseId)
        this.itemInstances.set(change.fullId, {
          fullId: change.fullId,
          baseId: normalizedId,
          pageId: change.pageId,
          slotId: change.slotId,
          count: change.count,
        });
      } else if (change.action === 'Update') {
        if (previousInstance) {
          // Check if this is a movement or a quantity change
          const slotChanged =
            previousInstance.slotId !== change.slotId || previousInstance.pageId !== change.pageId;
          const countChanged = previousInstance.count !== change.count;

          if (slotChanged && !countChanged) {
            // Pure movement - ignore
            logger.debug(
              `Item moved: ${change.fullId} from slot ${previousInstance.slotId} to ${change.slotId} (no change)`
            );
          } else if (countChanged) {
            // Quantity changed (with or without movement)
            const delta = change.count - previousInstance.count;
            const netChange = realChanges.get(normalizedId) ?? 0;
            realChanges.set(normalizedId, netChange + delta);
            logger.debug(
              `Item quantity changed: ${change.fullId} (${normalizedId}) ${previousInstance.count} → ${change.count} (${delta > 0 ? '+' : ''}${delta})`
            );
          }

          // Update instance state (store normalized ID as baseId)
          this.itemInstances.set(change.fullId, {
            fullId: change.fullId,
            baseId: normalizedId,
            pageId: change.pageId,
            slotId: change.slotId,
            count: change.count,
          });
        } else {
          // First time seeing this fullId - might be replacing a synthetic one or from sorting
          // Check if there's a synthetic fullId for this slot (from InitBagData)
          const syntheticFullId = `${normalizedId}_init_${change.pageId}_${change.slotId}`;
          const syntheticInstance = this.itemInstances.get(syntheticFullId);

          if (syntheticInstance) {
            // Replace synthetic fullId with real one
            this.itemInstances.delete(syntheticFullId);
            logger.debug(
              `Replacing synthetic fullId ${syntheticFullId} with real fullId ${change.fullId}`
            );

            // Compare with synthetic instance count
            const delta = change.count - syntheticInstance.count;
            if (delta !== 0) {
              const netChange = realChanges.get(normalizedId) ?? 0;
              realChanges.set(normalizedId, netChange + delta);
              logger.debug(
                `Item count changed: ${change.fullId} (${normalizedId}) ${syntheticInstance.count} → ${change.count} (${delta > 0 ? '+' : ''}${delta})`
              );
            }
          } else {
            // New fullId without synthetic - likely from sorting or lost tracking
            // Don't calculate delta because we don't know where this came from
            logger.debug(
              `Tracking new fullId without previous instance: ${change.fullId} (${normalizedId}) x${change.count} in slot ${change.slotId}`
            );
          }

          // Track this item instance going forward with real fullId (store normalized ID as baseId)
          this.itemInstances.set(change.fullId, {
            fullId: change.fullId,
            baseId: normalizedId,
            pageId: change.pageId,
            slotId: change.slotId,
            count: change.count,
          });
        }
      }
    }

    // Reconcile bagState with itemInstances to ensure consistency
    // Only clear and rebuild the pages that were affected in this batch
    // This preserves data from other pages that weren't sorted
    const keysToDelete: string[] = [];
    for (const [key] of this.bagState) {
      if (!key.startsWith('init:')) {
        // Check if this slot belongs to an affected page
        const parts = key.split(':');
        const pageId = parts[0];
        if (pageId && affectedPages.has(pageId)) {
          keysToDelete.push(key);
        }
      }
    }
    for (const key of keysToDelete) {
      this.bagState.delete(key);
    }

    // Rebuild bagState from itemInstances for affected pages only
    for (const [fullId, instance] of this.itemInstances) {
      // Skip synthetic init entries
      if (fullId.includes('_init_')) {
        continue;
      }
      // Only rebuild slots for affected pages
      if (affectedPages.has(instance.pageId)) {
        const slotKey = `${instance.pageId}:${instance.slotId}:${instance.baseId}`;
        this.bagState.set(slotKey, instance.count);
      }
    }

    logger.debug(
      `Reconciled bagState for pages [${Array.from(affectedPages).join(', ')}]: ${keysToDelete.length} old slots cleared`
    );

    // Convert to array and filter out zero changes
    const result: Array<[string, number]> = [];
    for (const [itemId, delta] of realChanges) {
      if (delta !== 0) {
        result.push([itemId, delta]);
      }
    }

    if (result.length > 0) {
      logger.info(
        `Detected ${result.length} real changes via fullId tracking: ${result.map(([id, amt]) => `${id}:${amt > 0 ? '+' : ''}${amt}`).join(', ')}`
      );
    }

    return result;
  }

  resetMapBaseline(): number {
    const itemTotals = new Map<string, number>();

    // Calculate totals by summing all slots for each itemId
    for (const [key, value] of this.bagState) {
      if (!key.startsWith('init:') && key.includes(':')) {
        const parts = key.split(':');
        if (parts.length === 3 && parts[2]) {
          const itemId = parts[2];
          itemTotals.set(itemId, (itemTotals.get(itemId) ?? 0) + value);
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
      // Skip init: entries as they are baseline/reference values, not actual inventory
      if (key.startsWith('init:')) {
        continue;
      }

      let itemId: string;

      if (key.includes(':')) {
        const parts = key.split(':');
        if (parts.length === 3 && parts[2]) {
          // Format: pageId:slotId:configBaseId
          itemId = parts[2];
        } else {
          itemId = key;
        }
      } else {
        itemId = key;
      }

      grouped[itemId] = (grouped[itemId] ?? 0) + amount;
    }

    return grouped;
  }
}
