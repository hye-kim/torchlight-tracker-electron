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
  // Track which slots are currently known for each item (to avoid counting stale slots)
  private activeSlots: Map<string, Set<string>> = new Map(); // itemId -> Set of active slot keys

  constructor(private logParser: LogParser) {}

  reset(): void {
    this.bagState.clear();
    this.activeSlots.clear();
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
    this.activeSlots.clear();
    const itemTotals = new Map<string, number>();

    for (const entry of bagInitEntries) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      this.bagState.set(slotKey, entry.count);

      // Track active slots for this item
      if (!this.activeSlots.has(entry.configBaseId)) {
        this.activeSlots.set(entry.configBaseId, new Set());
      }
      this.activeSlots.get(entry.configBaseId)!.add(slotKey);

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

    // Group modifications by itemId
    const itemSlotMap = new Map<string, Set<string>>();
    for (const entry of bagModifications) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      if (!itemSlotMap.has(entry.configBaseId)) {
        itemSlotMap.set(entry.configBaseId, new Set());
      }
      itemSlotMap.get(entry.configBaseId)!.add(slotKey);
    }

    // NEW APPROACH: Use activeSlots to track which slots are currently valid.
    // When BagModify mentions a NEW slot (not in activeSlots), it means the item
    // moved or was reorganized. In that case, replace ALL activeSlots with ONLY
    // the slots mentioned in BagModify (even if incomplete), because old slots are stale.
    //
    // This fixes the bug where:
    // - Item in slots 75+76 (99+28=127 total)
    // - BagModify shows only slot 75=98 (used 1)
    // - OLD BUG: activeSlots still has both 75+76, total = 98+28=126 ✓
    // - But if slot 76 gets lost somehow, total = 98, change = -29 ✗
    //
    // New behavior:
    // - If slot 75 is in activeSlots already: just update it, keep other active slots
    // - If slot 75 is NEW: replace activeSlots with just {75}, clear old data
    //
    // This may temporarily undercount if BagModify doesn't show all slots,
    // but it prevents overcounting from stale slots.
    for (const [itemId, slotsInModify] of itemSlotMap) {
      const currentActiveSlots = this.activeSlots.get(itemId) || new Set();

      // Check if any slot in BagModify is NEW (not in currentActiveSlots)
      let hasNewSlot = false;
      for (const slotKey of slotsInModify) {
        if (!currentActiveSlots.has(slotKey)) {
          hasNewSlot = true;
          break;
        }
      }

      if (hasNewSlot && currentActiveSlots.size > 0) {
        // New slot detected = item moved/reorganized
        // Clear all old slot data and reset activeSlots to ONLY what BagModify shows
        logger.debug(`Item ${itemId}: new slot detected, replacing active slots (${currentActiveSlots.size} old → ${slotsInModify.size} new)`);

        // Delete old slot data from bagState
        for (const oldSlot of currentActiveSlots) {
          this.bagState.delete(oldSlot);
        }

        // Replace activeSlots with only the new slots from BagModify
        this.activeSlots.set(itemId, new Set(slotsInModify));
      } else {
        // No new slots - just updating existing slots
        // Add any new slots to activeSlots (for items that are being split)
        if (!this.activeSlots.has(itemId)) {
          this.activeSlots.set(itemId, new Set());
        }
        for (const slotKey of slotsInModify) {
          this.activeSlots.get(itemId)!.add(slotKey);
        }
      }
    }

    // Update bagState with BagModify data
    for (const entry of bagModifications) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      this.bagState.set(slotKey, entry.count);
    }

    // Calculate changes using ONLY activeSlots (ignore any stale data in bagState)
    for (const itemId of itemSlotMap.keys()) {
      const initKey = `init:${itemId}`;
      const initialTotal = this.bagState.get(initKey) || 0;

      // Calculate current total using ONLY slots in activeSlots
      let currentTotal = 0;
      const activeSlotSet = this.activeSlots.get(itemId) || new Set();
      for (const slotKey of activeSlotSet) {
        currentTotal += this.bagState.get(slotKey) || 0;
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

    // Calculate previous totals from activeSlots
    const previousTotals = new Map<string, number>();
    for (const [itemId, slotSet] of this.activeSlots) {
      let total = 0;
      for (const slotKey of slotSet) {
        total += this.bagState.get(slotKey) || 0;
      }
      previousTotals.set(itemId, total);
    }

    // Group by itemId
    const itemSlotMap = new Map<string, Set<string>>();
    for (const entry of bagModifications) {
      const slotKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      if (!itemSlotMap.has(entry.configBaseId)) {
        itemSlotMap.set(entry.configBaseId, new Set());
      }
      itemSlotMap.get(entry.configBaseId)!.add(slotKey);
    }

    // Apply the activeSlots approach: detect new slots and replace active set
    for (const [itemId, slotsInModify] of itemSlotMap) {
      const currentActiveSlots = this.activeSlots.get(itemId) || new Set();

      let hasNewSlot = false;
      for (const slotKey of slotsInModify) {
        if (!currentActiveSlots.has(slotKey)) {
          hasNewSlot = true;
          break;
        }
      }

      if (hasNewSlot && currentActiveSlots.size > 0) {
        // New slot = item moved, clear old slots
        for (const oldSlot of currentActiveSlots) {
          this.bagState.delete(oldSlot);
        }
        this.activeSlots.set(itemId, new Set(slotsInModify));
      } else {
        // Just update existing
        if (!this.activeSlots.has(itemId)) {
          this.activeSlots.set(itemId, new Set());
        }
        for (const slotKey of slotsInModify) {
          this.activeSlots.get(itemId)!.add(slotKey);
        }
      }
    }

    // Apply modifications
    for (const entry of bagModifications) {
      const itemKey = `${entry.pageId}:${entry.slotId}:${entry.configBaseId}`;
      this.bagState.set(itemKey, entry.count);
    }

    // Calculate current totals from activeSlots
    const currentTotals = new Map<string, number>();
    for (const [itemId, slotSet] of this.activeSlots) {
      let total = 0;
      for (const slotKey of slotSet) {
        total += this.bagState.get(slotKey) || 0;
      }
      if (total > 0) {
        currentTotals.set(itemId, total);
      }
    }

    // Find increases (drops)
    for (const [itemId, currentTotal] of currentTotals) {
      const previousTotal = previousTotals.get(itemId) || 0;
      if (currentTotal > previousTotal) {
        drops.push([itemId, currentTotal - previousTotal]);
      }
    }

    return drops;
  }

  resetMapBaseline(): number {
    const itemTotals = new Map<string, number>();

    // Rebuild activeSlots from current bagState
    this.activeSlots.clear();

    for (const [key, value] of this.bagState) {
      if (!key.startsWith('init:') && key.includes(':')) {
        const parts = key.split(':');
        if (parts.length === 3) {
          const itemId = parts[2];
          itemTotals.set(itemId, (itemTotals.get(itemId) || 0) + value);

          // Track this slot as active
          if (!this.activeSlots.has(itemId)) {
            this.activeSlots.set(itemId, new Set());
          }
          this.activeSlots.get(itemId)!.add(key);
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
