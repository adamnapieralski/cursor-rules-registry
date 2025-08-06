import * as path from 'path';
import { 
	scanRegistryDirectories, 
	getWorkspaceRoot,
	getRegistryDirName 
} from './fileUtils';
import { 
	parseMdcFilesInDirectory, 
	filterAndSortRules, 
	getRulePreview,
	Rule 
} from './mdcParser';
import { info, error } from './logger';
import { loadRulesMetadata } from './metadataService';

/**
 * Rule Discovery Service for Cursor Rules Registry extension
 * Handles discovery and management of rules from the registry
 */

export interface RuleDiscoveryResult {
	allRules: Rule[];
	teamRules: Rule[];
	userRules: Rule[];
	teams: string[];
	users: string[];
}

/**
 * Discover all rules from the registry
 */
export async function discoverAllRules(): Promise<RuleDiscoveryResult> {
	const workspaceRoot = getWorkspaceRoot();
	if (!workspaceRoot) {
		throw new Error('No workspace folder found');
	}

	info('Starting rule discovery for workspace:', workspaceRoot);

	try {
		// Scan registry structure
		const structure = await scanRegistryDirectories(workspaceRoot);
		info('Registry structure discovered:', structure);

		const allRules: Rule[] = [];
		const teamRules: Rule[] = [];
		const userRules: Rule[] = [];

		const registryDirName = getRegistryDirName();
		// Discover team rules
		for (const team of structure.teams) {
			const teamPath = path.join(workspaceRoot, registryDirName, 'teams', team);
			const rules = await parseMdcFilesInDirectory(teamPath, team);
			teamRules.push(...rules);
			allRules.push(...rules);
			info(`Discovered ${rules.length} rules for team: ${team}`);
		}

		// Discover user rules
		for (const user of structure.users) {
			const userPath = path.join(workspaceRoot, registryDirName, 'users', user);
			const rules = await parseMdcFilesInDirectory(userPath, undefined, user);
			userRules.push(...rules);
			allRules.push(...rules);
			info(`Discovered ${rules.length} rules for user: ${user}`);
		}

		// Load additional metadata (tags) and merge
		const metaMap = await loadRulesMetadata();
		for (const rule of allRules) {
			const meta = metaMap[rule.id];
			if (meta && Array.isArray(meta.tags)) {
				rule.tags = meta.tags;
			}
		}

		const result: RuleDiscoveryResult = {
			allRules,
			teamRules,
			userRules,
			teams: structure.teams,
			users: structure.users
		};

		info(`Rule discovery complete. Total rules: ${allRules.length}`);
		return result;

	} catch (err) {
		error('Failed to discover rules', err as Error);
		throw err;
	}
}

/**
 * Get rules for a specific team
 */
export async function getTeamRules(teamName: string): Promise<Rule[]> {
	const workspaceRoot = getWorkspaceRoot();
	if (!workspaceRoot) {
		throw new Error('No workspace folder found');
	}

	const teamPath = path.join(workspaceRoot, getRegistryDirName(), 'teams', teamName);
	const rules = await parseMdcFilesInDirectory(teamPath, teamName);
	
	info(`Retrieved ${rules.length} rules for team: ${teamName}`);
	return rules;
}

/**
 * Get rules for a specific user
 */
export async function getUserRules(userEmail: string): Promise<Rule[]> {
	const workspaceRoot = getWorkspaceRoot();
	if (!workspaceRoot) {
		throw new Error('No workspace folder found');
	}

	const userPath = path.join(workspaceRoot, getRegistryDirName(), 'users', userEmail);
	const rules = await parseMdcFilesInDirectory(userPath, undefined, userEmail);
	
	info(`Retrieved ${rules.length} rules for user: ${userEmail}`);
	return rules;
}

/**
 * Get rule by ID
 */
export async function getRuleById(ruleId: string): Promise<Rule | null> {
	try {
		const discoveryResult = await discoverAllRules();
		const rule = discoveryResult.allRules.find(r => r.id === ruleId);
		
		if (rule) {
			info(`Found rule by ID: ${ruleId}`);
			return rule;
		} else {
			info(`Rule not found by ID: ${ruleId}`);
			return null;
		}

	} catch (err) {
		error(`Failed to get rule by ID: ${ruleId}`, err as Error);
		return null;
	}
}

/**
 * Get available teams
 */
export async function getAvailableTeams(): Promise<string[]> {
	try {
		const structure = await scanRegistryDirectories(getWorkspaceRoot()!);
		return structure.teams;
	} catch (err) {
		error('Failed to get available teams', err as Error);
		return [];
	}
}

/**
 * Get available users
 */
export async function getAvailableUsers(): Promise<string[]> {
	try {
		const structure = await scanRegistryDirectories(getWorkspaceRoot()!);
		return structure.users;
	} catch (err) {
		error('Failed to get available users', err as Error);
		return [];
	}
} 