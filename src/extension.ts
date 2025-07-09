// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "cursor-rules-registry" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('cursor-rules-registry.open', () => {
		// Create and show panel
		CursorRulesRegistryPanel.createOrShow(context.extensionUri);
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

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
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
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
