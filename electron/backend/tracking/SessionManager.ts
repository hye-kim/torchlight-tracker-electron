/**
 * Session management for the Torchlight Infinite Price Tracker.
 * Manages session history, auto-save, and cleanup.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Logger } from '../core/Logger';
import { MapLog } from './StatisticsTracker';
import { FileManager } from '../data/FileManager';
import { ConfigManager } from '../core/ConfigManager';
import { calculatePriceWithTax } from '../core/constants';

const logger = Logger.getInstance();
const SESSIONS_FILE = 'sessions.json';
const SESSION_RETENTION_DAYS = 30;

/**
 * Generate a unique session ID based on timestamp and random number
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface SessionStats {
  totalProfit: number;
  totalRevenue: number;
  totalCost: number;
  mapsCompleted: number;
  profitPerMinute: number;
  profitPerHour: number;
}

export interface Session {
  sessionId: string;
  title: string;
  startTime: number;
  endTime?: number;
  duration: number;
  stats: SessionStats;
  mapLogs: MapLog[];
  isActive: boolean;
  lastModified: number;
  priceSnapshotAtEnd?: Record<string, { price: number; taxedPrice: number }>;
}

export interface SessionsData {
  sessions: Session[];
  currentSessionId: string | null;
}

export class SessionManager {
  private sessionsPath: string;
  private sessionsData: SessionsData;

  constructor(
    private fileManager: FileManager,
    private configManager: ConfigManager
  ) {
    const userDataPath = app.getPath('userData');
    this.sessionsPath = path.join(userDataPath, SESSIONS_FILE);
    this.sessionsData = this.loadSessions();
  }

  /**
   * Load sessions from disk
   */
  private loadSessions(): SessionsData {
    try {
      if (fs.existsSync(this.sessionsPath)) {
        const data = fs.readFileSync(this.sessionsPath, 'utf-8');
        const parsed = JSON.parse(data) as SessionsData;
        logger.info(`Loaded ${parsed.sessions.length} sessions from disk`);
        return parsed;
      }
    } catch (error) {
      logger.error('Error loading sessions:', error);
    }

    // Default empty sessions
    return {
      sessions: [],
      currentSessionId: null,
    };
  }

  /**
   * Save sessions to disk
   */
  saveSessions(): void {
    try {
      const dir = path.dirname(this.sessionsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.sessionsPath, JSON.stringify(this.sessionsData, null, 2), 'utf-8');
      logger.info('Sessions saved to disk');
    } catch (error) {
      logger.error('Error saving sessions:', error);
    }
  }

  /**
   * Generate session title in format: "YYYY-MM-DD - HH:MM:SS - duration"
   */
  private generateSessionTitle(session: Session): string {
    const date = new Date(session.startTime);

    // Format: "YYYY-MM-DD - HH:MM:SS - Xh Ym"
    const datePart = date.toISOString().split('T')[0];
    const timePart = date.toTimeString().split(' ')[0];

    const hours = Math.floor(session.duration / 3600);
    const minutes = Math.floor((session.duration % 3600) / 60);
    const durationPart = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return `${datePart} - ${timePart} - ${durationPart}`;
  }

  /**
   * Calculate session statistics from map logs
   */
  private calculateSessionStats(mapLogs: MapLog[], duration: number): SessionStats {
    let totalRevenue = 0;
    let totalCost = 0;

    for (const mapLog of mapLogs) {
      totalRevenue += mapLog.revenue;
      totalCost += mapLog.cost;
    }

    const totalProfit = totalRevenue - totalCost;
    const profitPerMinute = duration > 0 ? totalProfit / (duration / 60) : 0;
    const profitPerHour = duration > 0 ? totalProfit / (duration / 3600) : 0;

    return {
      totalProfit,
      totalRevenue,
      totalCost,
      mapsCompleted: mapLogs.length,
      profitPerMinute,
      profitPerHour,
    };
  }

  /**
   * Start a new session
   */
  startNewSession(): Session {
    const sessionId = generateSessionId();
    const startTime = Date.now();

    const newSession: Session = {
      sessionId,
      title: '', // Will be generated when session ends
      startTime,
      endTime: undefined,
      duration: 0,
      stats: {
        totalProfit: 0,
        totalRevenue: 0,
        totalCost: 0,
        mapsCompleted: 0,
        profitPerMinute: 0,
        profitPerHour: 0,
      },
      mapLogs: [],
      isActive: true,
      lastModified: startTime,
    };

    // Generate initial title with 0 duration
    newSession.title = this.generateSessionTitle(newSession);

    this.sessionsData.sessions.push(newSession);
    this.sessionsData.currentSessionId = sessionId;

    logger.info(`Started new session: ${sessionId}`);
    return newSession;
  }

  /**
   * End the current session
   */
  endCurrentSession(): void {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      logger.warn('No current session to end');
      return;
    }

    // Capture price snapshot at session end
    const fullTable = this.fileManager.loadFullTable();
    const taxEnabled = this.configManager.getTaxMode() === 1;
    const priceSnapshot: Record<string, { price: number; taxedPrice: number }> = {};

    for (const [itemId, itemData] of Object.entries(fullTable)) {
      const basePrice = itemData.price ?? 0;
      priceSnapshot[itemId] = {
        price: basePrice,
        taxedPrice: calculatePriceWithTax(basePrice, itemId, taxEnabled),
      };
    }

    const endTime = Date.now();
    currentSession.endTime = endTime;
    currentSession.duration = Math.floor((endTime - currentSession.startTime) / 1000);
    currentSession.isActive = false;
    currentSession.lastModified = endTime;
    currentSession.priceSnapshotAtEnd = priceSnapshot;

    // Recalculate stats with final duration
    currentSession.stats = this.calculateSessionStats(
      currentSession.mapLogs,
      currentSession.duration
    );

    // Regenerate title with final duration
    currentSession.title = this.generateSessionTitle(currentSession);

    this.sessionsData.currentSessionId = null;

    logger.info(
      `Ended session: ${currentSession.sessionId} (duration: ${currentSession.duration}s)`
    );
  }

  /**
   * Get current active session
   */
  getCurrentSession(): Session | null {
    if (!this.sessionsData.currentSessionId) {
      return null;
    }

    const session = this.sessionsData.sessions.find(
      (s) => s.sessionId === this.sessionsData.currentSessionId
    );

    return session ?? null;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): Session[] {
    return this.sessionsData.sessions;
  }

  /**
   * Get session by ID
   */
  getSessionById(sessionId: string): Session | null {
    const session = this.sessionsData.sessions.find((s) => s.sessionId === sessionId);
    return session ?? null;
  }

  /**
   * Delete a single session
   */
  deleteSession(sessionId: string): void {
    const session = this.getSessionById(sessionId);

    // Don't allow deleting active session
    if (session?.isActive) {
      logger.warn('Cannot delete active session');
      return;
    }

    this.sessionsData.sessions = this.sessionsData.sessions.filter(
      (s) => s.sessionId !== sessionId
    );

    logger.info(`Deleted session: ${sessionId}`);
  }

  /**
   * Delete multiple sessions
   */
  deleteSessions(sessionIds: string[]): void {
    for (const id of sessionIds) {
      this.deleteSession(id);
    }
    this.saveSessions();
  }

  /**
   * Add a completed map to the current session
   */
  addMapToCurrentSession(mapLog: MapLog): void {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      logger.warn('No current session to add map to');
      return;
    }

    currentSession.mapLogs.push(mapLog);

    // Update duration (time from session start to now)
    currentSession.duration = Math.floor((Date.now() - currentSession.startTime) / 1000);
    currentSession.lastModified = Date.now();

    // Recalculate stats
    currentSession.stats = this.calculateSessionStats(
      currentSession.mapLogs,
      currentSession.duration
    );

    // Update title with new duration
    currentSession.title = this.generateSessionTitle(currentSession);

    logger.info(`Added map #${mapLog.mapNumber} to session ${currentSession.sessionId}`);
  }

  /**
   * Clean up sessions older than retention period (30 days)
   */
  cleanupOldSessions(): void {
    const retentionMs = SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;

    const sessionsToKeep = this.sessionsData.sessions.filter((session) => {
      // Always keep active session
      if (session.isActive) {
        return true;
      }

      // Keep sessions within retention period
      return session.startTime > cutoffTime;
    });

    const deletedCount = this.sessionsData.sessions.length - sessionsToKeep.length;
    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} sessions older than ${SESSION_RETENTION_DAYS} days`);
      this.sessionsData.sessions = sessionsToKeep;
      this.saveSessions();
    } else {
      logger.info('No old sessions to clean up');
    }
  }

  /**
   * Update map logs in current session when prices change
   */
  updateCurrentSessionMapLogs(mapLogs: MapLog[]): void {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      return;
    }

    // Update map logs with new price calculations
    currentSession.mapLogs = mapLogs;

    // Recalculate stats
    currentSession.stats = this.calculateSessionStats(
      currentSession.mapLogs,
      currentSession.duration
    );

    currentSession.lastModified = Date.now();
  }
}
