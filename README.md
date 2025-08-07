# Cursor Rules Registry

A VS Code extension that improves discoverability and management of Cursor rules across teams and users at Samsara. This extension addresses the problem of scattered knowledge and tedious copy-pasting of rules by providing a centralized, searchable registry with team and personal tabs, fuzzy search, rule previews, and one-click apply functionality.

## Features

### 👤 Personal Rules
- **User Filter**: Quickly view and manage rules you've authored
- **Individual Rule Sharing**: Share personal rules with the team
- **Consistent Interface**: Same metadata display and preview functionality

### 🏢 Team Collaboration
- **Team Filter**: Discover and apply rules from your team members
- **Automatic Team Detection**: Automatically detects your team memberships from Go code
- **Team Switching**: Choose a team from the dropdown if you're on multiple teams

### 📁 Generic Rules
- **Flexible Organization**: Create rules in any subdirectory within the registry
- **Location Display**: Rules show their location path (e.g., "From /categories/productivity")
- **Unique IDs**: Path-based rule IDs ensure no conflicts across directories

### 🏷️ Rule Management
- **Tags**: Add multiple tags to rules for better organization and filtering
- **Tag Filtering**: Filter rules by tags with multi-select support
- **Metadata Editing**: Add custom titles and descriptions to any rule
- **Auto-cleanup**: Orphaned metadata is automatically removed when rules are deleted

### 🔍 Advanced Search & Sorting
- **Unified Search**: Search across all available rules from teams and users
- **Fuzzy Search**: Search across titles, descriptions, content, and custom fields
- **Highlighted Results**: Matching terms are highlighted in search results
- **Flexible Sorting**: Sort by title or last updated date, ascending or descending
- **Applied First**: Applied rules always appear at the top, then sorted by preference

### ⚡ Quick Actions
- **One-Click Apply**: Apply rules with a single click
- **Apply Status**: Visual indicators show which rules are already applied
- **Rule Preview**: Preview any rule before applying
- **Remove Rules**: Remove applied rules when no longer needed
- **Bulk Operations**: Clear all filters, refresh rules cache

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
├── users/
│   ├── user1@company.com/
│   │   └── personal-rule.mdc
│   └── user2@company.com/
│       └── another-rule.mdc
/* Generic rules */
├── frontend/
│   ├── react/
│   │   ├── hooks.mdc
│   │   └── components.mdc
│   └── styling.mdc
├── categories/
│   └── api
│       └──  api-design.mdc
├── general-rule.mdc
└── rules-metadata.jsonc  # Auto-generated metadata (tags, titles, descriptions)
```

**Flexible Organization**: Rules can be placed anywhere in the registry:
- **Team Rules**: `teams/TeamName/` - automatically attributed to the team
- **User Rules**: `users/email@domain.com/` - automatically attributed to the user  
- **Generic Rules**: Any other location - organized by project needs
  - **Nested Directories**: Create any folder structure that makes sense for your project

The registry directory can be configured with `cursorRulesRegistry.registryDirectory` setting (see more on Configuration in the section further below).

### Applied Rules
Applied rules are stored in `.cursor/rules/registry/` and are automatically used by Cursor. The registry directory is tracked by git but ignored by Cursor, while the applied rules are ignored by git but used by Cursor.

### File Configuration
The extension requires proper configuration of `.cursorignore` and `.gitignore` files to work correctly:

#### .cursorignore
```
.cursor-rules-registry/
```

This tells Cursor to ignore the registry directories (so they don't interfere with Cursor's rule processing).

#### .gitignore
```
.cursor/rules/registry/
```

This tells Git to ignore the applied rules directory (so personal rule applications aren't committed).

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

## Setup

### Local Registry Setup
By default, the extension creates a local registry structure in your workspace at `.cursor-rules-registry/`. This is suitable for project-specific rules that are committed alongside your code.

### Git Repository Setup
For organizations wanting to share rules across multiple projects, you can set up the registry as a separate Git repository, by e.g clonging external repository into a subdirectory:

1. Clone your rules repository into your workspace:
   ```bash
   git clone https://github.com/your-org/cursor-rules-registry.git .cursor-rules-registry
   ```

2. Configure the extension settings to use the correct directory and treat it as git repo:
   - Open VS Code Settings (Ctrl+,)
   - Set `cursorRulesRegistry.registryDirectory: <registry directory name>`
   - Set `cursorRulesRegistry.registryIsGit: true`
   
3. The extension will automatically pull updates on startup and when refreshing rules

#### Git Repository Benefits
- **Centralized Rules**: Share rules across all projects in your organization
- **Version Control**: Track changes and maintain rule history  
- **Automatic Updates**: Rules are automatically pulled on startup and refresh
- **Team Collaboration**: Multiple teams can contribute to the same rule repository

**Note**: When using Git repository mode, ensure your repository has the proper structure with `teams/` and `users/` directories, plus any custom organization you prefer.

## Usage

### Opening the Registry
1. Open the Command Palette (Ctrl+Shift+P)
2. Type "Cursor Rules Registry: Open"
3. Select the command to open the registry panel

### Using the Interface

- Use the **Team** dropdown to filter rules by team.
- Use the **User** dropdown to filter rules by author (select "Own" to show only your rules).
- Use the **Tags** dropdown to filter rules by tags (multi-select supported).
- Use the **Sort** dropdown to change the sorting order:
  - Title (A-Z) or Title (Z-A)
  - Last Updated (Oldest) or Last Updated (Newest)
- Use the search box to fuzzy search across titles, descriptions, and content.
- Click **Preview** to see the full rule content before applying.
- Click **Add Tag** to add tags to any rule for better organization.
- Click **Edit Metadata** to add custom titles and descriptions.
- Applied rules are indicated with a check-mark and appear at the top of the list.
- Click **Clear** to reset all filters and sorting to defaults.
- Click **Refresh Rules** to reload the rules cache and pull git updates (if configured).

### Rule Format
Rules are stored as `.mdc` files in the format according to [Cursor documentation](https://docs.cursor.com/en/context/rules), example:

```markdown
---
description: "Brief description of what this rule does"
globs: ["*.go", "*.ts"]
alwaysApply: true
---

# Rule Content

Your rule content here...
```

**Title Handling**: Rule titles are derived from the filename (without extension). You can override this by adding a custom title through the "Edit Metadata" feature.

**Additional Metadata**: Use the extension's metadata features to add:
- **Custom Titles**: Override the default filename-based title
- **Descriptions**: Add detailed descriptions beyond the frontmatter
- **Tags**: Organize rules with multiple tags for filtering

**Metadata Storage**: Custom metadata (titles, descriptions, tags) is stored in `rules-metadata.jsonc` and automatically managed by the extension.

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
├── metadataService.ts    # Rule metadata management (tags, titles, descriptions)
├── ruleApplication.ts    # Rule application logic
├── ruleDiscovery.ts      # Rule discovery and search
├── ruleId.ts             # Rule ID generation and path handling
└── test/                 # Test files
```

### Architecture
The extension uses a webview-based UI with message passing between the extension host and webview. The main components are:

- **Extension Host**: Manages file operations, rule discovery, and application
- **Webview**: Provides the user interface with tabs and search functionality
- **Message Passing**: Handles communication between host and webview

## Configuration

### Extension Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cursorRulesRegistry.registryDirectory` | string | `.cursor-rules-registry` | Workspace-relative directory that houses the `teams/` and `users/` folders. Change this if you need the registry elsewhere. |
| `cursorRulesRegistry.registryIsGit` | boolean | `false` | When enabled, the extension treats the registry directory as a standalone Git repository and performs a `git pull` once at startup and when refreshing rules to keep rules up to date. Perfect for organizations sharing rules across projects. |

### Git Integration
The extension automatically detects your email from git configuration to show your personal rules.

**Git Repository Mode**: When `registryIsGit` is enabled:
- Extension performs `git pull` on startup 
- Extension performs `git pull` when using "Refresh Rules" button
- No automatic commits - you manage the repository manually
- Ideal for centralized rule repositories shared across projects
- Supports both public and private repositories (uses your local Git credentials)

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

**Tags or metadata not saving**
- Check that the `rules-metadata.jsonc` file is not read-only
- Verify you have write permissions in the registry directory
- Try refreshing the rules cache

**Extension appears in wrong theme colors**
- Restart VS Code after changing themes
- Ensure you're using a recent version of VS Code (1.96.2+)

**Rules with same names conflicting**
- Use different subdirectories to organize rules with similar names
- Rule IDs are path-based, so rules in different folders won't conflict

**Git repository not updating**
- Verify the `registryIsGit` setting is enabled in VS Code settings
- Check that the registry directory is a valid Git repository (`git status` should work)
- Ensure you have proper Git credentials configured for the repository
- Check VS Code's Output panel (select "Cursor Rules Registry" from dropdown) for error messages
- Try manually running `git pull` in the registry directory to test connectivity

**Git authentication issues**
- Ensure your Git credentials are properly configured (`git config --list`)
- For private repositories, set up SSH keys or personal access tokens
- Test Git access outside VS Code first: `cd .cursor-rules-registry && git pull`

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
