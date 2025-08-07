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
import { loadRulesMetadata, cleanupOrphanedMetadata } from './metadataService';

// Internal cache for discovery results to avoid repeated IO heavy scans
let _discoveryCache: RuleDiscoveryResult | null = null;

/** Helper to access cached discovery; performs discovery on first use */
export async function getCachedDiscovery(): Promise<RuleDiscoveryResult> {
  if (_discoveryCache) return _discoveryCache;
  return await discoverAllRules();
}

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
export async function discoverAllRules(forceRefresh: boolean = false): Promise<RuleDiscoveryResult> {
	const workspaceRoot = getWorkspaceRoot();
	if (!workspaceRoot) {
		throw new Error('No workspace folder found');
	}

	info('Starting rule discovery for workspace:', workspaceRoot);

	try {
		if (!forceRefresh && _discoveryCache) {
			return _discoveryCache;
		}
		// Scan registry structure
		const structure = await scanRegistryDirectories(workspaceRoot);
		info('Registry structure discovered:', structure);

		const allRules: Rule[] = [];
		const teamRules: Rule[] = [];
		const userRules: Rule[] = [];

		const registryDirName = getRegistryDirName();
		const processedPaths = new Set<string>();

		// Discover team rules
		for (const team of structure.teams) {
			const teamPath = path.join(workspaceRoot, registryDirName, 'teams', team);
			const rules = await parseMdcFilesInDirectory(teamPath, team);
			teamRules.push(...rules);
			allRules.push(...rules);
			rules.forEach(r => processedPaths.add(r.filePath));
			info(`Discovered ${rules.length} rules for team: ${team}`);
		}

		// Discover user rules
		for (const user of structure.users) {
			const userPath = path.join(workspaceRoot, registryDirName, 'users', user);
			const rules = await parseMdcFilesInDirectory(userPath, undefined, user);
			userRules.push(...rules);
			allRules.push(...rules);
			rules.forEach(r => processedPaths.add(r.filePath));
			info(`Discovered ${rules.length} rules for user: ${user}`);
		}

		// Discover generic rules in registry that are not under teams/ or users/
		const registryRootPath = path.join(workspaceRoot, registryDirName);
		const genericRulesAll = await parseMdcFilesInDirectory(registryRootPath);
		const genericRules = genericRulesAll.filter(r => !processedPaths.has(r.filePath));
		allRules.push(...genericRules);
		info(`Discovered ${genericRules.length} generic rules outside teams/users directories`);

		// Load additional metadata (tags) and merge
		const metaMap = await loadRulesMetadata();
		for (const rule of allRules) {
			const meta = metaMap[rule.id];
			if (meta) {
				if (Array.isArray(meta.tags)) {
					rule.tags = [...meta.tags].sort((a,b)=>a.localeCompare(b));
				}
				if (meta.title) {
					rule.title = meta.title;
				}
				if (meta.description) {
					rule.description = meta.description;
				}
			}
		}

		// Clean up orphaned metadata entries
		const existingRuleIds = allRules.map(rule => rule.id);
		await cleanupOrphanedMetadata(existingRuleIds);

		const result: RuleDiscoveryResult = {
			allRules,
			teamRules,
			userRules,
			teams: structure.teams,
			users: structure.users
		};

		_discoveryCache = result;
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
		const discovery = await getCachedDiscovery();
		const rule = discovery.allRules.find(r => r.id === ruleId);
		
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