import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { info, error } from './logger';

/**
 * Interface for rule application configuration
 */
export interface RuleApplicationConfig {
	applyStrategy: 'Always' | 'Auto Attached' | 'Manual';
	globs?: string[];
}

/**
 * Interface for applied rule tracking
 */
export interface AppliedRule {
	id: string;
	originalPath: string;
	appliedPath: string;
	appliedAt: Date;
	config: RuleApplicationConfig;
}

/**
 * Get the applied rules directory path
 */
function getAppliedRulesDir(): string {
	const workspaceRoot = getWorkspaceRoot();
	if (!workspaceRoot) {
		throw new Error('No workspace root found');
	}
	
	const appliedDir = path.join(workspaceRoot, '.cursor', 'registry', 'applied');
	return appliedDir;
}

/**
 * Get the workspace root directory
 */
function getWorkspaceRoot(): string | undefined {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	return workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;
}

/**
 * Ensure the applied rules directory exists
 */
async function ensureAppliedRulesDir(): Promise<void> {
	const appliedDir = getAppliedRulesDir();
	
	if (!fs.existsSync(appliedDir)) {
		await fs.promises.mkdir(appliedDir, { recursive: true });
		info(`Created applied rules directory: ${appliedDir}`);
	}
}

/**
 * Generate a unique filename for the applied rule
 */
function generateUniqueFilename(originalPath: string, appliedDir: string): string {
	const originalName = path.basename(originalPath);
	const baseName = path.parse(originalName).name;
	const extension = path.parse(originalName).ext;
	
	let counter = 1;
	let newName = originalName;
	
	while (fs.existsSync(path.join(appliedDir, newName))) {
		newName = `${baseName}_${counter}${extension}`;
		counter++;
	}
	
	return newName;
}

/**
 * Apply a rule to the workspace
 */
export async function applyRule(rulePath: string, config: RuleApplicationConfig): Promise<AppliedRule> {
	try {
		// Ensure the applied rules directory exists
		await ensureAppliedRulesDir();
		
		const appliedDir = getAppliedRulesDir();
		const originalName = path.basename(rulePath);
		const uniqueName = generateUniqueFilename(rulePath, appliedDir);
		const appliedPath = path.join(appliedDir, uniqueName);
		
		// Read the original rule content
		const ruleContent = await fs.promises.readFile(rulePath, 'utf-8');
		
		// Apply configuration to the rule content
		const configuredContent = applyConfigurationToRule(ruleContent, config);
		
		// Write the configured rule to the applied directory
		await fs.promises.writeFile(appliedPath, configuredContent, 'utf-8');
		
		const appliedRule: AppliedRule = {
			id: path.parse(uniqueName).name,
			originalPath: rulePath,
			appliedPath: appliedPath,
			appliedAt: new Date(),
			config: config
		};
		
		info(`Applied rule: ${originalName} -> ${uniqueName}`);
		return appliedRule;
		
	} catch (err) {
		error('Failed to apply rule', err as Error);
		throw new Error(`Failed to apply rule: ${err instanceof Error ? err.message : 'Unknown error'}`);
	}
}

/**
 * Apply configuration to rule content
 */
function applyConfigurationToRule(content: string, config: RuleApplicationConfig): string {
	// Parse the MDC content to extract frontmatter and body
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	
	if (!frontmatterMatch) {
		// If no frontmatter, just return the content as-is
		return content;
	}
	
	const [, frontmatter, body] = frontmatterMatch;
	
	// Parse the existing frontmatter
	const lines = frontmatter.split('\n');
	const newLines: string[] = [];
	
	// Copy existing frontmatter lines, updating or adding configuration
	let hasApplyStrategy = false;
	let hasGlobs = false;
	
	for (const line of lines) {
		if (line.startsWith('applyStrategy:')) {
			newLines.push(`applyStrategy: ${config.applyStrategy}`);
			hasApplyStrategy = true;
		} else if (line.startsWith('globs:')) {
			if (config.globs && config.globs.length > 0) {
				newLines.push(`globs: [${config.globs.map(g => `"${g}"`).join(', ')}]`);
			}
			hasGlobs = true;
		} else {
			newLines.push(line);
		}
	}
	
	// Add missing configuration
	if (!hasApplyStrategy) {
		newLines.push(`applyStrategy: ${config.applyStrategy}`);
	}
	
	if (!hasGlobs && config.globs && config.globs.length > 0) {
		newLines.push(`globs: [${config.globs.map(g => `"${g}"`).join(', ')}]`);
	}
	
	// Reconstruct the content
	const newFrontmatter = newLines.join('\n');
	return `---\n${newFrontmatter}\n---\n${body}`;
}

/**
 * Get all currently applied rules
 */
export async function getAppliedRules(): Promise<AppliedRule[]> {
	try {
		const appliedDir = getAppliedRulesDir();
		
		if (!fs.existsSync(appliedDir)) {
			return [];
		}
		
		const files = await fs.promises.readdir(appliedDir);
		const appliedRules: AppliedRule[] = [];
		
		for (const file of files) {
			if (file.endsWith('.mdc')) {
				const appliedPath = path.join(appliedDir, file);
				const stats = await fs.promises.stat(appliedPath);
				
				// Try to read the rule content to extract configuration
				const content = await fs.promises.readFile(appliedPath, 'utf-8');
				const config = extractConfigurationFromRule(content);
				
				const appliedRule: AppliedRule = {
					id: path.parse(file).name,
					originalPath: '', // We don't track the original path for now
					appliedPath: appliedPath,
					appliedAt: stats.birthtime,
					config: config
				};
				
				appliedRules.push(appliedRule);
			}
		}
		
		return appliedRules;
		
	} catch (err) {
		error('Failed to get applied rules', err as Error);
		return [];
	}
}

/**
 * Extract configuration from rule content
 */
function extractConfigurationFromRule(content: string): RuleApplicationConfig {
	const config: RuleApplicationConfig = {
		applyStrategy: 'Always' // Default
	};
	
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return config;
	}
	
	const frontmatter = frontmatterMatch[1];
	
	// Extract applyStrategy
	const applyStrategyMatch = frontmatter.match(/applyStrategy:\s*(\w+)/);
	if (applyStrategyMatch) {
		const strategy = applyStrategyMatch[1] as 'Always' | 'Auto Attached' | 'Manual';
		if (['Always', 'Auto Attached', 'Manual'].includes(strategy)) {
			config.applyStrategy = strategy;
		}
	}
	
	// Extract globs
	const globsMatch = frontmatter.match(/globs:\s*\[([^\]]*)\]/);
	if (globsMatch) {
		const globsString = globsMatch[1];
		const globs = globsString.split(',').map(g => g.trim().replace(/"/g, '')).filter(g => g);
		if (globs.length > 0) {
			config.globs = globs;
		}
	}
	
	return config;
}

/**
 * Remove an applied rule
 */
export async function removeAppliedRule(ruleId: string): Promise<boolean> {
	try {
		const appliedDir = getAppliedRulesDir();

		if (!fs.existsSync(appliedDir)) {
			return false;
		}

		// Get the original rule to find its filename
		const { getRuleById } = await import('./ruleDiscovery.js');
		const rule = await getRuleById(ruleId);
		if (!rule) {
			return false;
		}

		const originalFilename = path.basename(rule.filePath);
		const baseName = path.parse(originalFilename).name;

		const files = await fs.promises.readdir(appliedDir);
		const matchingFiles = files.filter(file => {
			if (!file.endsWith('.mdc')) {
				return false;
			}
			const appliedBaseName = path.parse(file).name;
			return appliedBaseName === baseName || appliedBaseName.startsWith(baseName + '_');
		});

		if (matchingFiles.length === 0) {
			return false;
		}

		// Remove all matching files
		for (const file of matchingFiles) {
			await fs.promises.unlink(path.join(appliedDir, file));
			info(`Removed applied rule file: ${file}`);
		}

		return true;
	} catch (err) {
		error('Failed to remove applied rule', err as Error);
		return false;
	}
}

/**
 * Check if a rule is currently applied
 */
export async function isRuleApplied(ruleId: string): Promise<boolean> {
	try {
		const appliedDir = getAppliedRulesDir();
		
		if (!fs.existsSync(appliedDir)) {
			return false;
		}
		
		// Get the original rule to find its filename
		const { getRuleById } = await import('./ruleDiscovery.js');
		const rule = await getRuleById(ruleId);
		
		if (!rule) {
			return false;
		}
		
		// Extract the base filename from the original rule path
		const originalFilename = path.basename(rule.filePath);
		const baseName = path.parse(originalFilename).name;
		
		// Check for files that start with the base name (handles suffixes like _1, _2, etc.)
		const files = await fs.promises.readdir(appliedDir);
		const matchingFiles = files.filter(file => {
			if (!file.endsWith('.mdc')) {
				return false;
			}
			const appliedBaseName = path.parse(file).name;
			return appliedBaseName === baseName || appliedBaseName.startsWith(baseName + '_');
		});
		
		return matchingFiles.length > 0;
		
	} catch (err) {
		error('Failed to check if rule is applied', err as Error);
		return false;
	}
} 