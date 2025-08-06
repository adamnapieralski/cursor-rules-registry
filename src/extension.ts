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
	getAvailableTeams,
	getAvailableUsers,
	getRuleById
} from './ruleDiscovery';
import { getRulePreview } from './mdcParser';
import { getUserEmail } from './gitIntegration';
import { parseTeamMemberships } from './goTeamParser';
import { applyRule, RuleApplicationConfig, isRuleApplied, removeAppliedRule } from './ruleApplication';
import { getRuleSource } from './ruleId';

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
				this._selectedTeam = '';
				this._selectedUser = '';
				await this.updateRules();
				break;
			case 'previewRule':
				await this.handlePreviewRule(message.ruleId);
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
			// Detect user email
			this._userEmail = await getUserEmail();
			if (this._userEmail) {
				info(`User email detected: ${this._userEmail}`);
				
				// Detect team memberships
				const teamData = await parseTeamMemberships(this._userEmail);
				this._userTeams = teamData.userTeams;
				
				if (this._userTeams.length > 0) {
					info(`User belongs to teams: ${this._userTeams.join(', ')}`);
					// Do NOT pre-select a team filter – default view should show all teams.
					this._selectedTeam = '';
				} else {
					info('User does not belong to any teams');
				}
			} else {
				info('No user email detected');
			}

			// Get available teams and users
			const teams = await getAvailableTeams();
			const users = await getAvailableUsers();
			this._allUsers = users;

			// Send initial filter data
			this._panel.webview.postMessage({
				command: 'initFilters',
				payload: {
					teams: teams.map(t => ({ id: t, name: t })),
					users: users.map(u => ({ id: u, name: u })),
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

			const discovery = await discoverAllRules();
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
				rules = rules.filter(r => (r.title?.toLowerCase().includes(this._currentSearchTerm) || r.description?.toLowerCase().includes(this._currentSearchTerm) || r.content?.toLowerCase().includes(this._currentSearchTerm)));
			}

			// Convert to webview format
			const webRules = await Promise.all(rules.map(async rule => {
				const isApplied = await isRuleApplied(rule.id);
				return {
					id: rule.id,
					title: rule.title,
					description: rule.description || '',
					context: rule.metadata.context || '',
					globs: rule.metadata.globs || [],
					preview: getRulePreview(rule.content, 3),
					author: rule.team || rule.user || '',
					lastUpdated: rule.lastUpdated ? new Date(rule.lastUpdated).toLocaleDateString() : '',
					team: rule.team || '',
					user: rule.user || '',
					isApplied
				};
			}));

			// Sort: applied first, then alphabetically by title
			webRules.sort((a, b) => {
				if (a.isApplied && !b.isApplied) return -1;
				if (!a.isApplied && b.isApplied) return 1;
				return a.title.localeCompare(b.title);
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
			const discovery = await discoverAllRules();
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
						<button id="clear-filters-btn" class="btn btn-secondary">Clear</button>
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
