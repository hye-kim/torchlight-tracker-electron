import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { CONFIG_FILE, DEFAULT_API_URL } from './constants';

export interface DisplayItem {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

export interface UpdateConfig {
  autoCheck: boolean;
  skipVersion?: string;
  lastCheckTime?: number;
}

export interface Config {
  opacity: number;
  tax: number;
  user: string;
  window_x?: number;
  window_y?: number;
  window_width?: number;
  window_height?: number;
  overlay_width?: number;
  overlay_height?: number;
  api_url?: string;
  overlayMode?: boolean;
  clickThrough?: boolean;
  fontSize?: number;
  displayItems?: DisplayItem[];
  updates?: UpdateConfig;
}

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, CONFIG_FILE);
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }

    // Default config
    return {
      opacity: 1.0,
      tax: 0,
      user: '',
      api_url: DEFAULT_API_URL,
      overlayMode: false,
      clickThrough: false,
      fontSize: 14,
      displayItems: [
        { id: 'status', label: 'Status: Not Recording / Recording', enabled: true, order: 0 },
        { id: 'currentMap', label: 'Current Map', enabled: true, order: 1 },
        { id: 'currentProfitPerMin', label: 'Current Profit / min', enabled: true, order: 2 },
        { id: 'currentProfit', label: 'Current Profit', enabled: true, order: 3 },
        { id: 'totalProfitPerMin', label: 'Total Profit / min', enabled: true, order: 4 },
        { id: 'totalProfit', label: 'Total Profit', enabled: true, order: 5 },
        { id: 'mapDuration', label: 'Map Duration', enabled: true, order: 6 },
        { id: 'totalDuration', label: 'Total Duration', enabled: true, order: 7 },
        { id: 'mapCount', label: 'Map Count', enabled: true, order: 8 },
      ],
      updates: {
        autoCheck: true,
      },
    };
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Filter out overlayMode and clickThrough before saving
      const { overlayMode, clickThrough, ...configToSave } = this.config;
      fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  getConfig(): Config {
    // Always return overlayMode and clickThrough as false
    // These states should not be persisted
    return {
      ...this.config,
      overlayMode: false,
      clickThrough: false,
    };
  }

  updateConfig(updates: Partial<Config>): void {
    // Filter out overlayMode and clickThrough - these should never be persisted
    const { overlayMode, clickThrough, ...persistableUpdates } = updates;
    this.config = { ...this.config, ...persistableUpdates };
    this.saveConfig();
  }

  getOpacity(): number {
    return this.config.opacity;
  }

  setOpacity(opacity: number): void {
    this.config.opacity = Math.max(0.1, Math.min(1.0, opacity));
    this.saveConfig();
  }

  getTaxMode(): number {
    return this.config.tax;
  }

  setTaxMode(tax: number): void {
    this.config.tax = tax;
    this.saveConfig();
  }

  getApiUrl(): string {
    return this.config.api_url || DEFAULT_API_URL;
  }

  getOverlayMode(): boolean {
    return this.config.overlayMode ?? false;
  }

  setOverlayMode(_overlayMode: boolean): void {
    // Do not save overlay mode - it should not be persisted
    // This method is kept for compatibility but does nothing
  }

  getClickThrough(): boolean {
    return this.config.clickThrough ?? false;
  }

  setClickThrough(_clickThrough: boolean): void {
    // Do not save click through - it should not be persisted
    // This method is kept for compatibility but does nothing
  }

  getFontSize(): number {
    return this.config.fontSize ?? 14;
  }

  setFontSize(fontSize: number): void {
    this.config.fontSize = Math.max(8, Math.min(32, fontSize));
    this.saveConfig();
  }

  getDisplayItems(): DisplayItem[] {
    return (
      this.config.displayItems ?? [
        { id: 'status', label: 'Status: Not Recording / Recording', enabled: true, order: 0 },
        { id: 'currentMap', label: 'Current Map', enabled: true, order: 1 },
        { id: 'currentProfitPerMin', label: 'Current Profit / min', enabled: true, order: 2 },
        { id: 'currentProfit', label: 'Current Profit', enabled: true, order: 3 },
        { id: 'totalProfitPerMin', label: 'Total Profit / min', enabled: true, order: 4 },
        { id: 'totalProfit', label: 'Total Profit', enabled: true, order: 5 },
        { id: 'mapDuration', label: 'Map Duration', enabled: true, order: 6 },
        { id: 'totalDuration', label: 'Total Duration', enabled: true, order: 7 },
        { id: 'mapCount', label: 'Map Count', enabled: true, order: 8 },
      ]
    );
  }

  setDisplayItems(displayItems: DisplayItem[]): void {
    this.config.displayItems = displayItems;
    this.saveConfig();
  }

  getUpdateConfig(): UpdateConfig {
    return this.config.updates || { autoCheck: true };
  }

  setUpdateConfig(updateConfig: Partial<UpdateConfig>): void {
    this.config.updates = {
      ...this.getUpdateConfig(),
      ...updateConfig,
    };
    this.saveConfig();
  }

  getAutoCheckUpdates(): boolean {
    return this.config.updates?.autoCheck ?? true;
  }

  setAutoCheckUpdates(autoCheck: boolean): void {
    this.setUpdateConfig({ autoCheck });
  }

  getSkipVersion(): string | undefined {
    return this.config.updates?.skipVersion;
  }

  setSkipVersion(version: string | undefined): void {
    this.setUpdateConfig({ skipVersion: version });
  }

  getLastCheckTime(): number | undefined {
    return this.config.updates?.lastCheckTime;
  }

  setLastCheckTime(time: number): void {
    this.setUpdateConfig({ lastCheckTime: time });
  }
}
