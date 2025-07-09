# Cursor Rules Registry Extension Specification

## Overview
A Cursor extension that increases discoverability of rules used by other teams and users, allowing convenient reuse of effective Cursor rules. The extension handles team-based rule management and provides a searchable interface for rule discovery.

## Target Audience
Software Engineers at Samsara who want to:
- Discover and reuse effective Cursor rules from other teams
- Solve tribal knowledge problems around rule creation
- Avoid copy-pasting rules from scattered sources
- Access team-specific rules not natively supported by Cursor

## Core Problem
Currently, writing effective Cursor rules at Samsara depends on:
- Knowing someone who's done it before
- Copy-pasting rules from scattered Slack threads, past PRs, or .mdc files
- Trial-and-error without guidance

## Architecture

### Directory Structure
```
.cursor/
├── rules/           # Cursor-tracked rules (active)
└── registry/
│   ├── applied/     # Extension-enabled rules (Not tracked by git)
    ├── teams/       # Team-specific rules (Tracked by git, ignored by cursor)
    │   ├── AssetFoundations/
    │   └── [other-teams]/
    └── users/       # User-specific rules (Tracked by git, ignored by cursor)
        ├── user1@samsara.com/
        └── [other-users]/
```

### Rule Format
Extended MDC format for registry rules:
```mdc
---
description: Rule description
globs: [file patterns]
alwaysApply: false
context: Additional context, links, usage notes
---
# Rule content
```

## Core Features

### 1. Rule Discovery
- **Automatic Scanning**: Recursively scan `.cursor/registry` subdirectories
- **Team Detection**: Automatically detect user's team by scanning `go/src/samsaradev.io/team` directory
- **Fallback**: If team detection fails, show all rules with manual team selection
- **Caching**: Cache discovered rules (optional for MVP)

### 2. User Interface
- **List/Grid View**: Display rules in summarized form with:
  - Title
  - Description
  - Author/team
  - Last updated
  - Preview of rule content (first 3 lines, expandable)
  - Apply rules configuration
- **Search**: Fuzzy search across rule names, descriptions, content, and context fields
- **Filtering**: By team, tags (future enhancement)

### 3. Rule Management
- **One-Click Enable**: Copy rule to `.cursor/rules/applied` directory
- **Configuration**: Allow users to modify apply strategy and glob patterns during enable
- **Conflict Resolution**: Append suffix to filename for duplicate names
- **Tracking**: Extension tracks which rules it has enabled
- **Removal**: Remove specific enabled rules from `.cursor/rules/applied`

### 4. Team Support
- **Multi-Team Users**: Dropdown/multi-select for team rule selection
- **Team Detection Logic**:
  1. Get user email from git/Cursor
  2. Scan `go/src/samsaradev.io/team` for email in `MemberInfo` structs
  3. Find associated `TeamInfo` structs
  4. Extract team name (e.g., "AssetFoundations")

### 5. UI
- 3 tabs: Explore, Team, Personal
- UI similar to the current Cursor Settings (tabs in the left navigation bar)

## User Workflows

### First-Time Setup
1. Extension automatically creates `.cursor/registry` structure if missing
2. Scans and detects user's team on first load
3. Displays all available registry rules in Explore tab
4. Shows help text for guidance

### Rule Discovery
1. User opens extension and goes to Explore tab (default tab)
2. Sees list of available rules with previews
3. Uses fuzzy search to find relevant rules
4. Clicks on rule to see full content and metadata

### Rule Enablement
1. User selects rule to enable
2. Extension shows configuration options (apply strategy, globs)
3. User confirms, rule is copied to `.cursor/rules/applied`
4. Extension provides success/failure feedback
5. The applied rule is visible as applied/toggled in Explore tab list.

### Team Rule Management
1. User goes to "Team" tab
2. For multi-team users, dropdown shows available teams. For single-team users, their team is simply displayed.
3. User can select specific team(s) for rule enablement
4. Extension lists all the team's rules.
5. User can apply selected team's rule, the same way as in Explore section.

### Personal Rule Management
1. User goes to "Personal" tab
2. They see their current registry rules under `.cursor/rules/users/[user@samsara.com]`
3. User can apply selected personal rules, the same way as in Explore section.

## Data Handling

### Rule Discovery
- Scan registry directories recursively
- Parse MDC files for metadata
- Accept missing metadata fields
- Reject (skip) malformed MDC files
- Cache results (optional for MVP)

### Team Detection
- Parse Go files in `go/src/samsaradev.io/team`
- Extract `MemberInfo` and `TeamInfo` structs
- Map user email to team membership
- Handle multiple team memberships

### File Operations
- Copy rules from registry to `.cursor/rules/applied`
- Never modify registry rules
- Handle duplicate names with suffix
- No backup required for existing rules
- Expect `.cursor/rules` directory to exist

## Error Handling

### Discovery Errors
- Malformed MDC files: Log error, skip file
- Missing team structure: Fall back to all teams view
- File system errors: Display error message, log for debugging

### Enablement Errors
- File copy failures: Display error, log for debugging
- Permission issues: Display error message
- Invalid configurations: Validate before copying

### Team Detection Errors
- Missing team directory: Show all teams with manual selection
- Email not found: Allow manual team specification
- Parse errors: Log for debugging, fall back gracefully

## Configuration

### MVP Limitations
- No extension settings
- No bulk operations
- No automatic update notifications
- No backup creation
- Assume no manual modifications to `.cursor/rules/applied`

### Assumptions
- Users won't manually modify extension-enabled rules
- Users won't add manual rules to `.cursor/rules/applied`
- Team structure follows Samsara conventions
- Git is available for email detection

## Testing Plan

### Unit Tests
- MDC parsing and validation
- Team detection logic
- File operations (copy, remove)
- Search functionality
- Error handling

### Integration Tests
- End-to-end rule discovery workflow
- Team detection with various repository structures
- Rule enablement with different configurations
- Error scenarios and fallbacks

### Manual Testing
- First-time user experience
- Multi-team user scenarios
- Search and filtering
- Rule preview and expansion
- Error message clarity

## Future Enhancements (Post-MVP)
- Tags and advanced filtering
- Bulk operations
- Rule update notifications
- Extension settings
- Backup and restore functionality
- Rule creation within extension
- Usage analytics
- Rule ratings and reviews

## Success Metrics
- Number of rules discovered and enabled
- User engagement with search functionality
- Reduction in rule creation time
- User satisfaction with discoverability
- Cross-team rule adoption

## Implementation Notes
- Use VSCode extension API for file operations
- Implement fuzzy search with appropriate libraries
- Use Go parser for team detection
- Follow Cursor's MDC format specifications
- Implement proper error logging for debugging
- Consider performance for large rule repositories 