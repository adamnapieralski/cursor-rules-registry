import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { info, error } from './logger';

const execAsync = promisify(exec);

/**
 * Get user email from git configuration
 */
export async function getUserEmailFromGit(): Promise<string | null> {
	try {
		// Try to get email from git config
		const { stdout } = await execAsync('git config --global user.email');
		const email = stdout.trim();
		
		if (email && isValidEmail(email)) {
			info(`Found user email from git config: ${email}`);
			return email;
		}
		
		// Try local git config if global is not set
		const { stdout: localEmail } = await execAsync('git config user.email');
		const localEmailTrimmed = localEmail.trim();
		
		if (localEmailTrimmed && isValidEmail(localEmailTrimmed)) {
			info(`Found user email from local git config: ${localEmailTrimmed}`);
			return localEmailTrimmed;
		}
		
		info('No valid email found in git config');
		return null;
		
	} catch (err) {
		error('Failed to get user email from git config', err as Error);
		return null;
	}
}

/**
 * Get user email from Cursor settings as fallback
 */
export async function getUserEmailFromCursorSettings(): Promise<string | null> {
	try {
		const email = vscode.workspace.getConfiguration('cursor').get<string>('user.email');
		
		if (email && isValidEmail(email)) {
			info(`Found user email from Cursor settings: ${email}`);
			return email;
		}
		
		info('No valid email found in Cursor settings');
		return null;
		
	} catch (err) {
		error('Failed to get user email from Cursor settings', err as Error);
		return null;
	}
}

/**
 * Get user email with fallback strategy
 */
export async function getUserEmail(): Promise<string | null> {
	// First try git config
	const gitEmail = await getUserEmailFromGit();
	if (gitEmail) {
		return gitEmail;
	}
	
	// Fallback to Cursor settings
	const cursorEmail = await getUserEmailFromCursorSettings();
	if (cursorEmail) {
		return cursorEmail;
	}
	
	info('No user email found in git config or Cursor settings');
	return null;
}

/**
 * Validate email format (basic validation)
 */
export function isValidEmail(email: string): boolean {
	// Basic email validation regex
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Check if email is from Samsara domain
 */
export function isSamsaraEmail(email: string): boolean {
	return email.toLowerCase().endsWith('@samsara.com');
}

/**
 * Get git repository root directory
 */
export async function getGitRoot(): Promise<string | null> {
	try {
		const { stdout } = await execAsync('git rev-parse --show-toplevel');
		const gitRoot = stdout.trim();
		
		if (gitRoot) {
			info(`Found git root: ${gitRoot}`);
			return gitRoot;
		}
		
		return null;
		
	} catch (err) {
		error('Failed to get git root', err as Error);
		return null;
	}
}

/**
 * Check if current directory is a git repository
 */
export async function isGitRepository(): Promise<boolean> {
	try {
		await execAsync('git rev-parse --git-dir');
		return true;
	} catch (err) {
		return false;
	}
}

/**
 * Get current git branch
 */
export async function getCurrentBranch(): Promise<string | null> {
	try {
		const { stdout } = await execAsync('git branch --show-current');
		const branch = stdout.trim();
		
		if (branch) {
			info(`Current git branch: ${branch}`);
			return branch;
		}
		
		return null;
		
	} catch (err) {
		error('Failed to get current git branch', err as Error);
		return null;
	}
} 