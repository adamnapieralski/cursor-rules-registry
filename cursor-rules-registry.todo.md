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
- [X] Implement automatic `.cursor-rules-registry` structure creation
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
- [X] Implement Go file scanner for `go/src/samsaradev.io/team` directory
- [X] Create parser for `MemberInfo` structs
- [X] Create parser for `TeamInfo` structs
- [X] Implement email-to-team mapping logic
- [X] Add support for multiple team memberships
- [X] Handle edge cases (missing team directory, parse errors)
- [X] Fix parser to handle actual Go file structure with variable references

**Deliverable**: Extension can detect which teams the user belongs to.

---

### Step 2.3: Team Rule Filtering and UI
**Goal**: Implement team-specific rule filtering in the UI.

**Tasks**:
- [X] Add team detection to rule discovery process
- [X] Implement team dropdown for multi-team users
- [X] Create team-specific rule filtering logic
- [X] Add team information display in rule list
- [X] Implement fallback to all teams when detection fails
- [X] Add manual team selection option

**Deliverable**: Team tab shows rules filtered by user's team(s).

---

## Phase 3: Rule Management and Application

### Step 3.1: Rule Application System ✅
**Goal**: Enable users to apply rules to their workspace.

**Tasks**:
- [x] Implement rule copying to `.cursor/rules/registry` directory
- [x] Add duplicate name handling with suffix
- [x] Create rule application configuration interface
- [x] Implement success/failure feedback
- [x] Add applied rule tracking
- [x] Create rule removal functionality
- [x] Update applied rule filenames to include source info (team/user)
- [x] Extract username from email for applied rule filenames

**Deliverable**: Users can apply and remove rules with proper feedback.

---

### Step 3.2: Applied Rules UI Integration ✅
**Goal**: Show applied rules at the top of each tab with visual indicators.

**Tasks**:
- [x] Sort applied rules to the top of rule lists
- [x] Add green dot indicator for applied rules
- [x] Update UI refresh logic when applying/removing rules
- [x] Track active tab for proper UI updates
- [x] Remove separate "Applied" tab

**Deliverable**: Applied rules are clearly visible at the top of each tab.

---

### Step 3.3: Fuzzy Search Implementation ✅
**Goal**: Add fuzzy search functionality to the Explore tab.

**Tasks**:
- [x] Implement fuzzy matching algorithm
- [x] Search across multiple fields (title, description, content, context, team, user)
- [x] Add debounced search input
- [x] Highlight matched terms in search results
- [x] Add content snippets showing matched parts
- [x] Implement scoring system for search results

**Deliverable**: Users can search rules with fuzzy matching and see relevant snippets.

---

### Step 3.4: MDC Frontmatter Support ✅
**Goal**: Support custom MDC frontmatter fields for better rule metadata.

**Tasks**:
- [x] Add support for `title` field in frontmatter
- [x] Add support for `context` field in frontmatter
- [x] Update UI to display context information
- [x] Include context in search functionality
- [x] Fix YAML parsing for glob patterns
- [x] Preprocess YAML to handle single glob strings

**Deliverable**: Rules can use custom title and context fields with proper display.

---

### Step 3.5: Metadata Display Improvements ✅
**Goal**: Improve how rule metadata is displayed in the UI.

**Tasks**:
- [x] Show "Description:", "Context:", and "Globs:" labels only when available
- [x] Display globs as comma-separated lists
- [x] Update CSS styling for metadata display
- [x] Ensure proper spacing and formatting

**Deliverable**: Rule metadata is displayed clearly and only when relevant.

---

### Step 3.6: Apply All Functionality ✅
**Goal**: Add "Apply All" buttons for bulk rule application.

**Tasks**:
- [x] Add "Apply All" buttons to Team and Personal tabs
- [x] Implement backend logic to apply all unapplied rules
- [x] Update UI to handle button clicks
- [x] Provide feedback for bulk operations
- [x] Handle errors gracefully

**Deliverable**: Users can apply all rules in a tab with a single click.

---

### Step 3.7: Directory Structure Update ✅
**Goal**: Update registry directory structure to use `.cursor-rules-registry` for teams and users.

**Tasks**:
- [x] Update all code to use `.cursor-rules-registry` for teams and users
- [x] Keep applied rules in `.cursor/rules/registry`
- [x] Update `.gitignore` and `.cursorignore` files
- [x] Update specification document
- [x] Update todo file

**Deliverable**: Teams and users are in `.cursor-rules-registry`, applied rules are in `.cursor/rules/registry`.

---

## Phase 4: Testing and Documentation

### Step 4.1: Comprehensive Testing
**Goal**: Ensure the extension works reliably across different scenarios.

**Tasks**:
- [ ] Write unit tests for core functionality
- [ ] Test team detection with various Go file structures
- [ ] Test rule application with different configurations
- [ ] Test search functionality with various queries
- [ ] Test error handling and edge cases
- [ ] Manual testing of all user workflows

**Deliverable**: Extension is thoroughly tested and reliable.

---

### Step 4.2: Documentation and Demo
**Goal**: Provide clear documentation and demo for users.

**Tasks**:
- [x] Create structured live demo outline
- [ ] Write user documentation
- [ ] Create installation guide
- [ ] Document team setup process
- [ ] Create troubleshooting guide

**Deliverable**: Users have clear guidance on how to use the extension.

---

## Phase 5: Polish and Optimization

### Step 5.1: Performance Optimization
**Goal**: Ensure the extension performs well with large rule repositories.

**Tasks**:
- [ ] Optimize rule discovery for large directories
- [ ] Implement caching for frequently accessed data
- [ ] Optimize search performance
- [ ] Add loading indicators for long operations
- [ ] Profile and optimize memory usage

**Deliverable**: Extension performs well even with many rules.

---

### Step 5.2: UI/UX Improvements
**Goal**: Enhance the user experience with better UI design.

**Tasks**:
- [ ] Improve visual design and styling
- [ ] Add keyboard shortcuts
- [ ] Implement better error messages
- [ ] Add tooltips and help text
- [ ] Improve accessibility

**Deliverable**: Extension has a polished, professional UI.

---

## Current Status
✅ **Completed**: Core functionality, rule application, search, team detection, UI improvements, directory structure update
🔄 **In Progress**: Testing and documentation
⏳ **Pending**: Performance optimization, UI polish

## Next Steps
1. Complete comprehensive testing
2. Write user documentation
3. Performance optimization
4. UI/UX improvements
5. Prepare for release

The extension should be structured to support rule discovery, team detection, and rule management functionality. 