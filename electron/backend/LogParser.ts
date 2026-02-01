import { FileManager, ItemData } from './FileManager';
import { Logger } from './Logger';
import { PATTERN_SUBREGION_ENTER, getSubregionDisplayName, EXCLUDED_ITEM_ID, PRICE_SAMPLE_SIZE } from './constants';

const logger = Logger.getInstance();

// Constants
const PATTERN_PRICE_ID = /XchgSearchPrice----SynId = (\d+).*?\+refer \[(\d+)\]/gs;
const PATTERN_ITEM_CHANGE = /\[.*?\]GameLog: Display: \[Game\] ItemChange@ (Add|Update|Remove) Id=(\d+_[^ ]+) BagNum=(\d+) in PageId=(\d+) SlotId=(\d+)/g;
const PATTERN_RESET_ITEMS_START = /ItemChange@ ProtoName=ResetItemsLayout start/;
const PATTERN_RESET_ITEMS_END = /ItemChange@ ProtoName=ResetItemsLayout end/;
const PATTERN_ITEM_CHANGE_RESET = /ItemChange@ Reset PageId=(\d+)/g;
const PATTERN_BAG_INIT_DATA = /BagMgr@:InitBagData PageId = (\d+) SlotId = (\d+) ConfigBaseId = (\d+) Num = (\d+)/g;
const PATTERN_MAP_ENTER = /PageApplyBase@ _UpdateGameEnd: LastSceneName = World'\/Game\/Art\/Maps\/01SD\/XZ_YuJinZhiXiBiNanSuo200\/XZ_YuJinZhiXiBiNanSuo200.XZ_YuJinZhiXiBiNanSuo200' NextSceneName = World'\/Game\/Art\/Maps/;
const PATTERN_MAP_EXIT = /NextSceneName = World'\/Game\/Art\/Maps\/01SD\/XZ_YuJinZhiXiBiNanSuo200\/XZ_YuJinZhiXiBiNanSuo200.XZ_YuJinZhiXiBiNanSuo200'/;
const PATTERN_DIXIAZHEN_ENTER = /NextSceneName = World'\/Game\/Art\/Season\/S13\/Maps\/DiXiaZhenSuo\/DiXiaZhenSuo\.DiXiaZhenSuo'/;
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
    if (!line || !line.trim()) {
      return false;
    }
    return !NOISE_REGEX.test(line);
  }

  filterText(text: string): string {
    if (!text) return text;
    const lines = text.split('\n');
    return lines.filter((line) => this.shouldProcessLine(line)).join('\n');
  }

  extractPriceInfo(text: string): Array<[string, number]> {
    const priceUpdates: Array<[string, number]> = [];

    try {
      const matches = Array.from(text.matchAll(PATTERN_PRICE_ID));
      logger.info(`[PRICE DEBUG] extractPriceInfo found ${matches.length} XchgSearchPrice matches`);

      for (const match of matches) {
        const synid = match[1];
        const itemId = match[2];

        logger.info(`[PRICE DEBUG] Processing match - synid: ${synid}, itemId: ${itemId}`);

        if (itemId === EXCLUDED_ITEM_ID) {
          logger.info(`[PRICE DEBUG] Skipping excluded item ${itemId}`);
          continue;
        }

        const price = this.extractPriceForItem(text, synid, itemId);
        if (price !== null) {
          logger.info(`[PRICE DEBUG] Extracted price for item ${itemId}: ${price}`);
          priceUpdates.push([itemId, price]);
        } else {
          logger.info(`[PRICE DEBUG] extractPriceForItem returned null for item ${itemId}`);
        }
      }
    } catch (error) {
      logger.error('Error extracting price info:', error);
    }

    logger.info(`[PRICE DEBUG] extractPriceInfo returning ${priceUpdates.length} price updates`);
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

      logger.info(`[PRICE DEBUG] extractPriceForItem looking for synid ${synid} in ${text.length} chars of text`);
      logger.info(`[PRICE DEBUG] First 500 chars of text: ${text.substring(0, 500)}`);

      const match = pattern.exec(text);
      if (!match) {
        logger.info(`[PRICE DEBUG] Pattern did not match for synid ${synid}, itemId ${itemId}`);
        logger.info(`[PRICE DEBUG] Pattern used: ${pattern.source.substring(0, 200)}...`);
        return null;
      }

      logger.info(`[PRICE DEBUG] Pattern matched! Match length: ${match[0].length}, captured group length: ${match[1]?.length || 0}`);

      const dataBlock = match[1];
      const values = Array.from(dataBlock.matchAll(PATTERN_VALUE)).map((m) => m[1]);

      if (values.length === 0) {
        return -1.0;
      }

      // Use first N values as samples
      const numValues = Math.min(values.length, PRICE_SAMPLE_SIZE);
      const roundedValues = values.slice(0, numValues).map((v) => Math.round(parseFloat(v) * 100) / 100);

      // Try to find mode (most common price)
      const counter = new Map<number, number>();
      for (const value of roundedValues) {
        counter.set(value, (counter.get(value) || 0) + 1);
      }

      const mostCommon = Array.from(counter.entries()).sort((a, b) => b[1] - a[1])[0];

      // Use mode if it appears at least 30% of the time
      if (mostCommon && mostCommon[1] >= roundedValues.length * 0.3) {
        return Math.round(mostCommon[0] * 10000) / 10000;
      }

      // Fallback to median
      const sorted = roundedValues.sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

      return Math.round(median * 10000) / 10000;
    } catch (error) {
      logger.error(`Error extracting price for item ${itemId}:`, error);
      return null;
    }
  }

  async updatePricesInTable(text: string): Promise<number> {
    logger.info(`[PRICE DEBUG] updatePricesInTable called with ${text.length} chars`);
    const priceUpdates = this.extractPriceInfo(text);
    logger.info(`[PRICE DEBUG] extractPriceInfo returned ${priceUpdates.length} updates`);

    if (priceUpdates.length === 0) {
      logger.info(`[PRICE DEBUG] No price updates to process`);
      return 0;
    }

    let updateCount = 0;
    const currentTime = Math.floor(Date.now() / 1000);
    const fullTable = this.fileManager.loadFullTable();

    for (const [itemId, price] of priceUpdates) {
      logger.info(`[PRICE DEBUG] Processing price update for itemId: ${itemId}, price: ${price}`);

      if (fullTable[itemId]) {
        logger.info(`[PRICE DEBUG] Item ${itemId} found in fullTable, calling updateItem`);
        const updated = await this.fileManager.updateItem(itemId, {
          price,
          last_update: currentTime,
        });

        logger.info(`[PRICE DEBUG] updateItem returned: ${updated} for item ${itemId}`);
        if (updated) {
          const itemName = fullTable[itemId].name || itemId;
          logger.info(`Updated price: ${itemName} (ID:${itemId}) = ${price}`);
          updateCount++;
        }
      } else {
        logger.info(`[PRICE DEBUG] Item ${itemId} NOT found in fullTable`);
      }
    }

    logger.info(`[PRICE DEBUG] updatePricesInTable completed with ${updateCount} updates`);
    return updateCount;
  }

  /**
   * Extract ItemChange@ events with unique fullId.
   * These events track individual item stacks with persistent identifiers.
   */
  extractItemChanges(text: string): BagModification[] {
    const matches = Array.from(text.matchAll(PATTERN_ITEM_CHANGE));
    return matches.map((m) => {
      const fullId = m[2];
      const baseId = fullId.split('_')[0]; // Extract base ID from fullId
      return {
        action: m[1] as 'Add' | 'Update' | 'Remove',
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
    return matches.map((m) => {
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
    if (match) {
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
