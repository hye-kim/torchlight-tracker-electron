import { Logger } from '../core/Logger';

const logger = Logger.getInstance();

/**
 * ItemIdNormalizer handles the mapping between legendary gear baseItemIds (pickup IDs)
 * and their inventory-form IDs.
 *
 * Problem:
 * - Legendary gear has a baseItemId when picked up (e.g., "102")
 * - The same item has a different id when in inventory or price checked (e.g., "110703")
 *
 * Solution:
 * - Build a reverse lookup map: baseItemId -> inventoryId
 * - Normalize all IDs to inventory form immediately upon pickup
 * - This ensures drops are recorded with the same ID used for price updates
 */
export class ItemIdNormalizer {
  private baseToInventoryId: Map<string, string> = new Map();

  /**
   * Initialize the normalizer with the comprehensive item mapping.
   * Builds a reverse lookup map from baseItemId to inventory id.
   *
   * @param comprehensiveMapping The full item mapping table
   */
  initialize(comprehensiveMapping: Record<string, { baseItemId?: string }>): void {
    this.baseToInventoryId.clear();

    let count = 0;
    for (const [itemId, item] of Object.entries(comprehensiveMapping)) {
      if (item.baseItemId) {
        this.baseToInventoryId.set(item.baseItemId, itemId);
        count++;
      }
    }

    logger.info(`ItemIdNormalizer initialized with ${count} legendary gear mappings`);
  }

  /**
   * Normalize an item ID to its inventory form.
   * If the ID is a baseItemId (pickup ID), returns the corresponding inventory ID.
   * If the ID is already an inventory ID or not a legendary, returns the ID unchanged.
   *
   * @param itemId The item ID to normalize (could be baseItemId or inventory id)
   * @returns The normalized inventory-form ID
   */
  toInventoryId(itemId: string): string {
    const inventoryId = this.baseToInventoryId.get(itemId);
    if (inventoryId) {
      logger.debug(`Normalized legendary ID: ${itemId} -> ${inventoryId}`);
      return inventoryId;
    }
    return itemId;
  }

  /**
   * Check if an item ID is a legendary gear baseItemId (pickup ID).
   *
   * @param itemId The item ID to check
   * @returns True if this is a legendary baseItemId that needs normalization
   */
  isLegendaryBaseId(itemId: string): boolean {
    return this.baseToInventoryId.has(itemId);
  }

  /**
   * Get the baseItemId for an inventory ID, if it exists.
   * This is the reverse operation - useful for debugging or logging.
   *
   * @param inventoryId The inventory-form ID
   * @returns The corresponding baseItemId, or undefined if not found
   */
  toBaseId(inventoryId: string): string | undefined {
    for (const [baseId, invId] of this.baseToInventoryId.entries()) {
      if (invId === inventoryId) {
        return baseId;
      }
    }
    return undefined;
  }
}
