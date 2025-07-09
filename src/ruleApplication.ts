import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceRoot } from './fileUtils';
import { info, error } from './logger';

/**
 * Configuration for applying a rule
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
	
	const appliedDir = path.join(workspaceRoot, '.cursor', 'rules', 'registry');
	return appliedDir;
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
function generateUniqueFilename(originalPath: string, targetDir: string, source?: string): string {
	const originalName = path.basename(originalPath);
	const baseName = path.parse(originalName).name;
	const extension = path.parse(originalName).ext;
	
	// Create source suffix if provided
	const sourceSuffix = source ? `.${source}` : '';
	
	// Check if file already exists
	let counter = 0;
	let uniqueName = `${baseName}${sourceSuffix}${extension}`;
	
	while (fs.existsSync(path.join(targetDir, uniqueName))) {
		counter++;
		uniqueName = `${baseName}${sourceSuffix}_${counter}${extension}`;
	}
	
	return uniqueName;
}

/**
 * Apply configuration to rule content
 */
function applyConfigurationToRule(content: string, config: RuleApplicationConfig): string {
	// For now, just return the original content
	// In the future, this could modify the rule based on configuration
	return content;
}

/**
 * Extract configuration from rule content
 */
function extractConfigurationFromRule(content: string): RuleApplicationConfig {
	// For now, return default configuration
	// In the future, this could parse configuration from the rule content
	return {
		applyStrategy: 'Always'
	};
}

/**
 * Apply a rule to the workspace
 */
export async function applyRule(rulePath: string, config: RuleApplicationConfig, source?: string): Promise<AppliedRule> {
	try {
		// Ensure the applied rules directory exists
		await ensureAppliedRulesDir();
		
		const appliedDir = getAppliedRulesDir();
		const originalName = path.basename(rulePath);
		const uniqueName = generateUniqueFilename(rulePath, appliedDir, source);
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

			// Check for exact match
			if (appliedBaseName === baseName) {
				return true;
			}

			// Check for source-based naming: baseName.sourceName
			if (appliedBaseName.startsWith(baseName + '.')) {
				return true;
			}

			// Check for counter-based naming: baseName.sourceName_counter or baseName_counter
			const counterPattern = new RegExp(`^${baseName}(\.\w+)?_\d+$`);
			if (counterPattern.test(appliedBaseName)) {
				return true;
			}

			return false;
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
		
		// Check for files that match the new naming convention
		const files = await fs.promises.readdir(appliedDir);
		const matchingFiles = files.filter(file => {
			if (!file.endsWith('.mdc')) {
				return false;
			}
			const appliedBaseName = path.parse(file).name;

			// Check for exact match
			if (appliedBaseName === baseName) {
				return true;
			}

			// Check for source-based naming: baseName.sourceName
			if (appliedBaseName.startsWith(baseName + '.')) {
				return true;
			}

			// Check for counter-based naming: baseName.sourceName_counter or baseName_counter
			const counterPattern = new RegExp(`^${baseName}(\.\w+)?_\d+$`);
			if (counterPattern.test(appliedBaseName)) {
				return true;
			}

			return false;
		});
		
		return matchingFiles.length > 0;
		
	} catch (err) {
		error('Failed to check if rule is applied', err as Error);
		return false;
	}
} 