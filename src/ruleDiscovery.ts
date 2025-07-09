import * as path from 'path';
import { 
	scanRegistryDirectories, 
	scanForMdcFiles,
	getWorkspaceRoot 
} from './fileUtils';
import { 
	parseMdcFilesInDirectory, 
	filterAndSortRules, 
	getRulePreview,
	Rule 
} from './mdcParser';
import { info, error } from './logger';

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

		// Discover team rules
		for (const team of structure.teams) {
			const teamPath = path.join(workspaceRoot, '.cursor', 'registry', 'teams', team);
			const rules = await parseMdcFilesInDirectory(teamPath, team);
			teamRules.push(...rules);
			allRules.push(...rules);
			info(`Discovered ${rules.length} rules for team: ${team}`);
		}

		// Discover user rules
		for (const user of structure.users) {
			const userPath = path.join(workspaceRoot, '.cursor', 'registry', 'users', user);
			const rules = await parseMdcFilesInDirectory(userPath, undefined, user);
			userRules.push(...rules);
			allRules.push(...rules);
			info(`Discovered ${rules.length} rules for user: ${user}`);
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

	const teamPath = path.join(workspaceRoot, '.cursor', 'registry', 'teams', teamName);
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

	const userPath = path.join(workspaceRoot, '.cursor', 'registry', 'users', userEmail);
	const rules = await parseMdcFilesInDirectory(userPath, undefined, userEmail);
	
	info(`Retrieved ${rules.length} rules for user: ${userEmail}`);
	return rules;
}

/**
 * Search rules across all sources
 */
export async function searchRules(
	searchTerm: string, 
	sortBy: 'title' | 'lastUpdated' | 'author' = 'title'
): Promise<Rule[]> {
	try {
		const discoveryResult = await discoverAllRules();
		const filteredRules = filterAndSortRules(discoveryResult.allRules, searchTerm, sortBy);
		
		info(`Search for "${searchTerm}" returned ${filteredRules.length} results`);
		return filteredRules;

	} catch (err) {
		error('Failed to search rules', err as Error);
		return [];
	}
}

/**
 * Get rules for explore tab (all rules)
 */
export async function getExploreRules(): Promise<Rule[]> {
	try {
		const discoveryResult = await discoverAllRules();
		const sortedRules = filterAndSortRules(discoveryResult.allRules, undefined, 'title');
		
		info(`Explore tab: ${sortedRules.length} rules available`);
		return sortedRules;

	} catch (err) {
		error('Failed to get explore rules', err as Error);
		return [];
	}
}

/**
 * Get rules for team tab (filtered by selected team)
 */
export async function getTeamTabRules(selectedTeam?: string): Promise<Rule[]> {
	try {
		if (!selectedTeam) {
			// If no team selected, return all team rules
			const discoveryResult = await discoverAllRules();
			const sortedRules = filterAndSortRules(discoveryResult.teamRules, undefined, 'title');
			
			info(`Team tab (all teams): ${sortedRules.length} rules available`);
			return sortedRules;
		}

		// Get rules for specific team
		const teamRules = await getTeamRules(selectedTeam);
		const sortedRules = filterAndSortRules(teamRules, undefined, 'title');
		
		info(`Team tab (${selectedTeam}): ${sortedRules.length} rules available`);
		return sortedRules;

	} catch (err) {
		error('Failed to get team tab rules', err as Error);
		return [];
	}
}

/**
 * Get rules for personal tab (filtered by current user)
 */
export async function getPersonalTabRules(userEmail?: string): Promise<Rule[]> {
	try {
		if (!userEmail) {
			// If no user email, return empty array
			info('Personal tab: No user email provided');
			return [];
		}

		// Get rules for specific user
		const userRules = await getUserRules(userEmail);
		const sortedRules = filterAndSortRules(userRules, undefined, 'title');
		
		info(`Personal tab (${userEmail}): ${sortedRules.length} rules available`);
		return sortedRules;

	} catch (err) {
		error('Failed to get personal tab rules', err as Error);
		return [];
	}
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