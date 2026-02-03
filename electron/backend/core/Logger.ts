import winston from 'winston';
import path from 'path';
import { app } from 'electron';

export class Logger {
  private static instance: winston.Logger;

  static getInstance(): winston.Logger {
    if (!Logger.instance) {
      const logPath = app.isPackaged
        ? path.join(process.resourcesPath, 'tracker.log')
        : path.join(process.cwd(), 'tracker.log');

      Logger.instance = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
          }),
          winston.format.printf(
            (info: winston.Logform.TransformableInfo) => `${info.timestamp} - ${info.level.toUpperCase()}: ${info.message}`
          )
        ),
        transports: [
          new winston.transports.File({ filename: logPath }),
          new winston.transports.Console(),
        ],
      });
    }
    return Logger.instance;
  }
}
