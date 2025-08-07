// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { 
	createRegistryStructure, 
	scanRegistryDirectories, 
	scanForMdcFiles,
	getWorkspaceRoot,
	getRegistryDirName
} from './fileUtils';
import * as path from 'path';
import { logger, info, error } from './logger';
import { pullGitRepository } from './gitIntegration';
import { 
	discoverAllRules,
	getRuleById,
	getCachedDiscovery
} from './ruleDiscovery';
import { getRulePreview } from './mdcParser';
import { getUserEmail } from './gitIntegration';
import { parseTeamMemberships } from './goTeamParser';
import { applyRule, RuleApplicationConfig, isRuleApplied, removeAppliedRule } from './ruleApplication';
import { addTagToRule, removeTagFromRule, getTagsWithFrequency } from './metadataService';
import { getRuleSource } from './ruleId';

let teamMembershipCache: { teams: string[]; userTeams: string[] } | null = null;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	info('Cursor Rules Registry extension is now active!');

	// Attempt to pull registry repo if configured
	const workspaceRoot = getWorkspaceRoot();
	if (workspaceRoot) {
		await tryPullRegistry(workspaceRoot);
	}

	// Initial team membership discovery
	try {
		const userEmail = await getUserEmail();
		if (userEmail) {
			const teamData = await parseTeamMemberships(userEmail);
			teamMembershipCache = {
				teams: teamData.teams.map(t => t.TeamName),
				userTeams: teamData.userTeams
			};
		}
	} catch (err) {
		error('Failed to load initial team membership cache', err as Error);
	}

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('cursor-rules-registry.open', async () => {
		try {
			// Initialize registry structure before opening panel
			await initializeRegistry();
			
			// Create and show panel
			CursorRulesRegistryPanel.createOrShow(context.extensionUri);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
			error('Failed to open Cursor Rules Registry', err as Error);
			vscode.window.showErrorMessage(`Failed to open Cursor Rules Registry: ${errorMessage}`);
		}
	});

	context.subscriptions.push(disposable);
}

/**
 * If registryIsGit setting is true, attempt a git pull in the registry directory once at startup.
 */
async function tryPullRegistry(workspaceRoot: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('cursorRulesRegistry');
    const isGit = config.get<boolean>('registryIsGit', false);
    if (!isGit) {
        return;
    }

    const registryPath = path.join(workspaceRoot, getRegistryDirName());

    try {
        await pullGitRepository(registryPath);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to update rules registry: ${message}`);
    }
}

// This method is called when your extension is deactivated
export function deactivate() {
	// Clean up resources
	logger.dispose();
}

/**
 * Initialize the registry structure and scan for existing rules
 */
async function initializeRegistry(): Promise<void> {
	const workspaceRoot = getWorkspaceRoot();
	if (!workspaceRoot) {
		throw new Error('No workspace folder found. Please open a workspace first.');
	}

	info('Initializing registry for workspace:', workspaceRoot);

	try {
		// Create registry structure if it doesn't exist
		await createRegistryStructure(workspaceRoot);
		
		// Scan existing registry structure
		const structure = await scanRegistryDirectories(workspaceRoot);
		info('Registry structure discovered:', structure);

		// Scan for existing .mdc files in the registry
		const registryPath = path.join(workspaceRoot, getRegistryDirName());
		const mdcFiles = await scanForMdcFiles(registryPath);
		info(`Found ${mdcFiles.length} .mdc files in registry`);

	} catch (err) {
		error('Failed to initialize registry', err as Error);
		throw err;
	}
}

class CursorRulesRegistryPanel {
	public static currentPanel: CursorRulesRegistryPanel | undefined;
	public static readonly viewType = 'cursorRulesRegistry';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	private _currentSearchTerm: string = '';
	private _selectedTeam: string = '';
	private _selectedUser: string = '';
	private _selectedTags: string[] = [];
	private _sortBy: 'title' | 'lastUpdated' = 'title';
	private _sortOrder: 'asc' | 'desc' = 'asc';
	private _allUsers: string[] = [];
	private _userEmail: string | null = null;
	private _userTeams: string[] = [];
	private _activeTab: string = 'explore';
	private _initialized: boolean = false; // Track if HTML has been initialized

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (CursorRulesRegistryPanel.currentPanel) {
			CursorRulesRegistryPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			CursorRulesRegistryPanel.viewType,
			'Cursor Rules Registry',
			column || vscode.ViewColumn.One,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, 'media'),
					vscode.Uri.joinPath(extensionUri, 'out/compiled')
				]
			}
		);

		CursorRulesRegistryPanel.currentPanel = new CursorRulesRegistryPanel(panel, extensionUri);
	}

	public static kill() {
		CursorRulesRegistryPanel.currentPanel?.dispose();
		CursorRulesRegistryPanel.currentPanel = undefined;
	}

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		CursorRulesRegistryPanel.currentPanel = new CursorRulesRegistryPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();
		this._initialized = true; // Mark as initialized since we just updated

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				// Only update if the panel is becoming visible for the first time
				// Don't reload HTML on every visibility change as it resets the state
				if (this._panel.visible && !this._initialized) {
					this._initialized = true;
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			async message => {
				try {
					await this.handleWebviewMessage(message);
				} catch (err) {
					error('Error handling webview message', err as Error);
					this._panel.webview.postMessage({
						command: 'showError',
						text: err instanceof Error ? err.message : 'Unknown error occurred'
					});
				}
			},
			null,
			this._disposables
		);
	}

	/**
	 * Handle messages from the webview
	 */
	private async handleWebviewMessage(message: any): Promise<void> {
		switch (message.command) {
			case 'loadData':
				await this.loadInitialData();
				break;
			case 'search':
				await this.handleSearch(message.text);
				break;
			case 'selectTeam':
				await this.handleTeamSelection(message.team);
				break;
			case 'selectUser':
				await this.handleUserSelection(message.user);
				break;
			case 'selectTags':
				this._selectedTags = Array.isArray(message.tags) ? message.tags : [];
				await this.updateRules();
				break;
			case 'switchTab':
				this._activeTab = message.tab;
				break;
			case 'applyRule':
				await this.handleApplyRule(message.ruleId);
				break;
			case 'applyAllRules':
				await this.handleApplyAllRules();
				break;
			case 'clearFilters':
				await this.handleClearFilters();
				break;
			case 'promptAddTag':
				await this.handlePromptAddTag(message.ruleId);
				break;
			case 'removeTag':
				await this.handleRemoveTag(message.ruleId, message.tag);
				break;
			case 'previewRule':
				await this.handlePreviewRule(message.ruleId);
				break;
			case 'promptEditMetadata':
				await this.handlePromptEditMetadata(message.ruleId);
				break;
			case 'refreshRules':
				await this.refreshRulesCache();
				break;
			case 'sortRules':
				await this.handleSortChange(message.sortBy, message.sortOrder);
				break;
			default:
				error('Unknown message command:', message.command);
		}
	}

	/**
	 * Load initial data for the extension
	 */
	private async loadInitialData(): Promise<void> {
		try {
			// Use cached team memberships
			this._userEmail = await getUserEmail();
			if (teamMembershipCache) {
				this._userTeams = teamMembershipCache.userTeams;
				info(`Using cached team memberships: ${this._userTeams.join(', ')}`);
			}

			// Get available teams and users
			// Use cached data or load if missing
			const discovery = await getCachedDiscovery();
			const teams = discovery.teams;
			const users = discovery.users;
			const tagFreq = await getTagsWithFrequency();
			const tags = tagFreq.map(t => t.tag);
			this._allUsers = users;

			// Send initial filter data
			this._panel.webview.postMessage({
				command: 'initFilters',
				payload: {
					teams: teams.map(t => ({ id: t, name: t })),
					users: users.map(u => ({ id: u, name: u })),
					tags,
					userEmail: this._userEmail,
					userTeams: this._userTeams
				}
			});

			// Load initial rules list
			await this.updateRules();

		} catch (err) {
			error('Failed to load initial data', err as Error);
			this._panel.webview.postMessage({
				command: 'showError',
				text: err instanceof Error ? err.message : 'Failed to load initial data'
			});
		}
	}

	/**
	 * Load data for a specific tab
	 */
	private async updateRules(): Promise<void> {
		try {
			// show loading
			this._panel.webview.postMessage({ command: 'showLoadingMain' });

			// Use cached rules or load if missing
			const discovery = await getCachedDiscovery();
			let rules = discovery.allRules;

			// Apply team filter
			if (this._selectedTeam) {
				rules = rules.filter(r => r.team === this._selectedTeam);
			}

			// Apply user filter
			if (this._selectedUser) {
				const targetUser = this._selectedUser === '__own__' ? (this._userEmail || '') : this._selectedUser;
				if (targetUser) {
					rules = rules.filter(r => r.user === targetUser);
				}
			}

			// Apply search filter
			if (this._currentSearchTerm) {
				const term = this._currentSearchTerm;
				rules = rules.filter(r => (r.title?.toLowerCase().includes(term) || r.description?.toLowerCase().includes(term) || r.mdcMetadata.description?.toLowerCase().includes(term) || r.content?.toLowerCase().includes(term)));
			}

			// Apply tag filter (OR semantics – at least one tag matches)
			if (this._selectedTags.length > 0) {
				rules = rules.filter(r => {
					const ruleTags = r.tags || [];
					return this._selectedTags.some(tag => ruleTags.includes(tag));
				});
			}

			// Convert to webview format
			const webRules = await Promise.all(rules.map(async rule => {
				return {
					id: rule.id,
					title: rule.title,
					description: rule.description || '',
					cursorDescription: rule.mdcMetadata.description || '',
					globs: rule.mdcMetadata.globs || [],
					tags: rule.tags || [],
					preview: getRulePreview(rule.content, 3),
					lastUpdated: rule.lastUpdated ? new Date(rule.lastUpdated).toLocaleDateString() : '',
					team: rule.team || '',
					user: rule.user || '',
					location: rule.location || '',
					isApplied: await isRuleApplied(rule.id)
				};
			}));

			// Sort: applied first, then by user's sort preferences
			webRules.sort((a, b) => {
				// First priority: applied rules come first
				if (a.isApplied && !b.isApplied) return -1;
				if (!a.isApplied && b.isApplied) return 1;
				
				// Second priority: user's sort preferences
				let aValue: string;
				let bValue: string;
				
				if (this._sortBy === 'title') {
					aValue = (a.title || '').toLowerCase();
					bValue = (b.title || '').toLowerCase();
				} else {
					// For lastUpdated, we need to compare the original date strings, not the formatted ones
					const aRule = rules.find(r => r.id === a.id);
					const bRule = rules.find(r => r.id === b.id);
					aValue = aRule?.lastUpdated || '';
					bValue = bRule?.lastUpdated || '';
				}

				if (aValue < bValue) {
					return this._sortOrder === 'asc' ? -1 : 1;
				}
				if (aValue > bValue) {
					return this._sortOrder === 'asc' ? 1 : -1;
				}
				return 0;
			});

			this._panel.webview.postMessage({
				command: 'updateMainRules',
				rules: webRules
			});
		} catch (err) {
			error('Failed to update rules', err as Error);
			this._panel.webview.postMessage({ command: 'showError', text: err instanceof Error ? err.message : 'Failed to load rules' });
		}
	}

	/**
	 * Handle search functionality
	 */
	private async handleSearch(searchTerm: string): Promise<void> {
		this._currentSearchTerm = searchTerm;
		await this.updateRules();
	}

	/**
	 * Handle team selection
	 */
	private async handleTeamSelection(teamId: string): Promise<void> {
		this._selectedTeam = teamId;
		await this.updateRules();
	}

	/**
	 * Handle user selection
	 */
	private async handleUserSelection(userId: string): Promise<void> {
		this._selectedUser = userId;
		await this.updateRules();
	}

	/**
	 * Handle rule application
	 */
	private async handleApplyRule(ruleId: string): Promise<void> {
		info('Apply rule requested:', ruleId);
		
		try {
			// Get the rule details
			const rule = await getRuleById(ruleId);
			if (!rule) {
				vscode.window.showErrorMessage(`Rule not found: ${ruleId}`);
				return;
			}

			// Check if rule is already applied
			const isApplied = await isRuleApplied(ruleId);
			if (isApplied) {
				const success = await removeAppliedRule(ruleId);
				if (success) {
					vscode.window.showInformationMessage(`Rule "${rule.title}" has been removed.`);
					// Reload the current tab to update the UI
					await this.updateRules();
				} else {
					vscode.window.showErrorMessage(`Failed to remove rule "${rule.title}".`);
				}
				return;
			}

			// For now, use default configuration
			const config: RuleApplicationConfig = {
				applyStrategy: 'Always'
			};

			// Determine source for applied rule filename using shared helper
			const source = getRuleSource(rule.team, rule.user) || 'unknown';

			// Apply the rule
			const appliedRule = await applyRule(rule.filePath, config, source);
			
			vscode.window.showInformationMessage(
				`Rule "${rule.title}" has been applied successfully!`
			);

			// Reload the current tab to update the UI
			await this.updateRules();

		} catch (err) {
			error('Failed to apply rule', err as Error);
			vscode.window.showErrorMessage(
				`Failed to apply rule: ${err instanceof Error ? err.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Handle applying all rules in a tab
	 */
	private async handleApplyAllRules(): Promise<void> {
		info('Apply all rules requested for current filter');

		try {
			// Get rules under current filters
			const discovery = await getCachedDiscovery();
			let rules = discovery.allRules;

			if (this._selectedTeam) {
				rules = rules.filter(r => r.team === this._selectedTeam);
			}
			if (this._selectedUser) {
				const targetUser = this._selectedUser === '__own__' ? (this._userEmail || '') : this._selectedUser;
				if (targetUser) {
					rules = rules.filter(r => r.user === targetUser);
				}
			}
			// Apply tag filter (OR)
			if (this._selectedTags.length > 0) {
				rules = rules.filter(r => {
					const ruleTags = r.tags || [];
					return this._selectedTags.some(tag => ruleTags.includes(tag));
				});
			}

			if (rules.length === 0) {
				vscode.window.showInformationMessage('No rules to apply.');
				return;
			}

			// Filter out already applied rules
			const unappliedRules = [];
			for (const rule of rules) {
				const isApplied = await isRuleApplied(rule.id);
				if (!isApplied) {
					unappliedRules.push(rule);
				}
			}

			if (unappliedRules.length === 0) {
				vscode.window.showInformationMessage('All rules are already applied.');
				return;
			}

			// Apply all unapplied rules
			let successCount = 0;
			let errorCount = 0;

			for (const rule of unappliedRules) {
				try {
					const source = getRuleSource(rule.team, rule.user) || 'unknown';

					// Use default configuration
					const config: RuleApplicationConfig = {
						applyStrategy: 'Always'
					};

					await applyRule(rule.filePath, config, source);
					successCount++;
				} catch (err) {
					error(`Failed to apply rule: ${rule.title}`, err as Error);
					errorCount++;
				}
			}

			// Show results
			if (successCount > 0) {
				vscode.window.showInformationMessage(
					`Successfully applied ${successCount} rule${successCount > 1 ? 's' : ''}.${errorCount > 0 ? ` Failed to apply ${errorCount} rule${errorCount > 1 ? 's' : ''}.` : ''}`
				);
			} else {
				vscode.window.showErrorMessage(`Failed to apply any rules.`);
			}

			// Reload the current tab to update the UI
			await this.updateRules();

		} catch (err) {
			error('Failed to apply all rules', err as Error);
			vscode.window.showErrorMessage(
				`Failed to apply all rules: ${err instanceof Error ? err.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Handle rule preview
	 */
	private async handlePreviewRule(ruleId: string): Promise<void> {
		info('Preview rule requested:', ruleId);
		
		try {
			const rule = await getRuleById(ruleId);
			if (rule) {
				// Open the original rule file
				const fileUri = vscode.Uri.file(rule.filePath);
				const document = await vscode.workspace.openTextDocument(fileUri);
				await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
			} else {
				vscode.window.showErrorMessage(`Rule not found: ${ruleId}`);
			}
		} catch (err) {
			error('Failed to preview rule', err as Error);
			vscode.window.showErrorMessage(`Failed to preview rule: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	/**
	 * Handle prompt to add a tag to a rule
	 */
	private async handlePromptAddTag(ruleId: string): Promise<void> {
		const rule = await getRuleById(ruleId);
		if (!rule) {
			vscode.window.showErrorMessage(`Rule not found: ${ruleId}`);
			return;
		}

		// Gather existing tags sorted by frequency
		const tagFreq = await getTagsWithFrequency();
		const existingTags = tagFreq.map(t => t.tag);

		const qp = vscode.window.createQuickPick();
		qp.title = `Add tag to "${rule.title}"`;
		qp.placeholder = 'Start typing to search or create a tag';
		qp.items = existingTags.map(t => ({ label: t }));

		const updateCreateItem = (value: string) => {
			const trimmed = value.trim();
			if (!trimmed || existingTags.includes(trimmed)) {
				// only show existing tags
				qp.items = existingTags.map(t => ({ label: t }));
			} else {
				qp.items = [
					{ label: trimmed, description: 'Add new tag' },
					...existingTags.map(t => ({ label: t }))
				];
			}
		};

		qp.onDidChangeValue(updateCreateItem);

		const selection = await new Promise<vscode.QuickPickItem | undefined>(resolve => {
			qp.onDidAccept(() => {
				const sel = qp.selectedItems[0];
				resolve(sel);
				qp.hide();
			});
			qp.onDidHide(() => resolve(undefined));
			qp.show();
		});

		if (!selection) return; // cancelled

		const tagValue = selection.label.trim();
		if (!tagValue) return;

		try {
			await addTagToRule(ruleId, tagValue);
			vscode.window.showInformationMessage(`Tag "${tagValue}" added to rule "${rule.title}".`);
			await discoverAllRules(true);
			await this.updateRules();
			await this.refreshTagOptions();
		} catch (err) {
			error('Failed to add tag to rule', err as Error);
			vscode.window.showErrorMessage(`Failed to add tag "${tagValue}" to rule "${rule.title}": ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	/**
	 * Handle removing a tag from a rule
	 */
	private async handleRemoveTag(ruleId: string, tag: string): Promise<void> {
		const rule = await getRuleById(ruleId);
		if (!rule) {
			vscode.window.showErrorMessage(`Rule not found: ${ruleId}`);
			return;
		}

		try {
			await removeTagFromRule(ruleId, tag);
			vscode.window.showInformationMessage(`Tag "${tag}" removed from rule "${rule.title}".`);
			await discoverAllRules(true);
			await this.updateRules();
			await this.refreshTagOptions();
		} catch (err) {
			error('Failed to remove tag from rule', err as Error);
			vscode.window.showErrorMessage(`Failed to remove tag "${tag}" from rule "${rule.title}": ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	/**
	 * Handle editing title/description metadata
	 */
	private async handlePromptEditMetadata(ruleId: string): Promise<void> {
		const rule = await getRuleById(ruleId);
		if (!rule) {
			vscode.window.showErrorMessage(`Rule not found: ${ruleId}`);
			return;
		}
		const { loadRulesMetadata } = await import('./metadataService.js');
		const metaMap = await loadRulesMetadata();
		const existing = metaMap[ruleId] as import('./metadataService.js').RuleMetaEntry || {};

		const title = await vscode.window.showInputBox({
			title: 'Rule Title',
			prompt: 'Enter a concise title for the rule',
			value: existing.title ?? rule.title ?? ''
		});
		if (title === undefined) return; // cancelled

		const description = await vscode.window.showInputBox({
			title: 'Rule Description',
			prompt: 'Describe context, use cases, links…',
			value: existing.description ?? rule.description ?? '',
			placeHolder: 'Context, use-cases, links…'
		});
		if (description === undefined) return;

		const { saveRuleMetadata } = await import('./metadataService.js');
		await saveRuleMetadata(ruleId, { title: title.trim(), description: description.trim() });
		
		// Force refresh rules cache and update UI
		await discoverAllRules(true);
		await this.updateRules();
		
		vscode.window.showInformationMessage('Metadata saved.');
	}

	/**
	 * Refresh the tags dropdown in the webview after tag mutations.
	 */
	private async refreshTagOptions(): Promise<void> {
		const tagFreq = await getTagsWithFrequency();
		const tags = tagFreq.map(t => t.tag);
		this._panel.webview.postMessage({ command: 'updateTagOptions', tags });
	}

	/**
	 * Refresh rules cache and update UI
	 */
	private async refreshRulesCache(): Promise<void> {
		this._panel.webview.postMessage({ command: 'showLoadingMain' });

		// Try to pull git changes if configured
		const workspaceRoot = getWorkspaceRoot();
		if (workspaceRoot) {
			const config = vscode.workspace.getConfiguration('cursorRulesRegistry');
			const isGit = config.get<boolean>('registryIsGit', false);
			if (isGit) {
				const registryPath = path.join(workspaceRoot, getRegistryDirName());
				try {
					await pullGitRepository(registryPath);
					vscode.window.showInformationMessage('Registry updated from git.');
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					vscode.window.showWarningMessage(`Failed to update registry from git: ${message}`);
				}
			}
		}

		// Always refresh rules cache, even if git pull failed
		try {
			await discoverAllRules(true); // force refresh cache
			await this.updateRules();
			vscode.window.showInformationMessage('Rules refreshed.');
		} catch (err) {
			error('Failed to refresh rules', err as Error);
			vscode.window.showErrorMessage(`Failed to refresh rules: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	/**
	 * Handle sorting change
	 */
	private async handleSortChange(sortBy: 'title' | 'lastUpdated', sortOrder: 'asc' | 'desc'): Promise<void> {
		this._sortBy = sortBy;
		this._sortOrder = sortOrder;
		await this.updateRules();
	}

	/**
	 * Handle clearing all filters
	 */
	private async handleClearFilters(): Promise<void> {
		this._currentSearchTerm = '';
		this._selectedTeam = '';
		this._selectedUser = '';
		this._selectedTags = [];
		this._sortBy = 'title';
		this._sortOrder = 'asc';
		await this.updateRules();
	}

	/**
	 * Get the currently active tab
	 */
	private getActiveTab(): string | null {
		return this._activeTab;
	}

	public dispose() {
		CursorRulesRegistryPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.title = "Cursor Rules Registry";
		this._panel.webview.html = this._getHtmlForWebview(webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to the script and css files, and uri to load them in the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				<title>Cursor Rules Registry</title>
			</head>
			<body>
				<div class="container">
					<div class="search-container">
						<input type="text" id="search-input" placeholder="Search rules..." class="search-input">
					</div>
					<div class="filters-container">
						<label>User:</label>
						<select id="user-dropdown" class="user-dropdown"></select>
						<label>Team:</label>
						<select id="team-dropdown" class="team-dropdown"></select>
						<label>Tags:</label>
						<select id="tag-dropdown" class="tag-dropdown" size="1"></select>
						<label>Sort:</label>
						<select id="sort-dropdown" class="sort-dropdown">
							<option value="title-asc">Title (A-Z)</option>
							<option value="title-desc">Title (Z-A)</option>
							<option value="lastUpdated-asc">Last Updated (Oldest)</option>
							<option value="lastUpdated-desc">Last Updated (Newest)</option>
						</select>
						<button id="clear-filters-btn" class="btn btn-secondary">Clear</button>
						<button id="refresh-btn" class="btn btn-secondary">Refresh Rules</button>
					</div>

					<div class="rules-list" id="main-rules">
						<div class="empty-state">
							<h3>No rules found</h3>
							<p>Rules will appear here once they are added to the registry.</p>
						</div>
					</div>
				</div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
