import { FileManager } from '../data/FileManager';
import { Logger } from '../core/Logger';
import {
  PATTERN_SUBREGION_ENTER,
  getSubregionDisplayName,
  EXCLUDED_ITEM_ID,
  PRICE_SAMPLE_SIZE,
} from '../core/constants';

const logger = Logger.getInstance();

// Constants
const PATTERN_PRICE_ID = /XchgSearchPrice----SynId = (\d+).*?\+refer \[(\d+)\]/gs;
const PATTERN_ITEM_CHANGE =
  /\[.*?\]GameLog: Display: \[Game\] ItemChange@ (Add|Update|Remove|Delete) Id=(\d+_[^ ]+) BagNum=(\d+) in PageId=(\d+) SlotId=(\d+)/g;
const PATTERN_RESET_ITEMS_START = /ItemChange@ ProtoName=ResetItemsLayout start/;
const PATTERN_RESET_ITEMS_END = /ItemChange@ ProtoName=ResetItemsLayout end/;
// const PATTERN_ITEM_CHANGE_RESET = /ItemChange@ Reset PageId=(\d+)/g; // Reserved for future use
const PATTERN_BAG_INIT_DATA =
  /BagMgr@:InitBagData PageId = (\d+) SlotId = (\d+) ConfigBaseId = (\d+) Num = (\d+)/g;
const PATTERN_MAP_ENTER =
  /PageApplyBase@ _UpdateGameEnd: LastSceneName = World'\/Game\/Art\/Maps\/01SD\/XZ_YuJinZhiXiBiNanSuo200\/XZ_YuJinZhiXiBiNanSuo200.XZ_YuJinZhiXiBiNanSuo200' NextSceneName = World'\/Game\/Art\/Maps/;
const PATTERN_MAP_EXIT =
  /NextSceneName = World'\/Game\/Art\/Maps\/01SD\/XZ_YuJinZhiXiBiNanSuo200\/XZ_YuJinZhiXiBiNanSuo200.XZ_YuJinZhiXiBiNanSuo200'/;
const PATTERN_DIXIAZHEN_ENTER =
  /NextSceneName = World'\/Game\/Art\/Season\/S13\/Maps\/DiXiaZhenSuo\/DiXiaZhenSuo\.DiXiaZhenSuo'/;
const PATTERN_VALUE = /\+\d+\s+\[([\d.]+)\]/g;

const LOG_NOISE_PATTERNS = [
  'SoundTriggerTimestamps',
  'GameplayLog',
  'error:',
  'Warning',
  'PushMgr@RecvLogicMsg',
  'HeartBeat',
  'Ping',
  'BroadcastChat',
  'SyncArea',
  'Spv3Info',
  'SpGuideInfo',
  'SavePlayerClientData',
  'MainCityFrameDataApi',
  'SetClientStoredData',
  'UpdateSpeedUpPointLag',
  'GetRollNotice',
  'ActiveFlag',
  'GetServerTime',
  'GlobalSpeedUpPointList',
  'ReturnClientStoredData',
];

const NOISE_REGEX = new RegExp(LOG_NOISE_PATTERNS.join('|'), 'i');

export interface BagModification {
  pageId: string;
  slotId: string;
  configBaseId: string;
  count: number;
  fullId?: string; // Unique item instance ID (e.g., "100300_5be0cefd-fcbf-11f0-be72-00000000001f")
  action?: 'Add' | 'Update' | 'Remove'; // Action type for ItemChange events
}

export class LogParser {
  constructor(private fileManager: FileManager) {}

  shouldProcessLine(line: string): boolean {
    if (!line?.trim()) {
      return false;
    }
    return !NOISE_REGEX.test(line);
  }

  filterText(text: string): string {
    if (!text) return text;
    const lines = text.split('\n');
    return lines.filter((line) => this.shouldProcessLine(line)).join('\n');
  }

  extractPriceInfo(text: string): Array<[string, number, boolean | undefined]> {
    const priceUpdates: Array<[string, number, boolean | undefined]> = [];

    try {
      const matches = Array.from(text.matchAll(PATTERN_PRICE_ID));

      for (const match of matches) {
        const synid = match[1];
        const itemId = match[2];

        if (!synid || !itemId) {
          continue;
        }

        if (itemId === EXCLUDED_ITEM_ID) {
          continue;
        }

        const price = this.extractPriceForItem(text, synid, itemId);
        if (price !== null) {
          // Extract identification status from filters (for Legendary Gear only)
          const identified = this.extractIdentificationStatus(text, synid, itemId);
          priceUpdates.push([itemId, price, identified]);
        }
      }
    } catch (error) {
      logger.error('Error extracting price info:', error);
    }

    return priceUpdates;
  }

  private extractPriceForItem(text: string, synid: string, itemId: string): number | null {
    try {
      const pattern = new RegExp(
        `----Socket RecvMessage STT----XchgSearchPrice----SynId = ${synid}\\s+` +
          `\\[.*?\\]\\s*GameLog: Display: \\[Game\\]\\s+` +
          `(.*?)(?=----Socket RecvMessage STT----|$)`,
        's'
      );

      const match = pattern.exec(text);
      if (!match?.[1]) {
        logger.debug(`No price data found for ID: ${itemId}`);
        return null;
      }

      const dataBlock = match[1];
      const values = Array.from(dataBlock.matchAll(PATTERN_VALUE))
        .map((m) => m[1])
        .filter((v): v is string => v !== undefined);

      if (values.length === 0) {
        return -1.0;
      }

      // Use first N values as samples
      const numValues = Math.min(values.length, PRICE_SAMPLE_SIZE);
      const roundedValues = values
        .slice(0, numValues)
        .map((v) => Math.round(parseFloat(v) * 100) / 100);

      // Try to find mode (most common price)
      const counter = new Map<number, number>();
      for (const value of roundedValues) {
        counter.set(value, (counter.get(value) ?? 0) + 1);
      }

      const entries = Array.from(counter.entries()).sort((a, b) => b[1] - a[1]);
      const mostCommon = entries[0];

      // Use mode if it appears at least 30% of the time
      if (mostCommon && mostCommon[1] >= roundedValues.length * 0.3) {
        return Math.round(mostCommon[0] * 10000) / 10000;
      }

      // Fallback to median
      const sorted = roundedValues.sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const leftValue = sorted[mid - 1];
      const rightValue = sorted[mid];

      if (sorted.length % 2 === 0) {
        if (leftValue === undefined || rightValue === undefined) {
          return null;
        }
        const median = (leftValue + rightValue) / 2;
        return Math.round(median * 10000) / 10000;
      } else {
        if (rightValue === undefined) {
          return null;
        }
        return Math.round(rightValue * 10000) / 10000;
      }
    } catch (error) {
      logger.error(`Error extracting price for item ${itemId}:`, error);
      return null;
    }
  }

  /**
   * Extract identification status from filters (for Legendary Gear only).
   * Returns true if identified, false if unidentified, undefined if not Legendary Gear or status cannot be determined.
   */
  private extractIdentificationStatus(
    text: string,
    synid: string,
    itemId: string
  ): boolean | undefined {
    try {
      // First check if this item is Legendary Gear
      const fullTable = this.fileManager.loadFullTable();
      const item = fullTable[itemId];
      const itemType = item?.type ?? item?.type_en;

      if (itemType !== 'Legendary Gear') {
        return undefined; // Not a legendary item, don't track identification status
      }

      // Extract the SendMessage block with filters
      const sendPattern = new RegExp(
        `----Socket SendMessage STT----XchgSearchPrice----SynId = ${synid}\\s+` +
          `\\[.*?\\]\\s*GameLog: Display: \\[Game\\]\\s+` +
          `(.*?)(?=----Socket SendMessage End----|$)`,
        's'
      );

      const sendMatch = sendPattern.exec(text);
      if (!sendMatch?.[1]) {
        return undefined;
      }

      const filtersBlock = sendMatch[1];

      // Look for key [32] with its min/max parameters
      // Pattern: +key [32] followed by +params with +min and +max values
      const key32Pattern = /\+key \[32\][\s\S]*?\+min \[(\d+)\][\s\S]*?\+max \[(\d+)\]/;
      const key32Match = key32Pattern.exec(filtersBlock);

      if (!key32Match?.[1] || !key32Match[2]) {
        return undefined; // Filter not found or incomplete
      }

      const minValue = parseInt(key32Match[1]);
      const maxValue = parseInt(key32Match[2]);

      // min=1, max=1 means identified
      // min=0, max=0 means unidentified
      if (minValue === 1 && maxValue === 1) {
        return true; // Identified
      } else if (minValue === 0 && maxValue === 0) {
        return false; // Unidentified
      }

      return undefined; // Unknown state
    } catch (error) {
      logger.error(`Error extracting identification status for item ${itemId}:`, error);
      return undefined;
    }
  }

  async updatePricesInTable(text: string): Promise<number> {
    const priceUpdates = this.extractPriceInfo(text);
    if (priceUpdates.length === 0) {
      return 0;
    }

    let updateCount = 0;
    const currentTime = Math.floor(Date.now() / 1000);
    const fullTable = this.fileManager.loadFullTable();

    for (const [itemId, price, identified] of priceUpdates) {
      const item = fullTable[itemId];
      if (item) {
        const updateData: { price: number; last_update: number; identified?: boolean } = {
          price,
          last_update: currentTime,
        };

        // Only include identified status if it's defined (for Legendary Gear)
        if (identified !== undefined) {
          updateData.identified = identified;
        }

        const updated = await this.fileManager.updateItem(itemId, updateData);

        if (updated) {
          const itemName = item.name ?? itemId;
          const identifiedStr =
            identified !== undefined ? ` (${identified ? 'Identified' : 'Unidentified'})` : '';
          logger.info(`Updated price: ${itemName} (ID:${itemId}) = ${price}${identifiedStr}`);
          updateCount++;
        }
      }
    }

    return updateCount;
  }

  /**
   * Extract ItemChange@ events with unique fullId.
   * These events track individual item stacks with persistent identifiers.
   */
  extractItemChanges(text: string): BagModification[] {
    const matches = Array.from(text.matchAll(PATTERN_ITEM_CHANGE));
    return matches
      .filter((m) => m[1] && m[2] && m[3] && m[4] && m[5])
      .map((m) => {
        const fullId = m[2];
        const baseIdParts = fullId.split('_');
        const baseId = baseIdParts[0] ?? fullId; // Extract base ID from fullId
        return {
          action: (m[1] === 'Delete' ? 'Remove' : m[1]) as 'Add' | 'Update' | 'Remove',
          fullId: fullId,
          pageId: m[4],
          slotId: m[5],
          configBaseId: baseId,
          count: parseInt(m[3]),
        };
      });
  }

  /**
   * Extract BagMgr@:InitBagData events for complete inventory state.
   * These events appear during initialization and after sorts, showing all inventory pages.
   */
  extractBagData(text: string): BagModification[] {
    const matches = Array.from(text.matchAll(PATTERN_BAG_INIT_DATA));
    return matches
      .filter((m) => m[1] && m[2] && m[3] && m[4])
      .map((m) => {
        const pageId = m[1];
        const slotId = m[2];
        const configBaseId = m[3];
        const count = parseInt(m[4]);
        // Create synthetic fullId for bag data (will be replaced when real ItemChange@ appears)
        const syntheticFullId = `${configBaseId}_init_${pageId}_${slotId}`;
        return {
          action: 'Update' as 'Add' | 'Update' | 'Remove',
          fullId: syntheticFullId,
          pageId: pageId,
          slotId: slotId,
          configBaseId: configBaseId,
          count: count,
        };
      });
  }

  /**
   * Detect if text contains ResetItemsLayout start event (sorting begins).
   */
  detectResetItemsLayoutStart(text: string): boolean {
    return PATTERN_RESET_ITEMS_START.test(text);
  }

  /**
   * Detect if text contains ResetItemsLayout end event (sorting complete).
   */
  detectResetItemsLayoutEnd(text: string): boolean {
    return PATTERN_RESET_ITEMS_END.test(text);
  }

  detectMapChange(text: string): { entering: boolean; exiting: boolean; subregion?: string } {
    // Check for DiXiaZhenSuo entry (special seasonal map)
    const dixiazhenMatch = PATTERN_DIXIAZHEN_ENTER.test(text);
    if (dixiazhenMatch) {
      return {
        entering: true,
        exiting: false,
        subregion: "Vorax - Shelly's Operating Theater",
      };
    }

    return {
      entering: PATTERN_MAP_ENTER.test(text),
      exiting: PATTERN_MAP_EXIT.test(text),
    };
  }

  /**
   * Detect entering a subregion and return the formatted subregion name.
   * @returns Formatted subregion name (e.g., "7-0 Steel Forge") or null if not detected.
   */
  detectSubregionEntry(text: string): string | null {
    const match = PATTERN_SUBREGION_ENTER.exec(text);
    if (match?.[1] && match[2]) {
      const areaId = match[1];
      const areaLevel = parseInt(match[2], 10);
      return getSubregionDisplayName(areaId, areaLevel);
    }
    return null;
  }

  detectPlayerLogin(text: string): boolean {
    return text.includes('PlayerInitPkgMgr') || text.includes('Login2Client');
  }
}
