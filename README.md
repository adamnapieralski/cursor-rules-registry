# Cursor Rules Registry

A VS Code extension that improves discoverability and management of Cursor rules across teams and users at Samsara. This extension addresses the problem of scattered knowledge and tedious copy-pasting of rules by providing a centralized, searchable registry with team and personal tabs, fuzzy search, rule previews, and one-click apply functionality.

## Features

### 🏢 Team Collaboration
- **Team Tab**: Discover and apply rules from your team members
- **Automatic Team Detection**: Automatically detects your team memberships from Go code
- **Team Switching**: Switch between teams if you're on multiple teams
- **Apply All Team Rules**: One-click application of all team rules

### 👤 Personal Rules
- **Personal Tab**: Manage your own rules
- **Individual Rule Sharing**: Share personal rules with the team
- **Consistent Interface**: Same metadata display and preview functionality

### 🔍 Advanced Search
- **Explore Tab**: Search across all available rules from teams and users
- **Fuzzy Search**: Search across titles, descriptions, content, and custom fields
- **Highlighted Results**: Matching terms are highlighted in search results
- **Custom Fields Support**: Support for custom fields like 'title' and 'context'

### ⚡ Quick Actions
- **Rule Preview**: Preview any rule before applying
- **One-Click Apply**: Apply rules with a single click
- **Apply Status**: Visual indicators show which rules are already applied
- **Remove Rules**: Remove applied rules when no longer needed

## How It Works

### Cursor Rules Overview
Cursor has two main ways to configure rules:

1. **Cursor Settings**: Global configurations that apply to all workspaces (accessible via Command Palette or settings UI)
2. **User Rules**: Workspace-specific rules stored in `.cursor/rules/` that apply only to the current project

This extension focuses on **User Rules** - the workspace-specific rules that teams and individuals create for their projects.

### Registry Structure
The extension creates and manages a registry structure in your workspace:

```
.cursor-rules-registry/
├── teams/
│   ├── TeamName1/
│   │   ├── rule1.mdc
│   │   └── rule2.mdc
│   └── TeamName2/
│       └── rule3.mdc
└── users/
    ├── user1@company.com/
    │   └── personal-rule.mdc
    └── user2@company.com/
        └── another-rule.mdc
```

### Applied Rules
Applied rules are stored in `.cursor/rules/registry/` and are automatically used by Cursor. The registry directory is tracked by git but ignored by Cursor, while the applied rules are ignored by git but used by Cursor.

### File Configuration
The extension requires proper configuration of `.cursorignore` and `.gitignore` files to work correctly:

#### .cursorignore
```
.cursor-rules-registry/teams/
.cursor-rules-registry/users/
!.cursor/rules/registry/
```

This tells Cursor to:
- Ignore the registry directories (so they don't interfere with Cursor's rule processing)
- Include the applied rules directory (so Cursor can use the applied rules)

#### .gitignore
```
.cursor/rules/registry/
```

This tells Git to:
- Track the registry directories (so rules can be shared via version control)
- Ignore the applied rules directory (so personal rule applications aren't committed)

## Installation

### From VSIX
1. Download the latest `.vsix` file from the releases
2. In VS Code, go to Extensions (Ctrl+Shift+X)
3. Click the "..." menu and select "Install from VSIX..."
4. Select the downloaded file

### From Source
1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Press F5 to launch the extension in a new Extension Development Host window

## Usage

### Opening the Registry
1. Open the Command Palette (Ctrl+Shift+P)
2. Type "Open Cursor Rules Registry"
3. Select the command to open the registry panel

### Using the Interface

#### Team Tab
- View rules from your team members
- Use the dropdown to switch between teams
- Click "Apply All" to apply all team rules at once
- Click "Preview" to see the full rule content before applying

#### Personal Tab
- View and manage your own rules
- Apply individual rules as needed
- Share your rules with the team by placing them in the registry

#### Explore Tab
- Search across all available rules
- Use fuzzy search to find rules by title, description, or content
- View custom fields like 'context' for additional information
- Applied rules appear at the top of the list

### Rule Format
Rules are stored as `.mdc` files with optional frontmatter for metadata:

```markdown
---
title: "Rule Title"
description: "Brief description of what this rule does"
context: "Additional context or links to documentation"
filePatterns: ["*.go", "*.ts"]
---

# Rule Content

Your rule content here...
```

## Development

### Prerequisites
- Node.js 18+
- VS Code 1.96.2+

### Setup
```bash
npm install
npm run compile
```

### Available Scripts
- `npm run compile` - Compile TypeScript and bundle with esbuild
- `npm run watch` - Watch for changes and recompile
- `npm run lint` - Run ESLint
- `npm run check-types` - Type check with TypeScript
- `npm run test` - Run tests
- `npm run package` - Create production build

### Project Structure
```
src/
├── extension.ts          # Main extension entry point
├── fileUtils.ts          # File system utilities
├── gitIntegration.ts     # Git user detection
├── goTeamParser.ts       # Go team membership parsing
├── logger.ts             # Logging utilities
├── mdcParser.ts          # Markdown rule parsing
├── ruleApplication.ts    # Rule application logic
├── ruleDiscovery.ts      # Rule discovery and search
└── test/                 # Test files
```

### Architecture
The extension uses a webview-based UI with message passing between the extension host and webview. The main components are:

- **Extension Host**: Manages file operations, rule discovery, and application
- **Webview**: Provides the user interface with tabs and search functionality
- **Message Passing**: Handles communication between host and webview

## Configuration

### Git Integration
The extension automatically detects your email from git configuration to show your personal rules.

### Team Detection
Team memberships are detected by parsing Go files in your workspace that contain team-related imports or structures.

## Troubleshooting

### Common Issues

**"No workspace folder found"**
- Make sure you have a workspace open in VS Code
- The extension requires a workspace to function

**"Failed to initialize registry"**
- Check that you have write permissions in your workspace
- Ensure the `.cursor-rules-registry` directory can be created

**Rules not appearing**
- Verify that rules are in the correct directory structure
- Check that rule files have the `.mdc` extension
- Ensure rule files have valid frontmatter

### Logs
Enable extension logging in VS Code settings to debug issues:
1. Open Command Palette
2. Type "Developer: Set Log Level"
3. Select "Extension Host"
4. Set level to "Debug"

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and version history.
