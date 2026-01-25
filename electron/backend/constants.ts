/**
 * Constants used throughout the Torchlight Infinite Price Tracker application.
 */

// Application Information
export const APP_NAME = 'Torchlight Price Checker';
export const APP_VERSION = '0.0.3';
export const APP_TITLE = `${APP_NAME} v${APP_VERSION}`;

// File Paths
export const CONFIG_FILE = 'config.json';
export const FULL_TABLE_FILE = 'full_table.json';
export const COMPREHENSIVE_ITEM_DATABASE_FILE = 'comprehensive_item_mapping.json';
export const DROP_LOG_FILE = 'drop.txt';

// Game Detection
export const GAME_WINDOW_TITLE = 'Torchlight: Infinite  ';
export const LOG_FILE_RELATIVE_PATH = '../../../TorchLight/Saved/Logs/UE_game.log';

// Price Configuration
export const TAX_RATE = 0.875; // 12.5% tax
export const PRICE_SAMPLE_SIZE = 30;
export const EXCLUDED_ITEM_ID = '100300';

// Status Indicators
export const STATUS_FRESH = '✔'; // < 2 hours
export const STATUS_STALE = '◯'; // 2-24 hours
export const STATUS_OLD = '✘'; // > 24 hours

export const TIME_FRESH_THRESHOLD = 7200; // 2 hours in seconds
export const TIME_STALE_THRESHOLD = 86400; // 24 hours in seconds

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
 * Determine the freshness status of a price based on last update time.
 */
export function getPriceFreshnessStatus(lastUpdate: number, currentTime: number): string {
  const timePassed = currentTime - lastUpdate;

  if (timePassed < TIME_FRESH_THRESHOLD) {
    return 'Fresh';
  } else if (timePassed < TIME_STALE_THRESHOLD) {
    return 'Stale';
  } else {
    return 'Old';
  }
}

/**
 * Get the visual indicator for price freshness.
 */
export function getPriceFreshnessIndicator(lastUpdate: number, currentTime: number): string {
  const timePassed = currentTime - lastUpdate;

  if (timePassed < TIME_FRESH_THRESHOLD) {
    return STATUS_FRESH;
  } else if (timePassed < TIME_STALE_THRESHOLD) {
    return STATUS_STALE;
  } else {
    return STATUS_OLD;
  }
}

/**
 * Calculate Flame Elementium per hour rate.
 */
export function calculateFePerHour(income: number, duration: number): number {
  if (duration <= 0) {
    return 0.0;
  }
  return income / (duration / 3600);
}

/**
 * Get the formatted display name for a subregion.
 */
export function getSubregionDisplayName(areaId: string, areaLevel: number): string {
  const subregionName = SUBREGION_NAMES[areaId] || `Unknown Area (${areaId})`;
  const levelPrefix = AREA_LEVEL_NAMES[areaLevel] || String(areaLevel);
  return `${levelPrefix} ${subregionName}`;
}
