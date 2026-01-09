/**
 * Centralized logging utility
 * Provides consistent formatting and levels across the application
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Logger class with structured output and level management
 */
export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  /**
   * Set logging level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Format and output log message
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${level}`;

    if (data !== undefined) {
      console.log(`${prefix}: ${message}`, data);
    } else {
      console.log(`${prefix}: ${message}`);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: unknown): void {
    if (this._shouldLog(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message, data);
    }
  }

  /**
   * Log info message
   */
  info(message: string, data?: unknown): void {
    if (this._shouldLog(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message, data);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: unknown): void {
    if (this._shouldLog(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message, data);
    }
  }

  /**
   * Log error message
   */
  error(message: string, data?: unknown): void {
    if (this._shouldLog(LogLevel.ERROR)) {
      this.log(LogLevel.ERROR, message, data);
    }
  }

  /**
   * Check if message at this level should be logged
   */
  private _shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.level);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }
}

// Export singleton instance
const logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.DEBUG;
console.log(`[LOGGER INIT] LOG_LEVEL from env: '${process.env.LOG_LEVEL}', using: '${logLevel}'`);
export const logger = new Logger(logLevel);
