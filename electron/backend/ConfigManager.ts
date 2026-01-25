import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface Config {
  opacity: number;
  tax: number;
  user: string;
  window_x?: number;
  window_y?: number;
  window_width?: number;
  window_height?: number;
  api_url?: string;
}

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
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
      api_url: 'https://torchlight-price-tracker.onrender.com',
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
    return this.config.api_url || 'https://torchlight-price-tracker.onrender.com';
  }
}
