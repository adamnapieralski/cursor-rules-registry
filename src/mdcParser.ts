import * as yaml from 'js-yaml';
import * as path from 'path';
import { readFileContent, getFileStats } from './fileUtils';
import { info, error } from './logger';

/**
 * MDC Parser for Cursor Rules Registry extension
 * Parses .mdc files with YAML frontmatter and content
 */

export interface RuleMetadata {
	title?: string;
	description?: string;
	globs?: string[];
	alwaysApply?: boolean;
	context?: string;
}

export interface Rule {
	id: string;
	title: string;
	description?: string;
	content: string;
	metadata: RuleMetadata;
	filePath: string;
	author?: string;
	lastUpdated?: string;
	team?: string;
	user?: string;
}

export interface ParsedMdcFile {
	metadata: RuleMetadata;
	content: string;
}

/**
 * Parse an MDC file and extract metadata and content
 */
export function parseMdcFile(filePath: string): ParsedMdcFile | null {
	try {
		const fileContent = readFileContent(filePath);
		const lines = fileContent.split('\n');
		
		// Check if file starts with YAML frontmatter
		if (!lines[0].trim().startsWith('---')) {
			// No frontmatter, treat entire file as content
			const content = fileContent.trim();
			info(`Parsing file without frontmatter: ${filePath}, content length: ${content.length}`);
			return {
				metadata: {},
				content: content
			};
		}

		// Find the end of YAML frontmatter
		let frontmatterEndIndex = -1;
		for (let i = 1; i < lines.length; i++) {
			if (lines[i].trim() === '---') {
				frontmatterEndIndex = i;
				break;
			}
		}

		if (frontmatterEndIndex === -1) {
			// Malformed frontmatter, treat entire file as content
			error(`Malformed YAML frontmatter in file: ${filePath}`);
			return {
				metadata: {},
				content: fileContent.trim()
			};
		}

		// Extract YAML frontmatter
		const frontmatterLines = lines.slice(1, frontmatterEndIndex);
		const frontmatterText = frontmatterLines.join('\n');

		// Parse YAML frontmatter
		let metadata: RuleMetadata = {};
		try {
			// Preprocess YAML to handle glob patterns and empty values
			let cleanedYaml = frontmatterText
				.split('\n')
				.map(line => {
					const trimmedLine = line.trim();
					
					// Handle empty values
					if (trimmedLine.endsWith(':') && !trimmedLine.includes(' ')) {
						return line.trim() + ' null';
					}
					
					return line;
				})
				.join('\n');
			
			// Handle glob patterns that might be interpreted as YAML aliases
			// Replace patterns like "globs: *.tsx" with "globs: ['*.tsx']"
			cleanedYaml = cleanedYaml.replace(/globs:\s*(\*[^\s\n]+)/g, 'globs: ["$1"]');
			
			metadata = yaml.load(cleanedYaml) as RuleMetadata || {};
			
			// Clean up null values
			if (metadata.title === null) metadata.title = undefined;
			if (metadata.description === null) metadata.description = undefined;
			if (metadata.globs === null) metadata.globs = undefined;
			if (metadata.context === null) metadata.context = undefined;
			
			// Ensure globs is always an array
			if (metadata.globs && !Array.isArray(metadata.globs)) {
				metadata.globs = [metadata.globs];
			}
			
		} catch (yamlError) {
			error(`Failed to parse YAML frontmatter in file: ${filePath}`, yamlError as Error);
			// Continue with empty metadata
			metadata = {};
		}

		// Extract content (everything after frontmatter)
		const contentLines = lines.slice(frontmatterEndIndex + 1);
		const content = contentLines.join('\n').trim();
		
		info(`Parsing file with frontmatter: ${filePath}, content length: ${content.length}`);

		return {
			metadata,
			content
		};

	} catch (err) {
		error(`Failed to parse MDC file: ${filePath}`, err as Error);
		return null;
	}
}

/**
 * Validate MDC format and metadata
 */
export function validateMdcFile(parsedFile: ParsedMdcFile, filePath: string): boolean {
	try {
		// Check if content is not empty
		if (!parsedFile.content || parsedFile.content.trim().length === 0) {
			error(`Empty content in MDC file: ${filePath}, content: "${parsedFile.content}"`);
			return false;
		}

		// Validate metadata fields if present
		const { metadata } = parsedFile;

		// Validate globs if present
		if (metadata.globs && !Array.isArray(metadata.globs)) {
			error(`Invalid globs format in file: ${filePath}`);
			return false;
		}

		// Validate alwaysApply if present
		if (metadata.alwaysApply !== undefined && typeof metadata.alwaysApply !== 'boolean') {
			error(`Invalid alwaysApply format in file: ${filePath}`);
			return false;
		}

		// Validate title if present
		if (metadata.title !== undefined && typeof metadata.title !== 'string') {
			error(`Invalid title format in file: ${filePath}`);
			return false;
		}

		// Validate description if present
		if (metadata.description !== undefined && typeof metadata.description !== 'string') {
			error(`Invalid description format in file: ${filePath}`);
			return false;
		}

		// Validate context if present
		if (metadata.context !== undefined && typeof metadata.context !== 'string') {
			error(`Invalid context format in file: ${filePath}`);
			return false;
		}

		return true;

	} catch (err) {
		error(`Failed to validate MDC file: ${filePath}`, err as Error);
		return false;
	}
}

/**
 * Create a Rule object from a parsed MDC file
 */
export function createRuleFromMdcFile(
	filePath: string, 
	parsedFile: ParsedMdcFile, 
	team?: string, 
	user?: string
): Rule | null {
	try {
		// Generate rule ID from file path
		const relativePath = path.relative(process.cwd(), filePath);
		const id = relativePath.replace(/[^a-zA-Z0-9]/g, '_');

		// Extract title with priority: frontmatter title > content heading > filename
		const filename = path.basename(filePath, '.mdc');
		let title = filename;

		// Use custom title from frontmatter if available
		if (parsedFile.metadata.title) {
			title = parsedFile.metadata.title;
		} else {
			// Try to extract title from first line of content if it looks like a heading
			const firstLine = parsedFile.content.split('\n')[0].trim();
			if (firstLine.startsWith('# ')) {
				title = firstLine.substring(2).trim();
			}
		}

		// Get file stats for metadata
		const stats = getFileStats(filePath);
		const lastUpdated = stats ? new Date(stats.mtime).toISOString() : undefined;

		// Create rule object
		const rule: Rule = {
			id,
			title,
			description: parsedFile.metadata.description,
			content: parsedFile.content,
			metadata: parsedFile.metadata,
			filePath,
			lastUpdated,
			team,
			user
		};

		info(`Created rule from file: ${filePath}`, { id, title, team, user });
		return rule;

	} catch (err) {
		error(`Failed to create rule from MDC file: ${filePath}`, err as Error);
		return null;
	}
}

/**
 * Parse all MDC files in a directory and return Rule objects
 */
export async function parseMdcFilesInDirectory(
	directoryPath: string, 
	team?: string, 
	user?: string
): Promise<Rule[]> {
	const rules: Rule[] = [];
	
	try {
		// Import scanForMdcFiles dynamically to avoid circular dependency
		const { scanForMdcFiles } = await import('./fileUtils.js');
		const mdcFiles = await scanForMdcFiles(directoryPath);

		for (const filePath of mdcFiles) {
			try {
				// Parse the MDC file
				const parsedFile = parseMdcFile(filePath);
				if (!parsedFile) {
					continue; // Skip malformed files
				}

				// Validate the parsed file
				if (!validateMdcFile(parsedFile, filePath)) {
					continue; // Skip invalid files
				}

				// Create rule object
				const rule = createRuleFromMdcFile(filePath, parsedFile, team, user);
				if (rule) {
					rules.push(rule);
				}

			} catch (err) {
				error(`Failed to process MDC file: ${filePath}`, err as Error);
				continue; // Skip files that can't be processed
			}
		}

		info(`Parsed ${rules.length} rules from directory: ${directoryPath}`);
		return rules;

	} catch (err) {
		error(`Failed to parse MDC files in directory: ${directoryPath}`, err as Error);
		return [];
	}
}

/**
 * Fuzzy search utility functions
 */

/**
 * Calculate fuzzy match score for a string against a search term
 * Higher score means better match
 */
function calculateFuzzyScore(text: string, searchTerm: string): number {
	if (!searchTerm || searchTerm.length === 0) return 0;
	
	const textLower = text.toLowerCase();
	const searchLower = searchTerm.toLowerCase();
	
	// Exact match gets highest score
	if (textLower === searchLower) return 1000;
	
	// Starts with search term gets high score
	if (textLower.startsWith(searchLower)) return 800;
	
	// Contains search term gets medium score
	if (textLower.includes(searchLower)) return 600;
	
	// Fuzzy match: check if all characters in search term appear in order
	let searchIndex = 0;
	let consecutiveBonus = 0;
	let lastMatchIndex = -1;
	
	for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
		if (textLower[i] === searchLower[searchIndex]) {
			// Bonus for consecutive matches
			if (lastMatchIndex === i - 1) {
				consecutiveBonus += 10;
			}
			lastMatchIndex = i;
			searchIndex++;
		}
	}
	
	// If all search characters were found
	if (searchIndex === searchLower.length) {
		// Base score for fuzzy match
		let score = 400;
		
		// Bonus for matches near the beginning
		const firstMatchIndex = textLower.indexOf(searchLower[0]);
		if (firstMatchIndex <= 3) score += 50;
		else if (firstMatchIndex <= 10) score += 25;
		
		// Bonus for consecutive matches
		score += consecutiveBonus;
		
		// Penalty for long gaps between matches
		const gapPenalty = Math.max(0, (textLower.length - searchLower.length) * 2);
		score -= gapPenalty;
		
		return Math.max(0, score);
	}
	
	return 0;
}

/**
 * Get the best fuzzy match score for a rule against a search term
 */
function getRuleFuzzyScore(rule: Rule, searchTerm: string): number {
	const scores = [
		calculateFuzzyScore(rule.title, searchTerm) * 2, // Title gets double weight
		calculateFuzzyScore(rule.description || '', searchTerm),
		calculateFuzzyScore(rule.content, searchTerm) * 0.5, // Content gets half weight
		calculateFuzzyScore(rule.metadata.context || '', searchTerm),
		calculateFuzzyScore(rule.team || '', searchTerm),
		calculateFuzzyScore(rule.user || '', searchTerm)
	];
	
	return Math.max(...scores);
}

/**
 * Filter and sort rules based on criteria
 */
export function filterAndSortRules(
	rules: Rule[], 
	searchTerm?: string, 
	sortBy: 'title' | 'lastUpdated' | 'author' = 'title'
): Rule[] {
	let filteredRules = [...rules];

	// Apply search filter if provided
	if (searchTerm && searchTerm.trim().length > 0) {
		const term = searchTerm.trim();
		
		// Use fuzzy search to filter and score rules
		const scoredRules = filteredRules.map(rule => ({
			rule,
			score: getRuleFuzzyScore(rule, term)
		}));
		
		// Filter out rules with no match (score = 0)
		filteredRules = scoredRules
			.filter(item => item.score > 0)
			.sort((a, b) => b.score - a.score) // Sort by score (highest first)
			.map(item => item.rule);
	} else {
		// No search term, sort by the specified criteria
		filteredRules.sort((a, b) => {
			switch (sortBy) {
				case 'lastUpdated':
					const aDate = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
					const bDate = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
					return bDate - aDate; // Most recent first
				case 'author':
					const aAuthor = a.author || '';
					const bAuthor = b.author || '';
					return aAuthor.localeCompare(bAuthor);
				case 'title':
				default:
					return a.title.localeCompare(b.title);
			}
		});
	}

	return filteredRules;
}

/**
 * Get preview text from rule content (first 3 lines)
 */
export function getRulePreview(content: string, maxLines: number = 3): string {
	const lines = content.split('\n');
	const previewLines = lines.slice(0, maxLines);
	return previewLines.join('\n').trim();
}

/**
 * Get content snippets that match the search term
 */
export function getContentSnippets(content: string, searchTerm: string, maxSnippets: number = 2): string[] {
	if (!searchTerm || searchTerm.trim().length === 0) {
		return [];
	}
	
	const term = searchTerm.toLowerCase();
	const contentLower = content.toLowerCase();
	const snippets: string[] = [];
	
	// Find all occurrences of the search term
	let startIndex = 0;
	while (startIndex < contentLower.length && snippets.length < maxSnippets) {
		const matchIndex = contentLower.indexOf(term, startIndex);
		if (matchIndex === -1) break;
		
		// Extract context around the match (50 characters before and after)
		const contextStart = Math.max(0, matchIndex - 50);
		const contextEnd = Math.min(content.length, matchIndex + term.length + 50);
		
		let snippet = content.substring(contextStart, contextEnd);
		
		// Try to start at a word boundary
		if (contextStart > 0) {
			const wordBoundary = snippet.indexOf(' ');
			if (wordBoundary > 0 && wordBoundary < 20) {
				snippet = snippet.substring(wordBoundary + 1);
			}
		}
		
		// Try to end at a word boundary
		if (contextEnd < content.length) {
			const lastSpace = snippet.lastIndexOf(' ');
			if (lastSpace > snippet.length - 20 && lastSpace > 0) {
				snippet = snippet.substring(0, lastSpace);
			}
		}
		
		// Add ellipsis if we're not at the beginning/end
		if (contextStart > 0) snippet = '...' + snippet;
		if (contextEnd < content.length) snippet = snippet + '...';
		
		snippets.push(snippet);
		startIndex = matchIndex + 1;
	}
	
	return snippets;
} 