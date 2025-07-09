// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { 
	createRegistryStructure, 
	scanRegistryDirectories, 
	scanForMdcFiles,
	getWorkspaceRoot,
	fileExists,
	directoryExists
} from './fileUtils';
import { logger, info, error } from './logger';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	info('Cursor Rules Registry extension is now active!');

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
		const registryPath = `${workspaceRoot}/.cursor/registry`;
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

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
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
			case 'loadTabData':
				await this.loadTabData(message.tab);
				break;
			case 'search':
				await this.handleSearch(message.text);
				break;
			case 'selectTeam':
				await this.handleTeamSelection(message.team);
				break;
			case 'applyRule':
				await this.handleApplyRule(message.ruleId);
				break;
			case 'previewRule':
				await this.handlePreviewRule(message.ruleId);
				break;
			default:
				info('Unknown message command:', message.command);
		}
	}

	/**
	 * Load initial data for the extension
	 */
	private async loadInitialData(): Promise<void> {
		try {
			const workspaceRoot = getWorkspaceRoot();
			if (!workspaceRoot) {
				throw new Error('No workspace folder found');
			}

			// Scan registry structure
			const structure = await scanRegistryDirectories(workspaceRoot);
			
			// Send structure to webview
			this._panel.webview.postMessage({
				command: 'updateTeams',
				teams: structure.teams.map(team => ({ id: team, name: team }))
			});

			// Load initial rules for explore tab
			await this.loadTabData('explore');

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
	private async loadTabData(tabName: string): Promise<void> {
		try {
			// Show loading state
			this._panel.webview.postMessage({
				command: 'showLoading',
				tab: tabName
			});

			// For now, return empty rules (will be implemented in next steps)
			const rules: any[] = [];
			
			this._panel.webview.postMessage({
				command: 'updateRules',
				tab: tabName,
				rules: rules
			});

		} catch (err) {
			error(`Failed to load data for tab ${tabName}`, err as Error);
			this._panel.webview.postMessage({
				command: 'showError',
				text: `Failed to load data for ${tabName} tab`
			});
		}
	}

	/**
	 * Handle search functionality
	 */
	private async handleSearch(searchTerm: string): Promise<void> {
		info('Search requested:', searchTerm);
		// TODO: Implement search functionality in next steps
	}

	/**
	 * Handle team selection
	 */
	private async handleTeamSelection(teamId: string): Promise<void> {
		info('Team selected:', teamId);
		// TODO: Implement team selection functionality in next steps
	}

	/**
	 * Handle rule application
	 */
	private async handleApplyRule(ruleId: string): Promise<void> {
		info('Apply rule requested:', ruleId);
		// TODO: Implement rule application in next steps
	}

	/**
	 * Handle rule preview
	 */
	private async handlePreviewRule(ruleId: string): Promise<void> {
		info('Preview rule requested:', ruleId);
		// TODO: Implement rule preview in next steps
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
					<div class="sidebar">
						<div class="tab-nav">
							<button class="tab-button active" data-tab="explore">Explore</button>
							<button class="tab-button" data-tab="team">Team</button>
							<button class="tab-button" data-tab="personal">Personal</button>
						</div>
					</div>
					<div class="content">
						<div class="tab-content active" id="explore">
							<div class="search-container">
								<input type="text" id="search-input" placeholder="Search rules..." class="search-input">
							</div>
							<div class="rules-list" id="explore-rules">
								<div class="empty-state">
									<h3>No rules found</h3>
									<p>Rules will appear here once they are added to the registry.</p>
								</div>
							</div>
						</div>
						<div class="tab-content" id="team">
							<div class="team-selector">
								<select id="team-dropdown" class="team-dropdown">
									<option value="">Select team...</option>
								</select>
							</div>
							<div class="rules-list" id="team-rules">
								<div class="empty-state">
									<h3>No team rules found</h3>
									<p>Team rules will appear here once detected.</p>
								</div>
							</div>
						</div>
						<div class="tab-content" id="personal">
							<div class="rules-list" id="personal-rules">
								<div class="empty-state">
									<h3>No personal rules found</h3>
									<p>Your personal rules will appear here.</p>
								</div>
							</div>
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
