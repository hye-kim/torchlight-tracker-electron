/**
 * Constants used throughout the Torchlight Infinite Price Tracker application.
 */

// API Configuration
export const DEFAULT_API_URL = 'https://torchlight-price-tracker.onrender.com';

// File Paths
export const CONFIG_FILE = 'config.json';
export const FULL_TABLE_FILE = 'full_table.json';
export const COMPREHENSIVE_ITEM_DATABASE_FILE = 'comprehensive_item_mapping.json';
export const DROP_LOG_FILE = 'drop.txt';

// Price Configuration
export const TAX_RATE = 0.875; // 12.5% tax
export const PRICE_SAMPLE_SIZE = 30;
export const EXCLUDED_ITEM_ID = '100300';

// Initialization Configuration
export const MIN_BAG_ITEMS_FOR_INIT = 20;
export const MIN_BAG_ITEMS_LEGACY = 10;

// Threading Configuration
export const LOG_POLL_INTERVAL = 1.0; // seconds
export const LOG_BATCH_SIZE = 1000; // Number of lines to process in one batch
export const LOG_BATCH_INTERVAL = 0.1; // seconds - Time between batch processing

// API Configuration
export const API_CACHE_TTL = 3600; // seconds - How long to cache API responses
export const API_RETRY_BASE_DELAY = 2; // seconds - Base delay for exponential backoff
export const API_UPDATE_THROTTLE = 3600; // seconds - Minimum time between API updates for same item (1 hour)
export const API_RATE_LIMIT_CALLS = 100; // Maximum API calls per window
export const API_RATE_LIMIT_WINDOW = 60; // seconds - Rate limit window duration

// File Handle Configuration
export const LOG_FILE_REOPEN_INTERVAL = 30.0; // seconds - How often to check if log file needs reopening
export const LOG_FILE_ROTATION_MAX_RETRIES = 5; // Maximum retries when log file is rotated/renamed
export const LOG_FILE_ROTATION_RETRY_DELAY = 0.2; // seconds - Delay between rotation retry attempts

// Regular Expression Patterns
export const PATTERN_SUBREGION_ENTER = /MysteryAreaModel@UpdateMysteryMapDataList AreaId == (\d+)\s+AreaLv == (\d+)/;

// Subregion Name Translations
export const SUBREGION_NAMES: Record<string, string> = {
  '1000': 'Glacial Abyss',
  '1100': 'Blistering Lava Sea',
  '1200': 'Steel Forge',
  '1300': 'Thunder Wastes',
  '1400': 'Voidlands',
};

// Area Level Translations
export const AREA_LEVEL_NAMES: Record<number, string> = {
  0: '1',
  1: '2',
  2: '3',
  3: '4',
  4: '5',
  5: '6',
  6: '7-0',
  7: '7-1',
  8: '7-2',
  9: '8-0',
  10: '8-1',
  11: '8-2',
  12: 'Profound',
};

/**
 * Calculate item price with tax applied if enabled.
 */
export function calculatePriceWithTax(price: number, itemId: string, taxEnabled: boolean): number {
  if (taxEnabled && itemId !== EXCLUDED_ITEM_ID) {
    return price * TAX_RATE;
  }
  return price;
}

/**
 * Format duration in seconds to a human-readable string.
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}

/**
 * Get the formatted display name for a subregion.
 */
export function getSubregionDisplayName(areaId: string, areaLevel: number): string {
  const subregionName = SUBREGION_NAMES[areaId] || `Unknown Area (${areaId})`;
  const levelPrefix = AREA_LEVEL_NAMES[areaLevel] || String(areaLevel);
  return `${levelPrefix} ${subregionName}`;
}
