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
    };
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  getConfig(): Config {
    return { ...this.config };
  }

  updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
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

  setOverlayMode(overlayMode: boolean): void {
    this.config.overlayMode = overlayMode;
    this.saveConfig();
  }

  getClickThrough(): boolean {
    return this.config.clickThrough ?? false;
  }

  setClickThrough(clickThrough: boolean): void {
    this.config.clickThrough = clickThrough;
    this.saveConfig();
  }

  getFontSize(): number {
    return this.config.fontSize ?? 14;
  }

  setFontSize(fontSize: number): void {
    this.config.fontSize = Math.max(8, Math.min(32, fontSize));
    this.saveConfig();
  }

  getDisplayItems(): DisplayItem[] {
    return this.config.displayItems ?? [
      { id: 'status', label: 'Status: Not Recording / Recording', enabled: true, order: 0 },
      { id: 'currentMap', label: 'Current Map', enabled: true, order: 1 },
      { id: 'currentProfitPerMin', label: 'Current Profit / min', enabled: true, order: 2 },
      { id: 'currentProfit', label: 'Current Profit', enabled: true, order: 3 },
      { id: 'totalProfitPerMin', label: 'Total Profit / min', enabled: true, order: 4 },
      { id: 'totalProfit', label: 'Total Profit', enabled: true, order: 5 },
      { id: 'mapDuration', label: 'Map Duration', enabled: true, order: 6 },
      { id: 'totalDuration', label: 'Total Duration', enabled: true, order: 7 },
      { id: 'mapCount', label: 'Map Count', enabled: true, order: 8 },
    ];
  }

  setDisplayItems(displayItems: DisplayItem[]): void {
    this.config.displayItems = displayItems;
    this.saveConfig();
  }
}
