import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import axios from 'axios';
import { Logger } from './Logger';
import { APIClient } from './APIClient';
import { API_UPDATE_THROTTLE } from './constants';

const logger = Logger.getInstance();

export interface ItemData {
  price?: number;
  last_update?: number;
  name?: string;
  name_en?: string;
  type?: string;
  type_en?: string;
  [key: string]: any;
}

export interface ComprehensiveItemEntry {
  id: string;
  name_en: string;
  type_en: string;
  img?: string;
}

export class FileManager {
  private fullTableCache: Record<string, ItemData> | null = null;
  private cacheTimestamp: number = 0;
  private apiUrl: string;
  private userDataPath: string;
  private resourcePath: string;
  private itemDatabase: Record<string, ComprehensiveItemEntry> | null = null;
  private apiClient: APIClient;
  private apiEnabled: boolean = true;

  constructor() {
    this.userDataPath = app.getPath('userData');
    this.resourcePath = app.isPackaged
      ? process.resourcesPath
      : path.join(process.cwd(), '..');

    this.apiUrl = 'https://torchlight-price-tracker.onrender.com';
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

  private getWritablePath(filename: string): string {
    return path.join(this.userDataPath, filename);
  }

  async ensureFileExists(filename: string, defaultContent: any): Promise<void> {
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

  loadJson<T = any>(filename: string, defaultValue: T = {} as T): T {
    try {
      const filePath = this.getResourcePath(filename);
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn(`Could not load ${filename}:`, error);
      return defaultValue;
    }
  }

  saveJson(filename: string, data: any): boolean {
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

    const data = this.loadJson<Record<string, ItemData>>('full_table.json', {});

    // Merge with comprehensive item database to get proper names
    if (!this.itemDatabase) {
      this.itemDatabase = this.loadJson<Record<string, ComprehensiveItemEntry>>(
        'comprehensive_item_mapping.json',
        {}
      );
    }

    // Enrich full table with item names and types from comprehensive database
    for (const [itemId, item] of Object.entries(data)) {
      const comprehensiveItem = this.itemDatabase[itemId];
      if (comprehensiveItem) {
        // Always prefer comprehensive database name (it's more reliable)
        // Or use it if current name is missing or not a string
        if (comprehensiveItem.name_en && (typeof item.name !== 'string' || !item.name)) {
          item.name = comprehensiveItem.name_en;
        }
        // Add type if missing or not a string
        if (comprehensiveItem.type_en && (typeof item.type !== 'string' || !item.type)) {
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
    const success = this.saveJson('full_table.json', data);
    if (success) {
      this.fullTableCache = data;
    }
    return success;
  }

  async initializeFullTableFromEnTable(): Promise<void> {
    const fullTablePath = this.getWritablePath('full_table.json');

    if (fs.existsSync(fullTablePath)) {
      logger.info('full_table.json already exists');
      return;
    }

    logger.info('Initializing full_table.json from comprehensive_item_mapping.json');
    const itemMapping = this.loadJson<Record<string, { id: string; name_en?: string; type_en?: string }>>('comprehensive_item_mapping.json', {});

    const fullTable: Record<string, ItemData> = {};
    for (const [id, data] of Object.entries(itemMapping)) {
      fullTable[id] = {
        name: data.name_en || `Item ${id}`,
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
    const localLastUpdate = currentItem.last_update || 0;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeSinceUpdate = currentTime - localLastUpdate;

    if (timeSinceUpdate < API_UPDATE_THROTTLE) {
      logger.debug(`Item ${itemId} updated recently (${timeSinceUpdate}s ago), skipping update`);
      return true;
    }

    // Update locally
    fullTable[itemId] = {
      ...currentItem,
      ...updates,
      last_update: currentTime,
    };

    const localSuccess = this.saveFullTable(fullTable);

    // Update API if enabled
    if (this.apiEnabled && localSuccess) {
      try {
        const apiUpdates = {
          price: updates.price,
          last_update: currentTime,
        };
        const apiResult = await this.apiClient.updateItem(itemId, apiUpdates);
        if (apiResult) {
          logger.info(`Successfully synced price update to API for item ${itemId}`);
        } else {
          logger.warn(`Failed to sync price update to API for item ${itemId}`);
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
    const compDb = this.loadJson<Record<string, any>>('comprehensive_item_mapping.json', {});
    if (compDb[itemId]) {
      return compDb[itemId];
    }

    // Fall back to full table
    const fullTable = this.loadFullTable(true);
    return fullTable[itemId] || null;
  }

  async exportDebugLog(filePath: string): Promise<void> {
    const logPath = path.join(this.userDataPath, 'tracker.log');
    if (fs.existsSync(logPath)) {
      fs.copyFileSync(logPath, filePath);
    } else {
      fs.writeFileSync(filePath, 'No log file found', 'utf-8');
    }
  }

  logDrop(itemId: string, quantity: number, price: number): void {
    const dropLogPath = this.getWritablePath('drop.txt');
    const timestamp = new Date().toISOString();
    const itemInfo = this.getItemInfo(itemId);
    const itemName = itemInfo?.name || itemId;
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
    if (!this.apiEnabled) {
      return null;
    }

    try {
      const apiItem = await this.apiClient.getItem(itemId);
      if (apiItem && apiItem.price !== undefined) {
        const fullTable = this.loadFullTable(true);
        if (fullTable[itemId]) {
          fullTable[itemId].price = apiItem.price;
          fullTable[itemId].last_update = Math.floor(Date.now() / 1000);
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
   * Sync all items from the API to local table.
   * This fetches the latest prices for all items.
   */
  async syncAllPricesFromAPI(): Promise<number> {
    if (!this.apiEnabled) {
      logger.warn('API is disabled, skipping price sync');
      return 0;
    }

    try {
      logger.info('Fetching all items from API...');
      const apiItems = await this.apiClient.getAllItems(undefined, false);

      if (!apiItems) {
        logger.warn('Failed to fetch items from API');
        return 0;
      }

      const fullTable = this.loadFullTable(true);
      let updateCount = 0;

      for (const [itemId, apiItem] of Object.entries(apiItems)) {
        if (fullTable[itemId] && apiItem.price !== undefined) {
          fullTable[itemId].price = apiItem.price;
          fullTable[itemId].last_update = apiItem.last_update || Math.floor(Date.now() / 1000);
          updateCount++;
        }
      }

      if (updateCount > 0) {
        this.saveFullTable(fullTable);
        logger.info(`Synced ${updateCount} item prices from API`);
      }

      return updateCount;
    } catch (error) {
      logger.error('Error syncing prices from API:', error);
      return 0;
    }
  }

  /**
   * Enable or disable API integration.
   */
  setAPIEnabled(enabled: boolean): void {
    this.apiEnabled = enabled;
    logger.info(`API integration ${enabled ? 'enabled' : 'disabled'}`);
  }
}
