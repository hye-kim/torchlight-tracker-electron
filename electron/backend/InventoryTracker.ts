import { LogParser, BagModification } from './LogParser';
import { Logger } from './Logger';

const logger = Logger.getInstance();
const MIN_BAG_ITEMS_FOR_INIT = 20;
const MIN_BAG_ITEMS_LEGACY = 10;

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

    const bagInitEntries = this.logParser.extractBagInitData(text);

    if (bagInitEntries.length < MIN_BAG_ITEMS_FOR_INIT) {
      return { success: false };
    }

    logger.info(`Found ${bagInitEntries.length} InitBagData entries - initializing`);

    this.bagState.clear();
    this.itemInstances.clear();
    const itemTotals = new Map<string, number>();

    for (const entry of bagInitEntries) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      this.bagState.set(slotKey, entry.count);

      const current = itemTotals.get(entry.configBaseId) || 0;
      itemTotals.set(entry.configBaseId, current + entry.count);
    }

    // Store initial totals
    for (const [itemId, total] of itemTotals) {
      this.bagState.set(`init:${itemId}`, total);
    }

    // Also try to initialize itemInstances from ItemChange events in the log
    const itemChanges = this.logParser.extractItemChanges(text);
    if (itemChanges.length > 0) {
      logger.info(`Found ${itemChanges.length} ItemChange entries during initialization`);
      for (const change of itemChanges) {
        if (change.fullId && change.action !== 'Remove') {
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

    this.bagInitialized = true;
    this.initializationComplete = true;
    this.awaitingInitialization = false;
    this.initializationInProgress = false;

    logger.info(
      `Initialization complete: ${itemTotals.size} unique items, ${bagInitEntries.length} inventory slots, ${this.itemInstances.size} tracked instances`
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

    const bagModifications = this.logParser.extractBagModifications(text);

    if (bagModifications.length > MIN_BAG_ITEMS_LEGACY) {
      logger.info(`Found ${bagModifications.length} bag items - initializing (legacy)`);

      for (const entry of bagModifications) {
        const itemKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
        this.bagState.set(itemKey, entry.count);
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

    const bagModifications = this.logParser.extractBagModifications(text);

    if (bagModifications.length === 0) {
      return [];
    }

    const changes: Array<[string, number]> = [];
    const slotChanges = new Map<string, number>();

    // Track changes per slot
    for (const entry of bagModifications) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      const prevCount = this.bagState.get(slotKey) || 0;
      this.bagState.set(slotKey, entry.count);

      const current = slotChanges.get(entry.configBaseId) || 0;
      slotChanges.set(entry.configBaseId, current + (entry.count - prevCount));
    }

    // Calculate net changes
    for (const [itemId, slotChange] of slotChanges) {
      if (slotChange === 0) continue;

      const initKey = `init:${itemId}`;
      const initialTotal = this.bagState.get(initKey) || 0;

      // Calculate current total for this item
      let currentTotal = 0;
      for (const [key, value] of this.bagState) {
        if (!key.startsWith('init:') && key.endsWith(`:${itemId}`)) {
          currentTotal += value;
        }
      }

      const netChange = currentTotal - initialTotal;

      if (netChange !== 0) {
        changes.push([itemId, netChange]);
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

    // Phase 3 & 4: Try using ItemChange@ events with fullId tracking
    const itemChanges = this.logParser.extractItemChanges(text);
    if (itemChanges.length > 0 && this.bagInitialized) {
      return this.processItemChangesWithFullId(itemChanges);
    }

    // If no ItemChange@ events but we have BagMgr@ events, use legacy detection
    // This handles cases where game logs different event types for different actions
    if (this.bagInitialized && this.initializationComplete) {
      const bagModifications = this.logParser.extractBagModifications(text);
      if (bagModifications.length > 0) {
        logger.debug(`No ItemChange@ events, falling back to BagMgr@ detection (${bagModifications.length} modifications)`);
        return this.detectBagChanges(text);
      }
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
   * After sort, we get a fresh inventory snapshot from InitBagData.
   */
  private handleSortEnd(text: string): Array<[string, number]> {
    logger.info('Sort operation ended - processing snapshot');
    this.isInSortOperation = false;

    // Get fresh snapshot from InitBagData
    const bagInitEntries = this.logParser.extractBagInitData(text);

    if (bagInitEntries.length >= MIN_BAG_ITEMS_FOR_INIT) {
      logger.info(`Updating inventory state from ${bagInitEntries.length} InitBagData entries after sort`);

      // Clear old slot-based state
      const itemTotals = new Map<string, number>();

      // Update bag state with new slots
      for (const entry of bagInitEntries) {
        const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
        this.bagState.set(slotKey, entry.count);

        const current = itemTotals.get(entry.configBaseId) || 0;
        itemTotals.set(entry.configBaseId, current + entry.count);
      }

      // Update initial totals (baseline remains the same, just update tracking)
      // We don't reset the baseline because items didn't actually change, just moved

      // Process any ItemChange events that came after the sort
      const postSortChanges = this.logParser.extractItemChanges(text);
      if (postSortChanges.length > 0) {
        // Update item instances with new positions
        for (const change of postSortChanges) {
          if (change.fullId) {
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
          // First time seeing this fullId - check if item existed in this slot before
          const slotKey = `${change.pageId}:${change.slotId}:${change.configBaseId}`;
          const previousCount = this.bagState.get(slotKey) || 0;

          // Calculate delta from previous slot state
          const delta = change.count - previousCount;

          if (delta !== 0) {
            const netChange = realChanges.get(change.configBaseId) || 0;
            realChanges.set(change.configBaseId, netChange + delta);
            logger.debug(`Item tracked (first fullId): ${change.fullId} (${change.configBaseId}) ${previousCount} → ${change.count} (${delta > 0 ? '+' : ''}${delta})`);
          }

          // Track this item instance going forward
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

  private detectChangesWithoutInit(text: string): Array<[string, number]> {
    const bagModifications = this.logParser.extractBagModifications(text);
    if (bagModifications.length === 0) {
      return [];
    }

    const drops: Array<[string, number]> = [];

    // Calculate previous totals
    const previousTotals = new Map<string, number>();
    for (const [itemKey, qty] of this.bagState) {
      const parts = itemKey.split(':');
      if (parts.length === 3) {
        const itemId = parts[2];
        previousTotals.set(itemId, (previousTotals.get(itemId) || 0) + qty);
      }
    }

    // Apply modifications
    const currentState = new Map(this.bagState);
    for (const entry of bagModifications) {
      const itemKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      currentState.set(itemKey, entry.count);
    }

    // Calculate current totals
    const currentTotals = new Map<string, number>();
    for (const [itemKey, qty] of currentState) {
      const parts = itemKey.split(':');
      if (parts.length === 3) {
        const itemId = parts[2];
        currentTotals.set(itemId, (currentTotals.get(itemId) || 0) + qty);
      }
    }

    // Find increases (drops)
    for (const [itemId, currentTotal] of currentTotals) {
      const previousTotal = previousTotals.get(itemId) || 0;
      if (currentTotal > previousTotal) {
        drops.push([itemId, currentTotal - previousTotal]);
      }
    }

    this.bagState = currentState;
    return drops;
  }

  resetMapBaseline(): number {
    const itemTotals = new Map<string, number>();

    for (const [key, value] of this.bagState) {
      if (!key.startsWith('init:') && key.includes(':')) {
        const parts = key.split(':');
        if (parts.length === 3) {
          const itemId = parts[2];
          itemTotals.set(itemId, (itemTotals.get(itemId) || 0) + value);
        }
      }
    }

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
