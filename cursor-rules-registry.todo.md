# Cursor Rules Registry Extension - Implementation Plan

## Project Overview
Build a Cursor extension that provides discoverability and management of Cursor rules across teams and users at Samsara. The extension will have a tabbed UI similar to Cursor Settings with Explore, Team, and Personal tabs.

## Phase 1: Foundation & Basic Structure

### Step 1.1: Extension Setup and Basic UI Framework
**Goal**: Create the basic extension structure with tabbed UI similar to Cursor Settings.

**Tasks**:
- [X] Initialize VSCode extension project with TypeScript
- [X] Set up basic extension manifest and package.json
- [X] Create main extension entry point
- [X] Implement basic tabbed UI structure (Explore, Team, Personal tabs)
- [X] Set up basic WebView panel for the extension UI
- [X] Add basic styling to match Cursor's design system

**Deliverable**: Basic extension that opens with three tabs in the UI.

---

### Step 1.2: Directory Structure and File Operations
**Goal**: Implement core file system operations for registry management.

**Tasks**:
- [X] Create utility functions for directory creation
- [X] Implement automatic `.cursor/registry` structure creation
- [X] Add functions to scan registry directories recursively
- [X] Create file operation utilities (copy, remove, exists checks)
- [X] Implement basic error handling for file operations
- [X] Add logging utilities for debugging

**Deliverable**: Extension can create and scan the registry directory structure.

---

### Step 1.3: MDC Parser and Rule Discovery
**Goal**: Parse and discover rules from the registry.

**Tasks**:
- [X] Implement MDC file parser (YAML frontmatter + content)
- [X] Create rule metadata interface/type definitions
- [X] Add validation for MDC format (accept missing fields, reject malformed)
- [X] Implement recursive rule discovery from registry
- [X] Create rule data structures and interfaces
- [X] Add basic rule filtering and sorting

**Deliverable**: Extension can discover and parse all rules from the registry.

---

## Phase 2: Team Detection and User Management

### Step 2.1: Git Integration and User Email Detection
**Goal**: Get user email from git configuration.

**Tasks**:
- [X] Implement git config reading utilities
- [X] Add fallback to Cursor settings for user email
- [X] Create user email validation (Samsara domain check)
- [X] Add error handling for missing git config
- [X] Implement email extraction from various git config formats

**Deliverable**: Extension can reliably get the current user's email.

---

### Step 2.2: Go File Parser for Team Detection
**Goal**: Parse Go files to detect user's team membership.

**Tasks**:
- [ ] Implement Go file scanner for `go/src/samsaradev.io/team` directory
- [ ] Create parser for `MemberInfo` structs
- [ ] Create parser for `TeamInfo` structs
- [ ] Implement email-to-team mapping logic
- [ ] Add support for multiple team memberships
- [ ] Handle edge cases (missing team directory, parse errors)

**Deliverable**: Extension can detect which teams the user belongs to.

---

### Step 2.3: Team Rule Filtering and UI
**Goal**: Implement team-specific rule filtering in the UI.

**Tasks**:
- [ ] Add team detection to rule discovery process
- [ ] Implement team dropdown for multi-team users
- [ ] Create team-specific rule filtering logic
- [ ] Add team information display in rule list
- [ ] Implement fallback to all teams when detection fails
- [ ] Add manual team selection option

**Deliverable**: Team tab shows rules filtered by user's team(s).

---

## Phase 3: Rule Management and Application

### Step 3.1: Rule Application System
**Goal**: Enable users to apply rules to their workspace.

**Tasks**:
- [ ] Implement rule copying to `.cursor/rules/applied` directory
- [ ] Add duplicate name handling with suffix
- [ ] Create rule configuration UI (apply strategy, globs)
- [ ] Implement rule tracking (which rules are applied)
- [ ] Add success/failure feedback for operations
- [ ] Create rule removal functionality

**Deliverable**: Users can apply rules with custom configuration.

---

### Step 3.2: Applied Rules Management
**Goal**: Track and manage applied rules.

**Tasks**:
- [ ] Implement applied rules tracking system
- [ ] Create applied rules list in UI
- [ ] Add visual indicators for applied vs available rules
- [ ] Implement rule removal from applied directory
- [ ] Add applied rules persistence across sessions
- [ ] Create applied rules status display

**Deliverable**: Extension tracks and displays which rules are currently applied.

---

### Step 3.3: Rule Configuration and Customization
**Goal**: Allow users to customize rules during application.

**Tasks**:
- [ ] Create rule configuration modal/dialog
- [ ] Implement apply strategy selection (Always, Auto Attached, etc.)
- [ ] Add glob pattern editing interface
- [ ] Create rule preview with custom configuration
- [ ] Add validation for custom configurations
- [ ] Implement configuration persistence

**Deliverable**: Users can customize rule settings before applying.

---

## Phase 4: Search and Discovery

### Step 4.1: Fuzzy Search Implementation
**Goal**: Implement comprehensive search across all rule fields.

**Tasks**:
- [ ] Integrate fuzzy search library
- [ ] Implement search across rule names, descriptions, content, context
- [ ] Add search result highlighting
- [ ] Create search input UI component
- [ ] Implement search performance optimization
- [ ] Add search history (optional for MVP)

**Deliverable**: Users can search rules with fuzzy matching.

---

### Step 4.2: Rule Preview and Display
**Goal**: Create comprehensive rule display with previews.

**Tasks**:
- [ ] Implement rule list/grid view with summaries
- [ ] Add expandable content preview (first 3 lines)
- [ ] Create detailed rule view with full content
- [ ] Add metadata display (author, last updated, etc.)
- [ ] Implement rule content formatting
- [ ] Add syntax highlighting for code blocks

**Deliverable**: Users can browse and preview rules effectively.

---

### Step 4.3: Personal Rules Management
**Goal**: Implement personal rules tab functionality.

**Tasks**:
- [ ] Create personal rules discovery from user directory
- [ ] Implement personal rules display in Personal tab
- [ ] Add personal rule application functionality
- [ ] Create personal rules management interface
- [ ] Add personal rules creation guidance
- [ ] Implement personal rules organization

**Deliverable**: Personal tab shows and manages user's personal rules.

---

## Phase 5: UI Polish and User Experience

### Step 5.1: Empty States and Help Text
**Goal**: Provide helpful guidance for empty states and first-time users.

**Tasks**:
- [ ] Create empty state UI for no rules found
- [ ] Add help text and guidance messages
- [ ] Implement first-time user onboarding
- [ ] Create documentation links and examples
- [ ] Add contextual help throughout the UI
- [ ] Implement progressive disclosure for complex features

**Deliverable**: Users get helpful guidance when no rules are available.

---

### Step 5.2: Error Handling and User Feedback
**Goal**: Implement comprehensive error handling and user feedback.

**Tasks**:
- [ ] Create error message display system
- [ ] Implement error logging for debugging
- [ ] Add user-friendly error messages
- [ ] Create loading states and progress indicators
- [ ] Implement retry mechanisms for failed operations
- [ ] Add success notifications and feedback

**Deliverable**: Users get clear feedback for all operations and errors.

---

### Step 5.3: UI Polish and Responsiveness
**Goal**: Polish the UI and ensure good user experience.

**Tasks**:
- [ ] Implement responsive design for different window sizes
- [ ] Add keyboard navigation support
- [ ] Create smooth animations and transitions
- [ ] Implement accessibility features
- [ ] Add theme support (light/dark mode)
- [ ] Polish visual design and spacing

**Deliverable**: Extension has a polished, professional UI.

---

## Phase 6: Testing and Integration

### Step 6.1: Unit Testing
**Goal**: Implement comprehensive unit tests for core functionality.

**Tasks**:
- [ ] Set up testing framework (Jest/Mocha)
- [ ] Write tests for MDC parsing
- [ ] Add tests for team detection logic
- [ ] Create tests for file operations
- [ ] Implement search functionality tests
- [ ] Add error handling tests

**Deliverable**: Core functionality is thoroughly tested.

---

### Step 6.2: Integration Testing
**Goal**: Test end-to-end workflows and integration.

**Tasks**:
- [ ] Create integration tests for rule discovery workflow
- [ ] Add tests for team detection with various repository structures
- [ ] Implement rule enablement testing
- [ ] Create error scenario testing
- [ ] Add performance testing for large rule repositories
- [ ] Test cross-platform compatibility

**Deliverable**: End-to-end workflows are tested and reliable.

---

### Step 6.3: Manual Testing and Documentation
**Goal**: Manual testing and user documentation.

**Tasks**:
- [ ] Create manual testing checklist
- [ ] Test first-time user experience
- [ ] Verify multi-team user scenarios
- [ ] Test error handling and edge cases
- [ ] Create user documentation and README
- [ ] Add developer documentation

**Deliverable**: Extension is ready for user testing and deployment.

---

## Implementation Prompts for Code Generation

### Prompt 1: Extension Foundation
```text
Create a new VSCode extension project for a Cursor Rules Registry extension. The extension should:
- Use TypeScript
- Have a basic manifest structure
- Include a WebView panel that opens with three tabs: Explore, Team, Personal
- Match Cursor's design system styling
- Have basic error handling and logging

The extension should be structured to support rule discovery, team detection, and rule management functionality.
```

### Prompt 2: File System Operations
```text
Implement file system utilities for the Cursor Rules Registry extension:
- Functions to create .cursor/registry directory structure
- Recursive scanning of registry directories
- MDC file parsing (YAML frontmatter + content)
- Rule metadata validation
- File copy/remove operations with error handling
- Logging utilities for debugging

The utilities should handle the registry structure: .cursor/registry/teams/[team-name] and .cursor/registry/users/[email].
```

### Prompt 3: Team Detection System
```text
Implement team detection for the Cursor Rules Registry extension:
- Get user email from git config with fallback to Cursor settings
- Parse Go files in go/src/samsaradev.io/team directory
- Extract MemberInfo and TeamInfo structs
- Map user email to team memberships
- Handle multiple team memberships
- Provide fallback when team detection fails

The system should support the Samsara team structure and handle edge cases gracefully.
```

### Prompt 4: Rule Discovery and Parsing
```text
Implement rule discovery and parsing for the Cursor Rules Registry extension:
- Recursive scanning of .cursor/registry directories
- MDC file parsing with metadata extraction
- Rule data structures and interfaces
- Validation (accept missing fields, reject malformed files)
- Rule filtering and sorting
- Integration with team detection

The system should discover rules from teams and users directories and parse their metadata and content.
```

### Prompt 5: Rule Application System
```text
Implement rule application system for the Cursor Rules Registry extension:
- Copy rules to .cursor/rules/applied directory
- Handle duplicate names with suffix
- Track applied rules
- Provide configuration UI for apply strategy and globs
- Success/failure feedback
- Rule removal functionality

The system should allow users to customize rules before applying and track which rules are currently active.
```

### Prompt 6: Search and UI Components
```text
Implement search and UI components for the Cursor Rules Registry extension:
- Fuzzy search across rule names, descriptions, content, context
- Rule list/grid view with summaries
- Expandable content preview (first 3 lines)
- Search result highlighting
- Rule metadata display
- Responsive design and accessibility

The UI should provide effective rule discovery and browsing capabilities.
```

### Prompt 7: Tab Management and Integration
```text
Implement tab management and integration for the Cursor Rules Registry extension:
- Explore tab with all available rules and search
- Team tab with team-specific rules and team selection
- Personal tab with user's personal rules
- Tab switching and state management
- Integration of all previous components
- Empty states and help text

The extension should provide a complete tabbed interface similar to Cursor Settings.
```

### Prompt 8: Error Handling and Polish
```text
Implement comprehensive error handling and UI polish for the Cursor Rules Registry extension:
- User-friendly error messages and logging
- Loading states and progress indicators
- Empty states with helpful guidance
- Keyboard navigation and accessibility
- Theme support and visual polish
- Performance optimization

The extension should provide a professional, polished user experience with robust error handling.
```

### Prompt 9: Testing and Documentation
```text
Implement testing and documentation for the Cursor Rules Registry extension:
- Unit tests for core functionality (MDC parsing, team detection, file operations)
- Integration tests for end-to-end workflows
- Manual testing checklist
- User documentation and README
- Developer documentation
- Performance testing

The extension should be thoroughly tested and well-documented for deployment.
```

## Success Criteria
- [ ] Extension opens with three functional tabs (Explore, Team, Personal)
- [ ] Users can discover and search rules from the registry
- [ ] Team detection works automatically for Samsara repositories
- [ ] Users can apply rules with custom configuration
- [ ] Applied rules are tracked and manageable
- [ ] Search works across all rule fields
- [ ] Error handling is comprehensive and user-friendly
- [ ] UI is polished and matches Cursor's design
- [ ] Extension is thoroughly tested and documented
- [ ] Performance is acceptable for large rule repositories

## Notes
- Each step builds on the previous steps
- No orphaned code - each component is integrated
- Focus on MVP features first, enhancements later
- Maintain backward compatibility with existing Cursor rules
- Follow VSCode extension best practices
- Consider performance implications for large repositories 