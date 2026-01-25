/**
 * API client for Torchlight Price Tracker API.
 * Handles all HTTP communication with the remote API.
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Logger } from './Logger';
import {
  API_CACHE_TTL,
  API_RATE_LIMIT_CALLS,
  API_RATE_LIMIT_WINDOW,
  API_RETRY_BASE_DELAY,
} from './constants';

const logger = Logger.getInstance();

interface ItemData {
  name?: string;
  name_en?: string;
  type?: string;
  type_en?: string;
  price?: number;
  last_update?: number;
  [key: string]: any;
}

export class APIClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private axiosInstance: AxiosInstance;
  private cache: Map<string, ItemData> = new Map();
  private cacheTimestamp: number | null = null;
  private cacheTTL: number = API_CACHE_TTL;

  // Rate limiting
  private rateLimitCalls: number = API_RATE_LIMIT_CALLS;
  private rateLimitWindow: number = API_RATE_LIMIT_WINDOW;
  private requestTimestamps: number[] = [];

  constructor(baseUrl: string, timeout: number = 10, maxRetries: number = 3) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout * 1000; // Convert to milliseconds
    this.maxRetries = maxRetries;

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
    });
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now() / 1000; // Convert to seconds

    // Remove timestamps outside the current window
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => ts > now - this.rateLimitWindow
    );

    // If at limit, wait until oldest request falls outside window
    if (this.requestTimestamps.length >= this.rateLimitCalls) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = this.rateLimitWindow - (now - oldestRequest);
      if (waitTime > 0) {
        logger.warn(`Rate limit reached. Waiting ${waitTime.toFixed(1)}s before next request`);
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
        return this.checkRateLimit(); // Recursive call after waiting
      }
    }

    // Record this request
    this.requestTimestamps.push(now);
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    params?: any
  ): Promise<T | null> {
    // Prevent DELETE requests
    if (method.toUpperCase() === 'DELETE') {
      throw new Error('DELETE requests are not allowed by this application');
    }

    // Check rate limit before making request
    await this.checkRateLimit();

    const url = `${this.baseUrl}${endpoint}`;
    let lastError: any = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        let response: AxiosResponse<T>;

        switch (method.toUpperCase()) {
          case 'GET':
            response = await this.axiosInstance.get<T>(endpoint, { params });
            break;
          case 'POST':
            response = await this.axiosInstance.post<T>(endpoint, data);
            break;
          case 'PUT':
            response = await this.axiosInstance.put<T>(endpoint, data);
            break;
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }

        return response.data;
      } catch (error: any) {
        lastError = error;
        const statusCode = error.response?.status;

        // Don't retry on client errors (4xx) except timeout-related ones
        if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 408 && statusCode !== 429) {
          logger.error(`Client error ${statusCode} for ${method} ${url}, not retrying`);
          return null;
        }

        logger.warn(`Request error on attempt ${attempt + 1}/${this.maxRetries}: ${error.message}`);

        // If this was the last attempt, log final error
        if (attempt === this.maxRetries - 1) {
          logger.error(
            `Failed to ${method} ${url} after ${this.maxRetries} attempts. Last error: ${error.message}`
          );
          return null;
        }

        // Exponential backoff
        const delay = Math.pow(API_RETRY_BASE_DELAY, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return null;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest<any>('GET', '/');
      if (response) {
        logger.info('API health check successful');
        return true;
      }
    } catch (error: any) {
      logger.error(`API health check failed: ${error.message}`);
    }
    return false;
  }

  async getAllItems(itemType?: string, useCache: boolean = true): Promise<Record<string, ItemData> | null> {
    // Check cache
    if (useCache && this.isCacheValid()) {
      const cachedData: Record<string, ItemData> = {};
      this.cache.forEach((value, key) => {
        if (!itemType || value.type === itemType) {
          cachedData[key] = value;
        }
      });
      return cachedData;
    }

    const params = itemType ? { item_type: itemType } : undefined;
    const data = await this.makeRequest<Record<string, ItemData>>('GET', '/items', undefined, params);

    if (data) {
      // Update cache only if we fetched all items
      if (!itemType) {
        this.cache.clear();
        Object.entries(data).forEach(([itemId, itemData]) => {
          this.cache.set(itemId, itemData);
        });
        this.cacheTimestamp = Date.now() / 1000;
      }
      logger.debug(`Retrieved ${Object.keys(data).length} items from API`);
      return data;
    }

    return null;
  }

  async getItem(itemId: string): Promise<ItemData | null> {
    // Check cache first
    if (this.isCacheValid() && this.cache.has(itemId)) {
      return { ...this.cache.get(itemId)! };
    }

    const data = await this.makeRequest<ItemData>('GET', `/items/${itemId}`);
    if (data) {
      // Update item in cache
      if (this.cacheTimestamp) {
        this.cache.set(itemId, data);
      }
      return data;
    }

    return null;
  }

  async createItem(itemId: string, itemData: ItemData): Promise<ItemData | null> {
    const data = await this.makeRequest<ItemData>('POST', `/items/${itemId}`, itemData);
    if (data) {
      this.cache.set(itemId, data);
      logger.debug(`Created item ${itemId} via API`);
      return data;
    }
    return null;
  }

  async updateItem(itemId: string, updates: Partial<ItemData>): Promise<ItemData | null> {
    const putResponse = await this.makeRequest<ItemData>('PUT', `/items/${itemId}`, updates);
    if (putResponse) {
      this.cache.set(itemId, putResponse);
      logger.debug(`Updated item ${itemId} via API`);
      return putResponse;
    }
    return null;
  }

  async getItemTypes(): Promise<string[] | null> {
    return await this.makeRequest<string[]>('GET', '/types');
  }

  async getStats(): Promise<any | null> {
    return await this.makeRequest<any>('GET', '/stats');
  }

  invalidateCache(): void {
    this.cache.clear();
    this.cacheTimestamp = null;
    logger.debug('Cache invalidated');
  }

  private isCacheValid(): boolean {
    if (!this.cacheTimestamp) {
      return false;
    }
    return Date.now() / 1000 - this.cacheTimestamp < this.cacheTTL;
  }

  async syncLocalToAPI(localData: Record<string, ItemData>): Promise<number> {
    logger.info(`Starting sync of ${Object.keys(localData).length} items to API`);
    let successCount = 0;

    for (const [itemId, itemData] of Object.entries(localData)) {
      // Try to get existing item
      const existing = await this.getItem(itemId);

      if (existing) {
        // Update existing item
        if (await this.updateItem(itemId, itemData)) {
          successCount++;
        }
      } else {
        // Create new item
        if (await this.createItem(itemId, itemData)) {
          successCount++;
        }
      }
    }

    logger.info(`Sync complete: ${successCount}/${Object.keys(localData).length} items synced`);
    return successCount;
  }
}
