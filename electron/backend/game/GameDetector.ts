/**
 * Game detection and log file location for Torchlight Infinite.
 * Handles finding the game process and log file.
 */

import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { Logger } from '../core/Logger';

const logger = Logger.getInstance();

export interface GameDetectionResult {
  gameFound: boolean;
  logFilePath: string | null;
}

interface ProcessInfo {
  pid: number;
  name: string;
  exePath: string;
}

export interface GameDetectorEvents {
  gameDetected: (info: { logFilePath: string; gameExePath: string }) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface GameDetector {
  on<K extends keyof GameDetectorEvents>(event: K, listener: GameDetectorEvents[K]): this;
  emit<K extends keyof GameDetectorEvents>(
    event: K,
    ...args: Parameters<GameDetectorEvents[K]>
  ): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging, no-redeclare
export class GameDetector extends EventEmitter {
  // @ts-expect-error - Reserved for future use
  private _gameFound: boolean = false;
  private logFilePath: string | null = null;
  private gameExePath: string | null = null;

  constructor() {
    super();
  }

  /**
   * Get torch-related processes using tasklist and WMIC.
   * Optimized: only query WMIC for processes that might be the game.
   */
  private getRunningProcesses(): ProcessInfo[] {
    try {
      // First, get all process names and PIDs using tasklist (very fast)
      const tasklistCmd = `tasklist /FO CSV /NH`;
      const tasklistOutput = execSync(tasklistCmd, {
        encoding: 'utf-8',
        windowsHide: true,
        timeout: 5000,
      });

      const processList: ProcessInfo[] = [];
      const candidateProcesses: Array<{ name: string; pid: number }> = [];
      const lines = tasklistOutput.split('\n').filter((line: string) => line.trim());

      // Parse tasklist output and identify candidates
      for (const line of lines) {
        if (!line.trim()) continue;

        const match = line.match(/"([^"]+)","(\d+)"/);
        if (!match?.[1] || !match[2]) continue;

        const exeName = match[1];
        const pid = parseInt(match[2], 10);

        if (!exeName || !pid) continue;

        const processName = exeName.toLowerCase().replace('.exe', '');

        // Only query WMIC for processes that might be the game
        // This dramatically speeds up startup (from 139 queries to ~5-10)
        const mightBeGame =
          processName.includes('torchlight') ||
          processName.includes('torch') ||
          processName === 'tl' ||
          processName.includes('ue_');

        if (mightBeGame) {
          candidateProcesses.push({ name: processName, pid });
        }
      }

      logger.debug(`Found ${candidateProcesses.length} candidate processes to check`);

      // Now only query WMIC for candidate processes
      for (const { name, pid } of candidateProcesses) {
        try {
          const wmicCmd = `wmic process where "ProcessId=${pid}" get ExecutablePath /format:csv`;
          const wmicOutput = execSync(wmicCmd, {
            encoding: 'utf-8',
            windowsHide: true,
            timeout: 1000,
          });

          const wmicLines = wmicOutput.split('\n').filter((l: string) => l.trim());
          if (wmicLines.length > 1) {
            const line = wmicLines[1];
            if (line) {
              const parts = line.split(',');
              const exePath = parts[1]?.trim();
              if (exePath) {
                processList.push({ pid, name, exePath });
                continue;
              }
            }
          }
        } catch {
          // WMIC failed, continue
        }

        // If WMIC fails, add process without path
        processList.push({ pid, name, exePath: '' });
      }

      logger.info(`Found ${processList.length} torch-related processes`);
      return processList;
    } catch (error) {
      logger.error('Error getting running processes:', error);
      return [];
    }
  }

  /**
   * Find the game process by looking for Torchlight executable.
   * Returns process information if found.
   */
  private findGameProcess(): ProcessInfo | null {
    try {
      const processes = this.getRunningProcesses();

      logger.info(`Scanning ${processes.length} running processes...`);

      // DEBUG: Log all processes that might be related to Torchlight
      const torchlightRelated = processes.filter(
        (p) =>
          p.name.toLowerCase().includes('torch') ||
          p.name.toLowerCase().includes('tl') ||
          p.name.toLowerCase().includes('ue_') ||
          p.exePath.toLowerCase().includes('torch') ||
          p.exePath.toLowerCase().includes('ue_game')
      );
      if (torchlightRelated.length > 0) {
        logger.info(`DEBUG: Found ${torchlightRelated.length} potentially related processes:`);
        torchlightRelated.forEach((p) => {
          const exeFile = p.exePath ? path.basename(p.exePath) : 'N/A';
          logger.info(`  - Name: "${p.name}", Exe: "${exeFile}", Path: "${p.exePath || 'N/A'}"`);
        });
      }

      // Look for Torchlight process
      for (const proc of processes) {
        const exePath = proc.exePath.toLowerCase();
        const exeName = exePath ? path.basename(exePath).toLowerCase() : '';
        const processName = proc.name.toLowerCase();

        // Exclude the tracker app itself!
        if (processName.includes('tracker') || exeName.includes('tracker')) {
          logger.debug(`Skipping tracker app: ${proc.name}`);
          continue;
        }

        // Check if it's the Torchlight game executable
        // Actual process name: "torchlight_infinite" (confirmed from logs)
        const isTorchlightGame =
          processName === 'torchlight_infinite' || // Exact match from logs
          processName.includes('torchlight') || // Matches any variation
          processName === 'tl' ||
          processName.includes('ue_game') ||
          processName === 'ue-game' ||
          processName === 'client-win64-shipping' ||
          exeName.includes('torchlight') ||
          exeName === 'torchlight_infinite.exe' ||
          exeName.includes('ue_game') ||
          exeName === 'ue-game.exe' ||
          exeName === 'client-win64-shipping.exe';

        if (isTorchlightGame) {
          // If we have a path, verify it's in the actual game directory
          if (exePath) {
            const isRealGameDir =
              (exePath.includes('win64') &&
                (exePath.includes('binaries') || exePath.includes('ue_game'))) ||
              (exePath.includes('torchlight') && exePath.includes('win64'));

            if (isRealGameDir) {
              logger.info(`✓ Found Torchlight: Infinite game: ${proc.name}.exe (PID: ${proc.pid})`);
              logger.info(`  Executable path: ${proc.exePath}`);
              return proc;
            } else {
              logger.debug(`Skipping ${proc.name} - not in real game directory: ${exePath}`);
            }
          } else {
            // No path available (no admin rights), but name matches
            // Try to find the game installation by searching common locations
            logger.info(
              `✓ Found Torchlight: Infinite game by name: ${proc.name}.exe (PID: ${proc.pid})`
            );
            logger.warn(`  No executable path available (tracker not running as admin)`);
            logger.info(`  Searching for game installation in common locations...`);

            const foundPath = this.searchForGameInstallation();
            if (foundPath) {
              // Create a ProcessInfo with the found path
              return {
                pid: proc.pid,
                name: proc.name,
                exePath: foundPath,
              };
            } else {
              logger.error(`  Could not find game installation automatically`);
              logger.error(
                `  Please run the tracker as administrator, or manually configure the log file path`
              );
              return null;
            }
          }
        }
      }

      logger.warn('Torchlight: Infinite game process not found');
      logger.warn('Make sure Torchlight: Infinite is running before starting the tracker');
      logger.warn('Looking for process "torchlight_infinite" in Task Manager');
      return null;
    } catch (error) {
      logger.error('Error finding game process:', error);
      return null;
    }
  }

  /**
   * Search for Torchlight: Infinite installation in common locations.
   * Used as fallback when running without admin privileges.
   */
  private searchForGameInstallation(): string | null {
    const commonPaths = [
      // Steam common install locations
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Torchlight Infinite\\UE_game\\Binaries\\Win64\\torchlight_infinite.exe',
      'D:\\Games\\Steam\\steamapps\\common\\Torchlight Infinite\\UE_game\\Binaries\\Win64\\torchlight_infinite.exe',
      'E:\\Games\\Steam\\steamapps\\common\\Torchlight Infinite\\UE_game\\Binaries\\Win64\\torchlight_infinite.exe',
      'C:\\SteamLibrary\\steamapps\\common\\Torchlight Infinite\\UE_game\\Binaries\\Win64\\torchlight_infinite.exe',
      'D:\\SteamLibrary\\steamapps\\common\\Torchlight Infinite\\UE_game\\Binaries\\Win64\\torchlight_infinite.exe',

      // Default Steam install
      'C:\\Program Files\\Steam\\steamapps\\common\\Torchlight Infinite\\UE_game\\Binaries\\Win64\\torchlight_infinite.exe',

      // Epic Games
      'C:\\Program Files\\Epic Games\\Torchlight Infinite\\UE_game\\Binaries\\Win64\\torchlight_infinite.exe',

      // Standalone install
      'C:\\Program Files\\Torchlight Infinite\\UE_game\\Binaries\\Win64\\torchlight_infinite.exe',
      'C:\\Games\\Torchlight Infinite\\UE_game\\Binaries\\Win64\\torchlight_infinite.exe',
    ];

    for (const searchPath of commonPaths) {
      if (fs.existsSync(searchPath)) {
        logger.info(`  ✓ Found game at: ${searchPath}`);
        return searchPath;
      }
    }

    return null;
  }

  /**
   * Attempt to detect the running game and locate its log file.
   */
  detectGame(): GameDetectionResult {
    try {
      logger.info('Starting game detection...');

      // Find the Torchlight process
      const processInfo = this.findGameProcess();
      if (!processInfo) {
        logger.info('Torchlight: Infinite process not found');
        return { gameFound: false, logFilePath: null };
      }

      const exePath = processInfo.exePath;
      this.gameExePath = exePath;

      // Calculate log file path relative to game executable
      // Actual structure (confirmed from logs):
      // D:\Games\Steam\steamapps\common\Torchlight Infinite\UE_game\Binaries\Win64\torchlight_infinite.exe
      // D:\Games\Steam\steamapps\common\Torchlight Infinite\UE_game\TorchLight\Saved\Logs\UE_game.log
      // So: exe is at UE_game/Binaries/Win64/, log is at UE_game/TorchLight/Saved/Logs/

      const exeDir = path.dirname(exePath); // Win64
      const binariesDir = path.dirname(exeDir); // Binaries
      const ueGameDir = path.dirname(binariesDir); // UE_game
      const logPath = path.join(ueGameDir, 'TorchLight', 'Saved', 'Logs', 'UE_game.log');

      logger.info(`UE_game directory: ${ueGameDir}`);
      logger.info(`Expected log path: ${logPath}`);

      // Verify log file exists and is readable
      if (!fs.existsSync(logPath)) {
        logger.error(`Log file not found at: ${logPath}`);

        // Try alternative path (in case structure is different)
        const gameRootDir = path.dirname(ueGameDir); // Torchlight Infinite
        const altPath1 = path.join(gameRootDir, 'TorchLight', 'Saved', 'Logs', 'UE_game.log');
        logger.info(`Trying alternative at game root: ${altPath1}`);

        if (fs.existsSync(altPath1)) {
          logger.info(`✓ Found log at alternative path!`);
          this.logFilePath = altPath1;
        } else {
          logger.error('Log file not found at any expected location');
          logger.error(`Searched in: ${logPath}`);
          logger.error(`Also tried: ${altPath1}`);
          logger.error(`Please check if the game has created a log file`);
          return { gameFound: false, logFilePath: null };
        }
      } else {
        this.logFilePath = logPath;
      }

      // Verify log file is readable
      try {
        const stats = fs.statSync(this.logFilePath);
        logger.info(`Log file size: ${stats.size} bytes`);

        const preview = fs
          .readFileSync(this.logFilePath, { encoding: 'utf-8', flag: 'r' })
          .substring(0, 100);
        const previewClean = preview
          .replace(/\ufeff/g, '')
          .replace(/\r/g, '')
          .replace(/\n/g, ' ');
        logger.info(`Log file preview: ${previewClean.substring(0, 50)}...`);
      } catch (error) {
        logger.error(`Cannot read log file: ${String(error)}`);
        return { gameFound: false, logFilePath: null };
      }

      this._gameFound = true;
      logger.info(`✓ Game detected! Log file: ${this.logFilePath}`);

      // At this point, logFilePath is guaranteed to be non-null
      if (this.logFilePath) {
        this.emit('gameDetected', { logFilePath: this.logFilePath, gameExePath: exePath });
      }

      return { gameFound: true, logFilePath: this.logFilePath };
    } catch (error) {
      logger.error(`Error detecting game: ${String(error)}`);
      return { gameFound: false, logFilePath: null };
    }
  }

  /**
   * Get the detected log file path.
   */
  getLogFilePath(): string | null {
    return this.logFilePath;
  }

  /**
   * Check if the game is currently running.
   */
  isGameRunning(): boolean {
    try {
      const processInfo = this.findGameProcess();
      return processInfo !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get the game executable path.
   */
  getGameExePath(): string | null {
    return this.gameExePath;
  }

  /**
   * Check if Windows is supported (always true now with PowerShell approach).
   */
  static isWindowsSupported(): boolean {
    return process.platform === 'win32';
  }
}
