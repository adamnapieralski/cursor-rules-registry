"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));

// src/fileUtils.ts
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
async function createRegistryStructure(workspaceRoot) {
  const registryPath = path.join(workspaceRoot, ".cursor", "registry");
  const teamsPath = path.join(registryPath, "teams");
  const usersPath = path.join(registryPath, "users");
  try {
    if (!fs.existsSync(registryPath)) {
      fs.mkdirSync(registryPath, { recursive: true });
      console.log("Created .cursor/registry directory");
    }
    if (!fs.existsSync(teamsPath)) {
      fs.mkdirSync(teamsPath, { recursive: true });
      console.log("Created .cursor/registry/teams directory");
    }
    if (!fs.existsSync(usersPath)) {
      fs.mkdirSync(usersPath, { recursive: true });
      console.log("Created .cursor/registry/users directory");
    }
  } catch (error2) {
    console.error("Error creating registry structure:", error2);
    throw new Error(`Failed to create registry structure: ${error2}`);
  }
}
async function scanRegistryDirectories(workspaceRoot) {
  const registryPath = path.join(workspaceRoot, ".cursor", "registry");
  const teamsPath = path.join(registryPath, "teams");
  const usersPath = path.join(registryPath, "users");
  const structure = {
    teams: [],
    users: []
  };
  try {
    if (fs.existsSync(teamsPath)) {
      const teamDirs = fs.readdirSync(teamsPath, { withFileTypes: true });
      structure.teams = teamDirs.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
    }
    if (fs.existsSync(usersPath)) {
      const userDirs = fs.readdirSync(usersPath, { withFileTypes: true });
      structure.users = userDirs.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
    }
    console.log("Registry structure discovered:", structure);
    return structure;
  } catch (error2) {
    console.error("Error scanning registry directories:", error2);
    throw new Error(`Failed to scan registry directories: ${error2}`);
  }
}
async function scanForMdcFiles(directoryPath) {
  const mdcFiles = [];
  try {
    if (!fs.existsSync(directoryPath)) {
      return mdcFiles;
    }
    const items = fs.readdirSync(directoryPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(directoryPath, item.name);
      if (item.isDirectory()) {
        const subFiles = await scanForMdcFiles(fullPath);
        mdcFiles.push(...subFiles);
      } else if (item.isFile() && item.name.endsWith(".mdc")) {
        mdcFiles.push(fullPath);
      }
    }
    return mdcFiles;
  } catch (error2) {
    console.error(`Error scanning directory ${directoryPath}:`, error2);
    throw new Error(`Failed to scan directory ${directoryPath}: ${error2}`);
  }
}
function getWorkspaceRoot() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return void 0;
  }
  return workspaceFolders[0].uri.fsPath;
}

// src/logger.ts
var vscode2 = __toESM(require("vscode"));
var Logger = class _Logger {
  static instance;
  outputChannel;
  logLevel = 1 /* INFO */;
  constructor() {
    this.outputChannel = vscode2.window.createOutputChannel("Cursor Rules Registry");
  }
  static getInstance() {
    if (!_Logger.instance) {
      _Logger.instance = new _Logger();
    }
    return _Logger.instance;
  }
  /**
   * Set the log level
   */
  setLogLevel(level) {
    this.logLevel = level;
  }
  /**
   * Log a debug message
   */
  debug(message, ...args) {
    if (this.logLevel <= 0 /* DEBUG */) {
      this.log("DEBUG", message, ...args);
    }
  }
  /**
   * Log an info message
   */
  info(message, ...args) {
    if (this.logLevel <= 1 /* INFO */) {
      this.log("INFO", message, ...args);
    }
  }
  /**
   * Log a warning message
   */
  warn(message, ...args) {
    if (this.logLevel <= 2 /* WARN */) {
      this.log("WARN", message, ...args);
    }
  }
  /**
   * Log an error message
   */
  error(message, error2, ...args) {
    if (this.logLevel <= 3 /* ERROR */) {
      let fullMessage = message;
      if (error2) {
        fullMessage += `
Error: ${error2.message}`;
        if (error2.stack) {
          fullMessage += `
Stack: ${error2.stack}`;
        }
      }
      this.log("ERROR", fullMessage, ...args);
    }
  }
  /**
   * Internal logging method
   */
  log(level, message, ...args) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    this.outputChannel.appendLine(formattedMessage);
    if (args.length > 0) {
      args.forEach((arg) => {
        if (typeof arg === "object") {
          this.outputChannel.appendLine(JSON.stringify(arg, null, 2));
        } else {
          this.outputChannel.appendLine(String(arg));
        }
      });
    }
    console.log(formattedMessage, ...args);
  }
  /**
   * Show the output channel
   */
  showOutput() {
    this.outputChannel.show();
  }
  /**
   * Clear the output channel
   */
  clear() {
    this.outputChannel.clear();
  }
  /**
   * Dispose the output channel
   */
  dispose() {
    this.outputChannel.dispose();
  }
};
var logger = Logger.getInstance();
function info(message, ...args) {
  logger.info(message, ...args);
}
function error(message, error2, ...args) {
  logger.error(message, error2, ...args);
}

// src/extension.ts
function activate(context) {
  info("Cursor Rules Registry extension is now active!");
  const disposable = vscode3.commands.registerCommand("cursor-rules-registry.open", async () => {
    try {
      await initializeRegistry();
      CursorRulesRegistryPanel.createOrShow(context.extensionUri);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      error("Failed to open Cursor Rules Registry", err);
      vscode3.window.showErrorMessage(`Failed to open Cursor Rules Registry: ${errorMessage}`);
    }
  });
  context.subscriptions.push(disposable);
}
function deactivate() {
  logger.dispose();
}
async function initializeRegistry() {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    throw new Error("No workspace folder found. Please open a workspace first.");
  }
  info("Initializing registry for workspace:", workspaceRoot);
  try {
    await createRegistryStructure(workspaceRoot);
    const structure = await scanRegistryDirectories(workspaceRoot);
    info("Registry structure discovered:", structure);
    const registryPath = `${workspaceRoot}/.cursor/registry`;
    const mdcFiles = await scanForMdcFiles(registryPath);
    info(`Found ${mdcFiles.length} .mdc files in registry`);
  } catch (err) {
    error("Failed to initialize registry", err);
    throw err;
  }
}
var CursorRulesRegistryPanel = class _CursorRulesRegistryPanel {
  static currentPanel;
  static viewType = "cursorRulesRegistry";
  _panel;
  _extensionUri;
  _disposables = [];
  static createOrShow(extensionUri) {
    const column = vscode3.window.activeTextEditor ? vscode3.window.activeTextEditor.viewColumn : void 0;
    if (_CursorRulesRegistryPanel.currentPanel) {
      _CursorRulesRegistryPanel.currentPanel._panel.reveal(column);
      return;
    }
    const panel = vscode3.window.createWebviewPanel(
      _CursorRulesRegistryPanel.viewType,
      "Cursor Rules Registry",
      column || vscode3.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,
        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [
          vscode3.Uri.joinPath(extensionUri, "media"),
          vscode3.Uri.joinPath(extensionUri, "out/compiled")
        ]
      }
    );
    _CursorRulesRegistryPanel.currentPanel = new _CursorRulesRegistryPanel(panel, extensionUri);
  }
  static kill() {
    _CursorRulesRegistryPanel.currentPanel?.dispose();
    _CursorRulesRegistryPanel.currentPanel = void 0;
  }
  static revive(panel, extensionUri) {
    _CursorRulesRegistryPanel.currentPanel = new _CursorRulesRegistryPanel(panel, extensionUri);
  }
  constructor(panel, extensionUri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          await this.handleWebviewMessage(message);
        } catch (err) {
          error("Error handling webview message", err);
          this._panel.webview.postMessage({
            command: "showError",
            text: err instanceof Error ? err.message : "Unknown error occurred"
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
  async handleWebviewMessage(message) {
    switch (message.command) {
      case "loadData":
        await this.loadInitialData();
        break;
      case "loadTabData":
        await this.loadTabData(message.tab);
        break;
      case "search":
        await this.handleSearch(message.text);
        break;
      case "selectTeam":
        await this.handleTeamSelection(message.team);
        break;
      case "applyRule":
        await this.handleApplyRule(message.ruleId);
        break;
      case "previewRule":
        await this.handlePreviewRule(message.ruleId);
        break;
      default:
        info("Unknown message command:", message.command);
    }
  }
  /**
   * Load initial data for the extension
   */
  async loadInitialData() {
    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        throw new Error("No workspace folder found");
      }
      const structure = await scanRegistryDirectories(workspaceRoot);
      this._panel.webview.postMessage({
        command: "updateTeams",
        teams: structure.teams.map((team) => ({ id: team, name: team }))
      });
      await this.loadTabData("explore");
    } catch (err) {
      error("Failed to load initial data", err);
      this._panel.webview.postMessage({
        command: "showError",
        text: err instanceof Error ? err.message : "Failed to load initial data"
      });
    }
  }
  /**
   * Load data for a specific tab
   */
  async loadTabData(tabName) {
    try {
      this._panel.webview.postMessage({
        command: "showLoading",
        tab: tabName
      });
      const rules = [];
      this._panel.webview.postMessage({
        command: "updateRules",
        tab: tabName,
        rules
      });
    } catch (err) {
      error(`Failed to load data for tab ${tabName}`, err);
      this._panel.webview.postMessage({
        command: "showError",
        text: `Failed to load data for ${tabName} tab`
      });
    }
  }
  /**
   * Handle search functionality
   */
  async handleSearch(searchTerm) {
    info("Search requested:", searchTerm);
  }
  /**
   * Handle team selection
   */
  async handleTeamSelection(teamId) {
    info("Team selected:", teamId);
  }
  /**
   * Handle rule application
   */
  async handleApplyRule(ruleId) {
    info("Apply rule requested:", ruleId);
  }
  /**
   * Handle rule preview
   */
  async handlePreviewRule(ruleId) {
    info("Preview rule requested:", ruleId);
  }
  dispose() {
    _CursorRulesRegistryPanel.currentPanel = void 0;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
  _update() {
    const webview = this._panel.webview;
    this._panel.title = "Cursor Rules Registry";
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }
  _getHtmlForWebview(webview) {
    const scriptUri = webview.asWebviewUri(vscode3.Uri.joinPath(this._extensionUri, "media", "main.js"));
    const styleResetUri = webview.asWebviewUri(vscode3.Uri.joinPath(this._extensionUri, "media", "reset.css"));
    const styleVSCodeUri = webview.asWebviewUri(vscode3.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
    const styleMainUri = webview.asWebviewUri(vscode3.Uri.joinPath(this._extensionUri, "media", "main.css"));
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
};
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
