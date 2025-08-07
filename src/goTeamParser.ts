import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { info, error } from './logger';

/**
 * Interface for team member information
 */
export interface MemberInfo {
	Email: string;
	Name: string;
	GithubUsername?: string;
	Manager?: boolean;
	LaunchDarklyAccess?: boolean;
}

/**
 * Interface for team information
 */
export interface TeamInfo {
	TeamName: string;
	Members: MemberInfo[];
	SlackContactChannel?: string;
	GithubNameOverride?: string;
}

/**
 * Interface for parsed team data
 */
export interface ParsedTeamData {
	teams: TeamInfo[];
	userTeams: string[]; // Team names the user belongs to
}

/**
 * Parse Go files to detect team memberships
 */
export async function parseTeamMemberships(userEmail: string): Promise<ParsedTeamData> {
	const workspaceRoot = getWorkspaceRoot();
	if (!workspaceRoot) {
		info('No workspace root found for team parsing');
		return { teams: [], userTeams: [] };
	}

	const teamDir = path.join(workspaceRoot, 'go', 'src', 'samsaradev.io', 'team');
	
	if (!fs.existsSync(teamDir)) {
		info(`Team directory not found: ${teamDir}`);
		return { teams: [], userTeams: [] };
	}

	try {
		const teams: TeamInfo[] = [];
		const userTeams: string[] = [];
		const memberMap = new Map<string, MemberInfo>();

		// Scan for Go files in the team directory
		const files = await scanGoFiles(teamDir);
		info(`Found ${files.length} Go files in team directory`);

		// First pass: collect all MemberInfo variables
		for (const file of files) {
			const fileContent = await fs.promises.readFile(file, 'utf-8');
			const members = parseMemberInfoVariables(fileContent, file);
			for (const [varName, member] of members) {
				memberMap.set(varName, member);
			}
		}

		info(`Found ${memberMap.size} member variables across all files`);

		// Second pass: parse team definitions
		for (const file of files) {
			const fileContent = await fs.promises.readFile(file, 'utf-8');
			const parsedTeams = parseTeamDefinitions(fileContent, file, memberMap);
			
			for (const team of parsedTeams) {
				teams.push(team);
				
				// Check if user is a member of this team
				if (team.Members.some(member => member.Email.toLowerCase() === userEmail.toLowerCase())) {
					userTeams.push(team.TeamName);
					info(`User ${userEmail} is a member of team: ${team.TeamName}`);
				}
			}
		}

		info(`Parsed ${teams.length} teams, user belongs to ${userTeams.length} teams`);
		return { teams, userTeams };

	} catch (err) {
		error('Failed to parse team memberships', err as Error);
		return { teams: [], userTeams: [] };
	}
}

/**
 * Scan for Go files in a directory recursively
 */
async function scanGoFiles(dirPath: string): Promise<string[]> {
	const files: string[] = [];
	
	try {
		const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
		
		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);
			
			if (entry.isDirectory()) {
				// Recursively scan subdirectories
				const subFiles = await scanGoFiles(fullPath);
				files.push(...subFiles);
			} else if (entry.isFile() && entry.name.endsWith('.go')) {
				files.push(fullPath);
			}
		}
	} catch (err) {
		error(`Failed to scan directory: ${dirPath}`, err as Error);
	}
	
	return files;
}

/**
 * Parse MemberInfo variable definitions from Go code
 */
function parseMemberInfoVariables(content: string, filePath: string): Map<string, MemberInfo> {
	const members = new Map<string, MemberInfo>();
	
	try {
		// Look for MemberInfo variable definitions like:
		// var adamNapieralski = components.MemberInfo{
		//     Name: "Adam Napieralski",
		//     Email: "adam.napieralski@samsara.com",
		//     ...
		// }
		const memberVarRegex = /var\s+(\w+)\s*=\s*components\.MemberInfo\s*{([^}]+)}/g;
		
		let match;
		while ((match = memberVarRegex.exec(content)) !== null) {
			const varName = match[1];
			const memberData = match[2];
			
			try {
				const member = parseMemberInfoStruct(memberData);
				if (member) {
					members.set(varName, member);
					info(`Found member variable: ${varName} (${member.Name})`);
				}
			} catch (err) {
				error(`Failed to parse member variable: ${varName}`, err as Error);
			}
		}
		
	} catch (err) {
		error(`Failed to parse MemberInfo variables in file: ${filePath}`, err as Error);
	}
	
	return members;
}

/**
 * Parse a MemberInfo struct literal
 */
function parseMemberInfoStruct(structData: string): MemberInfo | null {
	try {
		const nameMatch = structData.match(/Name:\s*"([^"]+)"/);
		const emailMatch = structData.match(/Email:\s*"([^"]+)"/);
		const githubMatch = structData.match(/GithubUsername:\s*"([^"]+)"/);
		const managerMatch = structData.match(/Manager:\s*(true|false)/);
		const launchDarklyMatch = structData.match(/LaunchDarklyAccess:\s*(true|false)/);
		
		if (!nameMatch || !emailMatch) {
			return null; // Name and Email are required
		}
		
		const member: MemberInfo = {
			Name: nameMatch[1],
			Email: emailMatch[1]
		};
		
		if (githubMatch) {
			member.GithubUsername = githubMatch[1];
		}
		
		if (managerMatch) {
			member.Manager = managerMatch[1] === 'true';
		}
		
		if (launchDarklyMatch) {
			member.LaunchDarklyAccess = launchDarklyMatch[1] === 'true';
		}
		
		return member;
		
	} catch (err) {
		error('Failed to parse MemberInfo struct', err as Error);
		return null;
	}
}

/**
 * Parse team definitions from Go code
 */
function parseTeamDefinitions(content: string, filePath: string, memberMap: Map<string, MemberInfo>): TeamInfo[] {
	const teams: TeamInfo[] = [];
	
	try {
		// Look for TeamInfo variable definitions like:
		// var TelematicsData = components.TeamInfo{
		//     TeamName: teamnames.TelematicsData,
		//     Members: []components.MemberInfo{
		//         adamNapieralski,
		//         ...
		//     },
		//     ...
		// }
		// Use a more sophisticated approach to handle nested braces
		const teamVarRegex = /var\s+(\w+)\s*=\s*components\.TeamInfo\s*{/g;
		
		let match;
		while ((match = teamVarRegex.exec(content)) !== null) {
			const varName = match[1];
			const startIndex = match.index + match[0].length;
			
			// Find the matching closing brace by counting braces
			let braceCount = 1;
			let endIndex = startIndex;
			
			for (let i = startIndex; i < content.length; i++) {
				if (content[i] === '{') {
					braceCount++;
				} else if (content[i] === '}') {
					braceCount--;
					if (braceCount === 0) {
						endIndex = i;
						break;
					}
				}
			}
			
			if (braceCount === 0) {
				const teamData = content.substring(startIndex, endIndex);
				
				try {
					const team = parseTeamInfoStruct(teamData, memberMap);
					if (team) {
						teams.push(team);
						info(`Found team: ${team.TeamName} with ${team.Members.length} members`);
					}
				} catch (err) {
					error(`Failed to parse team variable: ${varName}`, err as Error);
				}
			} else {
				error(`Failed to find matching closing brace for team variable: ${varName}`);
			}
		}
		
	} catch (err) {
		error(`Failed to parse team definitions in file: ${filePath}`, err as Error);
	}
	
	return teams;
}

/**
 * Parse a TeamInfo struct literal
 */
function parseTeamInfoStruct(structData: string, memberMap: Map<string, MemberInfo>): TeamInfo | null {
	try {
		// Extract team name
		const teamNameMatch = structData.match(/TeamName:\s*teamnames\.(\w+)/);
		if (!teamNameMatch) {
			return null; // TeamName is required
		}
		
		const teamName = teamNameMatch[1];
		
		// Extract members list
		const membersMatch = structData.match(/Members:\s*\[\]components\.MemberInfo\s*{([^}]+)}/);
		if (!membersMatch) {
			return null; // Members is required
		}
		
		const membersText = membersMatch[1];
		const members = parseMemberReferences(membersText, memberMap);
		
		// Extract optional fields
		const slackChannelMatch = structData.match(/SlackContactChannel:\s*"([^"]+)"/);
		const githubOverrideMatch = structData.match(/GithubNameOverride:\s*"([^"]+)"/);
		
		const team: TeamInfo = {
			TeamName: teamName,
			Members: members
		};
		
		if (slackChannelMatch) {
			team.SlackContactChannel = slackChannelMatch[1];
		}
		
		if (githubOverrideMatch) {
			team.GithubNameOverride = githubOverrideMatch[1];
		}
		
		return team;
		
	} catch (err) {
		error('Failed to parse TeamInfo struct', err as Error);
		return null;
	}
}

/**
 * Parse member references in a team's Members field
 */
function parseMemberReferences(membersText: string, memberMap: Map<string, MemberInfo>): MemberInfo[] {
	const members: MemberInfo[] = [];
	
	// Look for member variable references like: adamNapieralski, dominikCygalski, etc.
	// Split by commas and clean up whitespace
	const memberRefs = membersText.split(',').map(ref => ref.trim());
	
	for (const varName of memberRefs) {
		// Skip empty strings and common Go keywords
		if (!varName || varName === '') {
			continue;
		}
		
		const skipWords = ['var', 'const', 'type', 'func', 'package', 'import', 'return', 'if', 'else', 'for', 'range', 'components'];
		if (skipWords.includes(varName)) {
			continue;
		}
		
		const member = memberMap.get(varName);
		if (member) {
			members.push(member);
		} else {
			info(`Warning: Member variable not found: ${varName}`);
		}
	}
	
	return members;
}

/**
 * Get the workspace root directory
 */
function getWorkspaceRoot(): string | undefined {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	return workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;
} 