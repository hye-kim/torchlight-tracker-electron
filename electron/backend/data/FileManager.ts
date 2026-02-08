import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Logger } from '../core/Logger';
import { APIClient } from './APIClient';
import {
  API_UPDATE_THROTTLE,
  DEFAULT_API_URL,
  FULL_TABLE_FILE,
  COMPREHENSIVE_ITEM_DATABASE_FILE,
  DROP_LOG_FILE,
} from '../core/constants';

const logger = Logger.getInstance();

export interface ItemData {
  price?: number;
  last_update?: number;
  last_api_sync?: number;
  name?: string;
  name_en?: string;
  type?: string;
  type_en?: string;
  identified?: boolean; // For Legendary Gear: true = identified, false = unidentified
  [key: string]: unknown;
}

export interface ComprehensiveItemEntry {
  id: string;
  name_en: string;
  type_en: string;
  img?: string;
}

export class FileManager {
  private fullTableCache: Record<string, ItemData> | null = null;
  private apiUrl: string;
  private userDataPath: string;
  private resourcePath: string;
  private itemDatabase: Record<string, ComprehensiveItemEntry> | null = null;
  private apiClient: APIClient;

  constructor() {
    this.userDataPath = app.getPath('userData');
    this.resourcePath = app.isPackaged ? process.resourcesPath : process.cwd();

    this.apiUrl = DEFAULT_API_URL;
    this.apiClient = new APIClient(this.apiUrl, 60, 3);
  }

  private getResourcePath(filename: string): string {
    // Check user data first, then fall back to resource path
    const userFile = path.join(this.userDataPath, filename);
    if (fs.existsSync(userFile)) {
      return userFile;
    }
    return path.join(this.resourcePath, filename);
  }

  private getBundledResourcePath(filename: string): string {
    return path.join(this.resourcePath, filename);
  }

  private getWritablePath(filename: string): string {
    return path.join(this.userDataPath, filename);
  }

  ensureFileExists(filename: string, defaultContent: unknown): void {
    const writablePath = this.getWritablePath(filename);
    const resourcePath = this.getResourcePath(filename);

    if (!fs.existsSync(writablePath) && !fs.existsSync(resourcePath)) {
      logger.info(`Creating file: ${writablePath}`);
      const dir = path.dirname(writablePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(writablePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
    }
  }

  loadJson<T = unknown>(filename: string, defaultValue: T = {} as T): T {
    try {
      const filePath = this.getResourcePath(filename);
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      logger.warn(`Could not load ${filename}:`, error);
      return defaultValue;
    }
  }

  loadBundledJson<T = unknown>(filename: string, defaultValue: T = {} as T): T {
    try {
      const filePath = this.getBundledResourcePath(filename);
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      logger.warn(`Could not load bundled ${filename}:`, error);
      return defaultValue;
    }
  }

  saveJson(filename: string, data: unknown): boolean {
    try {
      const writablePath = this.getWritablePath(filename);
      const dir = path.dirname(writablePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(writablePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (error) {
      logger.error(`Error saving ${filename}:`, error);
      return false;
    }
  }

  loadFullTable(useCache: boolean = true): Record<string, ItemData> {
    if (useCache && this.fullTableCache) {
      return this.fullTableCache;
    }

    const data = this.loadJson<Record<string, ItemData>>(FULL_TABLE_FILE, {});

    // Merge with comprehensive item database to get proper names
    this.itemDatabase ??= this.loadBundledJson<Record<string, ComprehensiveItemEntry>>(
      COMPREHENSIVE_ITEM_DATABASE_FILE,
      {}
    );

    // Enrich full table with item names and types from comprehensive database
    for (const [itemId, item] of Object.entries(data)) {
      const comprehensiveItem = this.itemDatabase[itemId];
      if (comprehensiveItem) {
        if (comprehensiveItem.name_en) {
          item.name = comprehensiveItem.name_en;
        }
        if (comprehensiveItem.type_en) {
          item.type = comprehensiveItem.type_en;
        }
      }
    }

    if (useCache) {
      this.fullTableCache = data;
    }
    return data;
  }

  saveFullTable(data: Record<string, ItemData>): boolean {
    const success = this.saveJson(FULL_TABLE_FILE, data);
    if (success) {
      this.fullTableCache = data;
    }
    return success;
  }

  initializeFullTableFromEnTable(): void {
    const fullTablePath = this.getWritablePath(FULL_TABLE_FILE);

    if (fs.existsSync(fullTablePath)) {
      logger.info('full_table.json already exists');
      return;
    }

    logger.info('Initializing full_table.json from comprehensive_item_mapping.json');
    const itemMapping = this.loadBundledJson<
      Record<string, { id: string; name_en?: string; type_en?: string }>
    >(COMPREHENSIVE_ITEM_DATABASE_FILE, {});

    const fullTable: Record<string, ItemData> = {};
    for (const [id, data] of Object.entries(itemMapping)) {
      fullTable[id] = {
        name: data.name_en ?? `Item ${id}`,
        type: data.type_en,
        price: 0,
        last_update: 0,
      };
    }

    this.saveFullTable(fullTable);
    logger.info(`Initialized full_table.json with ${Object.keys(fullTable).length} items`);
  }

  async updateItem(itemId: string, updates: Partial<ItemData>): Promise<boolean> {
    const fullTable = this.loadFullTable(true);

    if (!fullTable[itemId]) {
      logger.warn(`Item ${itemId} not found in table`);
      return false;
    }

    const currentItem = fullTable[itemId];
    const currentTime = Math.floor(Date.now() / 1000);
    const lastApiSync = currentItem.last_api_sync ?? 0;
    const timeSinceApiSync = currentTime - lastApiSync;

    // Always update locally with fresh game data
    fullTable[itemId] = {
      ...currentItem,
      ...updates,
      last_update: currentTime,
    };

    const localSuccess = this.saveFullTable(fullTable);

    // Sync to API if enough time has passed since last API sync
    if (localSuccess && timeSinceApiSync >= API_UPDATE_THROTTLE) {
      try {
        const apiUpdates = {
          price: updates.price,
          last_update: currentTime,
        };
        const apiResult = await this.apiClient.updateItem(itemId, apiUpdates);
        if (apiResult) {
          // Update last_api_sync timestamp after successful sync
          fullTable[itemId].last_api_sync = currentTime;
          this.saveFullTable(fullTable);
          logger.info(`Synced price update to API for item ${itemId}: ${updates.price}`);
        }
      } catch (error) {
        logger.error(`Error syncing price update to API for item ${itemId}:`, error);
        // Don't fail the local update if API fails
      }
    }

    return localSuccess;
  }

  getItemInfo(itemId: string): ItemData | null {
    // First check comprehensive item database
    const compDb = this.loadBundledJson<Record<string, ComprehensiveItemEntry>>(
      COMPREHENSIVE_ITEM_DATABASE_FILE,
      {}
    );
    if (compDb[itemId]) {
      return compDb[itemId] as unknown as ItemData;
    }

    // Fall back to full table
    const fullTable = this.loadFullTable(true);
    return fullTable[itemId] ?? null;
  }

  exportDebugLog(filePath: string): void {
    const logPath = path.join(this.userDataPath, 'tracker.log');
    if (fs.existsSync(logPath)) {
      fs.copyFileSync(logPath, filePath);
    } else {
      fs.writeFileSync(filePath, 'No log file found', 'utf-8');
    }
  }

  logDrop(itemId: string, quantity: number, price: number): void {
    const dropLogPath = this.getWritablePath(DROP_LOG_FILE);
    const timestamp = new Date().toISOString();
    const itemInfo = this.getItemInfo(itemId);
    const itemName = itemInfo?.name ?? itemId;
    const logEntry = `[${timestamp}] ${itemName} (ID: ${itemId}) x${quantity} @ ${price}\n`;

    try {
      fs.appendFileSync(dropLogPath, logEntry, 'utf-8');
    } catch (error) {
      logger.error('Error writing to drop log:', error);
    }
  }

  /**
   * Fetch price for a specific item from the API.
   * Updates the local table if a price is found.
   */
  async fetchPriceFromAPI(itemId: string): Promise<number | null> {
    try {
      const apiItem = await this.apiClient.getItem(itemId);
      if (apiItem?.price !== undefined) {
        const fullTable = this.loadFullTable(true);
        if (fullTable[itemId]) {
          const apiLastUpdate = apiItem.last_update ?? Math.floor(Date.now() / 1000);
          const localLastUpdate = fullTable[itemId].last_update ?? 0;

          // Only update price if API data is fresher than local
          if (apiLastUpdate > localLastUpdate) {
            fullTable[itemId].price = apiItem.price;
            fullTable[itemId].last_update = apiLastUpdate;
          }

          // Always track what the API currently has
          fullTable[itemId].last_api_sync = apiLastUpdate;
          this.saveFullTable(fullTable);
          logger.info(`Fetched price from API for ${itemId}: ${apiItem.price}`);
          return apiItem.price;
        }
      }
    } catch (error) {
      logger.error(`Error fetching price from API for ${itemId}:`, error);
    }
    return null;
  }

  /**
   * Sync prices from the API into the existing local table.
   * Only updates price-related fields; item names/types come from the
   * bundled comprehensive mapping (set during initialization).
   */
  async syncAllPricesFromAPI(): Promise<number> {
    try {
      logger.info('Fetching all items from API...');
      const apiItems = await this.apiClient.getAllItems(undefined, false);

      if (!apiItems) {
        logger.warn('Failed to fetch items from API');
        return 0;
      }

      const fullTable = this.loadFullTable(false);
      let updatedCount = 0;

      for (const [itemId, apiItem] of Object.entries(apiItems)) {
        const apiLastUpdate = apiItem.last_update ?? Math.floor(Date.now() / 1000);

        if (fullTable[itemId]) {
          // Update only price-related fields on existing items
          fullTable[itemId].price = apiItem.price ?? fullTable[itemId].price ?? 0;
          fullTable[itemId].last_update = apiLastUpdate;
          fullTable[itemId].last_api_sync = apiLastUpdate;
        } else {
          // New item not in comprehensive mapping — add with API metadata
          fullTable[itemId] = {
            name: apiItem.name_en ?? apiItem.name ?? `Item ${itemId}`,
            type: apiItem.type_en ?? apiItem.type,
            price: apiItem.price ?? 0,
            last_update: apiLastUpdate,
            last_api_sync: apiLastUpdate,
          };
        }
        updatedCount++;
      }

      this.saveFullTable(fullTable);
      logger.info(`Synced prices for ${updatedCount} items from API`);

      return updatedCount;
    } catch (error) {
      logger.error('Error syncing prices from API:', error);
      return 0;
    }
  }
}
