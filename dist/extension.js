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
var vscode = __toESM(require("vscode"));
function activate(context) {
  console.log('Congratulations, your extension "cursor-rules-registry" is now active!');
  const disposable = vscode.commands.registerCommand("cursor-rules-registry.open", () => {
    CursorRulesRegistryPanel.createOrShow(context.extensionUri);
  });
  context.subscriptions.push(disposable);
}
function deactivate() {
}
var CursorRulesRegistryPanel = class _CursorRulesRegistryPanel {
  static currentPanel;
  static viewType = "cursorRulesRegistry";
  _panel;
  _extensionUri;
  _disposables = [];
  static createOrShow(extensionUri) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : void 0;
    if (_CursorRulesRegistryPanel.currentPanel) {
      _CursorRulesRegistryPanel.currentPanel._panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      _CursorRulesRegistryPanel.viewType,
      "Cursor Rules Registry",
      column || vscode.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,
        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
          vscode.Uri.joinPath(extensionUri, "out/compiled")
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
      (message) => {
        switch (message.command) {
          case "alert":
            vscode.window.showErrorMessage(message.text);
            return;
        }
      },
      null,
      this._disposables
    );
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
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.js"));
    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.css"));
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
