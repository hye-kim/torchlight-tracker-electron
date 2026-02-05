// Shared type definitions for Torchlight Tracker

export interface DisplayItem {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

export interface Config {
  tax: number;
  user: string;
  overlayMode?: boolean;
  clickThrough?: boolean;
  fontSize?: number;
  displayItems?: DisplayItem[];
}

export interface Stats {
  currentMap: {
    mapCount: number;
    duration: number;
    feIncome: number;
    incomePerMinute: number;
  };
  total: {
    mapCount: number;
    duration: number;
    feIncome: number;
    incomePerMinute: number;
  };
}

export interface Drop {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  type: string;
  timestamp: number;
  imageUrl?: string;
}

export interface MapItemData {
  itemId: string;
  quantity: number;
}

export interface MapLog {
  mapNumber: number;
  mapName: string;
  startTime: number;
  revenue: number;
  cost: number;
  profit: number;
  duration: number;
  drops?: MapItemData[];
  costs?: MapItemData[];
}

export interface CurrentMapData {
  mapNumber: number;
  mapName: string;
  startTime: number;
  revenue: number;
  cost: number;
  profit: number;
  duration: number;
  drops?: MapItemData[];
  costs?: MapItemData[];
}

export type NavView = 'overview' | 'inventory' | 'history';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export interface UpdateConfig {
  autoDownload: boolean;
  autoInstall: boolean;
  checkOnStartup: boolean;
  checkInterval: number;
}

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  info?: UpdateInfo;
  error?: string;
}

export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export interface BagState {
  items: MapItemData[];
}

export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  mapCount: number;
  totalIncome: number;
  totalDuration: number;
}
