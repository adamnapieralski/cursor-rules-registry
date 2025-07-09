import * as vscode from 'vscode';

/**
 * Logging utility for the Cursor Rules Registry extension
 */

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3
}

export class Logger {
	private static instance: Logger;
	private outputChannel: vscode.OutputChannel;
	private logLevel: LogLevel = LogLevel.INFO;

	private constructor() {
		this.outputChannel = vscode.window.createOutputChannel('Cursor Rules Registry');
	}

	public static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger();
		}
		return Logger.instance;
	}

	/**
	 * Set the log level
	 */
	public setLogLevel(level: LogLevel): void {
		this.logLevel = level;
	}

	/**
	 * Log a debug message
	 */
	public debug(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.DEBUG) {
			this.log('DEBUG', message, ...args);
		}
	}

	/**
	 * Log an info message
	 */
	public info(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			this.log('INFO', message, ...args);
		}
	}

	/**
	 * Log a warning message
	 */
	public warn(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.WARN) {
			this.log('WARN', message, ...args);
		}
	}

	/**
	 * Log an error message
	 */
	public error(message: string, error?: Error, ...args: any[]): void {
		if (this.logLevel <= LogLevel.ERROR) {
			let fullMessage = message;
			if (error) {
				fullMessage += `\nError: ${error.message}`;
				if (error.stack) {
					fullMessage += `\nStack: ${error.stack}`;
				}
			}
			this.log('ERROR', fullMessage, ...args);
		}
	}

	/**
	 * Internal logging method
	 */
	private log(level: string, message: string, ...args: any[]): void {
		const timestamp = new Date().toISOString();
		const formattedMessage = `[${timestamp}] [${level}] ${message}`;
		
		// Log to output channel
		this.outputChannel.appendLine(formattedMessage);
		
		// Log additional arguments if any
		if (args.length > 0) {
			args.forEach(arg => {
				if (typeof arg === 'object') {
					this.outputChannel.appendLine(JSON.stringify(arg, null, 2));
				} else {
					this.outputChannel.appendLine(String(arg));
				}
			});
		}

		// Also log to console for development
		console.log(formattedMessage, ...args);
	}

	/**
	 * Show the output channel
	 */
	public showOutput(): void {
		this.outputChannel.show();
	}

	/**
	 * Clear the output channel
	 */
	public clear(): void {
		this.outputChannel.clear();
	}

	/**
	 * Dispose the output channel
	 */
	public dispose(): void {
		this.outputChannel.dispose();
	}
}

// Export convenience functions
export const logger = Logger.getInstance();

export function debug(message: string, ...args: any[]): void {
	logger.debug(message, ...args);
}

export function info(message: string, ...args: any[]): void {
	logger.info(message, ...args);
}

export function warn(message: string, ...args: any[]): void {
	logger.warn(message, ...args);
}

export function error(message: string, error?: Error, ...args: any[]): void {
	logger.error(message, error, ...args);
} 