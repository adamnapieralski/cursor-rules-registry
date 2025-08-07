import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { META_FILE_WARNING } from './metadataService';

/**
 * File system utilities for the Cursor Rules Registry extension
 */

export interface RegistryStructure {
	teams: string[];
	users: string[];
}

/**
 * Returns the registry directory name configured by the user (workspace or global) or default.
 */
export function getRegistryDirName(): string {
    const config = vscode.workspace.getConfiguration('cursorRulesRegistry');
    return config.get<string>('registryDirectory', '.cursor-rules-registry');
}

/**
 * Creates the .cursor-rules-registry directory structure if it doesn't exist
 */
export async function createRegistryStructure(workspaceRoot: string): Promise<void> {
	const registryPath = path.join(workspaceRoot, getRegistryDirName());
	const teamsPath = path.join(registryPath, 'teams');
	const usersPath = path.join(registryPath, 'users');

	try {
		// Create main registry directory
		if (!fs.existsSync(registryPath)) {
			fs.mkdirSync(registryPath, { recursive: true });
			console.log('Created .cursor-rules-registry directory');
		}

		// Create teams subdirectory
		if (!fs.existsSync(teamsPath)) {
			fs.mkdirSync(teamsPath, { recursive: true });
			console.log('Created .cursor-rules-registry/teams directory');
		}

		// Create users subdirectory
		if (!fs.existsSync(usersPath)) {
			fs.mkdirSync(usersPath, { recursive: true });
			console.log('Created .cursor-rules-registry/users directory');
		}

		// Create rules-metadata.jsonc if it doesn't exist
		const rulesMetadataPath = path.join(registryPath, 'rules-metadata.jsonc');
		if (!fs.existsSync(rulesMetadataPath)) {
			fs.writeFileSync(rulesMetadataPath, `${META_FILE_WARNING}\n{\n\n}`, 'utf8');
			console.log('Created rules-metadata.jsonc file');
		}

	} catch (error) {
		console.error('Error creating registry structure:', error);
		throw new Error(`Failed to create registry structure: ${error}`);
	}
}

/**
 * Scans registry directories recursively and returns discovered structure
 */
export async function scanRegistryDirectories(workspaceRoot: string): Promise<RegistryStructure> {
	const registryPath = path.join(workspaceRoot, getRegistryDirName());
	const teamsPath = path.join(registryPath, 'teams');
	const usersPath = path.join(registryPath, 'users');

	const structure: RegistryStructure = {
		teams: [],
		users: []
	};

	try {
		// Scan teams directory
		if (fs.existsSync(teamsPath)) {
			const teamDirs = fs.readdirSync(teamsPath, { withFileTypes: true });
			structure.teams = teamDirs
				.filter(dirent => dirent.isDirectory())
				.map(dirent => dirent.name);
		}

		// Scan users directory
		if (fs.existsSync(usersPath)) {
			const userDirs = fs.readdirSync(usersPath, { withFileTypes: true });
			structure.users = userDirs
				.filter(dirent => dirent.isDirectory())
				.map(dirent => dirent.name);
		}

		console.log('Registry structure discovered:', structure);
		return structure;
	} catch (error) {
		console.error('Error scanning registry directories:', error);
		throw new Error(`Failed to scan registry directories: ${error}`);
	}
}

/**
 * Recursively scans a directory for .mdc files
 */
export async function scanForMdcFiles(directoryPath: string): Promise<string[]> {
	const mdcFiles: string[] = [];

	try {
		if (!fs.existsSync(directoryPath)) {
			return mdcFiles;
		}

		const items = fs.readdirSync(directoryPath, { withFileTypes: true });

		for (const item of items) {
			const fullPath = path.join(directoryPath, item.name);

			if (item.isDirectory()) {
				// Recursively scan subdirectories
				const subFiles = await scanForMdcFiles(fullPath);
				mdcFiles.push(...subFiles);
			} else if (item.isFile() && item.name.endsWith('.mdc')) {
				mdcFiles.push(fullPath);
			}
		}

		return mdcFiles;
	} catch (error) {
		console.error(`Error scanning directory ${directoryPath}:`, error);
		throw new Error(`Failed to scan directory ${directoryPath}: ${error}`);
	}
}

/**
 * Copies a file from source to destination
 */
export async function copyFile(sourcePath: string, destinationPath: string): Promise<void> {
	try {
		// Ensure destination directory exists
		const destDir = path.dirname(destinationPath);
		if (!fs.existsSync(destDir)) {
			fs.mkdirSync(destDir, { recursive: true });
		}

		// Copy the file
		fs.copyFileSync(sourcePath, destinationPath);
		console.log(`Copied file from ${sourcePath} to ${destinationPath}`);
	} catch (error) {
		console.error('Error copying file:', error);
		throw new Error(`Failed to copy file from ${sourcePath} to ${destinationPath}: ${error}`);
	}
}

/**
 * Removes a file if it exists
 */
export async function removeFile(filePath: string): Promise<void> {
	try {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			console.log(`Removed file: ${filePath}`);
		}
	} catch (error) {
		console.error('Error removing file:', error);
		throw new Error(`Failed to remove file ${filePath}: ${error}`);
	}
}

/**
 * Checks if a file exists
 */
export function fileExists(filePath: string): boolean {
	return fs.existsSync(filePath);
}

/**
 * Checks if a directory exists
 */
export function directoryExists(dirPath: string): boolean {
	return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

/**
 * Gets the workspace root directory
 */
export function getWorkspaceRoot(): string | undefined {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return undefined;
	}
	return workspaceFolders[0].uri.fsPath;
}

/**
 * Creates a unique filename by appending a suffix if the file already exists
 */
export function createUniqueFilename(basePath: string, filename: string): string {
	const ext = path.extname(filename);
	const name = path.basename(filename, ext);
	let counter = 1;
	let uniquePath = path.join(basePath, filename);

	while (fileExists(uniquePath)) {
		uniquePath = path.join(basePath, `${name}-${counter}${ext}`);
		counter++;
	}

	return uniquePath;
}

/**
 * Gets file stats (creation time, modification time, etc.)
 */
export function getFileStats(filePath: string): fs.Stats | null {
	try {
		return fs.statSync(filePath);
	} catch (error) {
		console.error(`Error getting file stats for ${filePath}:`, error);
		return null;
	}
}

/**
 * Reads file content as string
 */
export function readFileContent(filePath: string): string {
	try {
		return fs.readFileSync(filePath, 'utf8');
	} catch (error) {
		console.error(`Error reading file ${filePath}:`, error);
		throw new Error(`Failed to read file ${filePath}: ${error}`);
	}
}

/**
 * Writes content to a file
 */
export function writeFileContent(filePath: string, content: string): void {
	try {
		// Ensure directory exists
		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		fs.writeFileSync(filePath, content, 'utf8');
		console.log(`Written content to file: ${filePath}`);
	} catch (error) {
		console.error(`Error writing file ${filePath}:`, error);
		throw new Error(`Failed to write file ${filePath}: ${error}`);
	}
}

 