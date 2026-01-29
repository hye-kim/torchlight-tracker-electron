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

    const bagInitEntries = this.logParser.extractBagInitData(text);

    if (bagInitEntries.length < MIN_BAG_ITEMS_FOR_INIT) {
      return { success: false };
    }

    logger.info(`Found ${bagInitEntries.length} InitBagData entries - initializing`);

    this.bagState.clear();
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

    this.bagInitialized = true;
    this.initializationComplete = true;
    this.awaitingInitialization = false;
    this.initializationInProgress = false;

    logger.info(
      `Initialization complete: ${itemTotals.size} unique items, ${bagInitEntries.length} inventory slots`
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

    // Group modifications by itemId and track which slots are mentioned for each item
    const itemSlotMap = new Map<string, Set<string>>();
    for (const entry of bagModifications) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      if (!itemSlotMap.has(entry.configBaseId)) {
        itemSlotMap.set(entry.configBaseId, new Set());
      }
      itemSlotMap.get(entry.configBaseId)!.add(slotKey);
    }

    // CRITICAL FIX: Only clear slots for an item if we detect a NEW slot appearing.
    // This prevents stale slot data from inflating totals when items change slots,
    // while avoiding over-aggressive clearing during normal updates.
    //
    // Example requiring clearing (slot change):
    // - Previous: Slot 5 = 10 items
    // - BagModify: Slot 7 = 13 items (picked up 3, moved to slot 7)
    // - Detection: Slot 7 is NEW → clear all slots, rebuild from BagModify
    // - Result: Total = 13, netChange = +3 ✓
    //
    // Example NOT requiring clearing (same slot update):
    // - Previous: Slot 5 = 10 items
    // - BagModify: Slot 5 = 13 items (picked up 3, stayed in slot 5)
    // - Detection: Slot 5 exists → just update it, no clearing
    // - Result: Total = 13, netChange = +3 ✓
    for (const [itemId, slotsInModify] of itemSlotMap) {
      const existingSlots = new Set<string>();
      for (const [key] of this.bagState) {
        if (!key.startsWith('init:') && key.endsWith(`:${itemId}`)) {
          existingSlots.add(key);
        }
      }

      // Check if any slots in BagModify are NEW (not in existing slots)
      let hasNewSlot = false;
      for (const slotKey of slotsInModify) {
        if (!existingSlots.has(slotKey)) {
          hasNewSlot = true;
          break;
        }
      }

      // Only clear all slots if we detect a new slot AND there were existing slots
      // (indicates slot change/movement, not initialization)
      if (hasNewSlot && existingSlots.size > 0) {
        logger.debug(`Detected slot change for item ${itemId}, clearing ${existingSlots.size} stale slots`);
        for (const key of existingSlots) {
          this.bagState.delete(key);
        }
      }
    }

    // Process the slot data from BagModify logs
    for (const entry of bagModifications) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      this.bagState.set(slotKey, entry.count);
    }

    // Calculate net changes by comparing new totals to baselines
    for (const itemId of itemSlotMap.keys()) {
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

    // Apply the same conservative fix: only clear slots if we detect slot changes
    const currentState = new Map(this.bagState);

    // Group by itemId and track slots
    const itemSlotMap = new Map<string, Set<string>>();
    for (const entry of bagModifications) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      if (!itemSlotMap.has(entry.configBaseId)) {
        itemSlotMap.set(entry.configBaseId, new Set());
      }
      itemSlotMap.get(entry.configBaseId)!.add(slotKey);
    }

    // Only clear slots if we detect new slots (slot change)
    for (const [itemId, slotsInModify] of itemSlotMap) {
      const existingSlots = new Set<string>();
      for (const [key] of currentState) {
        const parts = key.split(':');
        if (parts.length === 3 && parts[2] === itemId) {
          existingSlots.add(key);
        }
      }

      // Check for new slots
      let hasNewSlot = false;
      for (const slotKey of slotsInModify) {
        if (!existingSlots.has(slotKey)) {
          hasNewSlot = true;
          break;
        }
      }

      // Only clear if new slot detected and there were existing slots
      if (hasNewSlot && existingSlots.size > 0) {
        for (const key of existingSlots) {
          currentState.delete(key);
        }
      }
    }

    // Apply modifications
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
