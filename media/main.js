// Main JavaScript for Cursor Rules Registry WebView

(function() {
	'use strict';

	// Get the VS Code API
	const vscode = acquireVsCodeApi();

	// DOM elements
	const searchInput = document.getElementById('search-input');
	const teamDropdown = document.getElementById('team-dropdown');
	const userDropdown = document.getElementById('user-dropdown');
	const clearBtn = document.getElementById('clear-filters-btn');

		// Initialize the UI
	function initializeUI() {
		// No tabs now

		// Set up search functionality with debouncing
		if (searchInput) {
			let searchTimeout;
			searchInput.addEventListener('input', (event) => {
				// Clear previous timeout
				if (searchTimeout) {
					clearTimeout(searchTimeout);
				}
				
				// Debounce search to avoid too many requests
				searchTimeout = setTimeout(() => {
					handleSearch(event);
				}, 300); // 300ms delay
			});
		}

		if (teamDropdown) {
			teamDropdown.addEventListener('change', handleTeamChange);
		}
		if (userDropdown) {
			userDropdown.addEventListener('change', handleUserChange);
		}

		if (clearBtn) {
			clearBtn.addEventListener('click', () => {
				// reset dropdowns
				if (userDropdown) userDropdown.value = '';
				if (teamDropdown) teamDropdown.value = '';
				vscode.postMessage({ command: 'clearFilters' });
			});
		}

		// Load initial data
		loadInitialData();
	}

	// Handle search input
	function handleSearch(event) {
		const searchTerm = event.target.value.toLowerCase();
		
		// Send search message to extension
		vscode.postMessage({
			command: 'search',
			text: searchTerm
		});
	}

	// Handle user change
	function handleUserChange(event) {
		const selectedUser = event.target.value;
		vscode.postMessage({ command: 'selectUser', user: selectedUser });
	}

	// Handle team dropdown change
	function handleTeamChange(event) {
		const selectedTeam = event.target.value;
		vscode.postMessage({ command: 'selectTeam', team: selectedTeam });
	}

	// Load initial data
	function loadInitialData() {
		// Request initial data from extension
		vscode.postMessage({
			command: 'loadData'
		});
	}

	// (No tabs) 

	// Handle messages from the extension
	window.addEventListener('message', event => {
		const message = event.data;

		switch (message.command) {
			case 'updateMainRules':
				updateRulesList(message.rules);
				break;
			case 'initFilters':
				initializeFilters(message.payload);
				break;
			case 'showError':
				showError(message.text);
				break;
			case 'showLoadingMain':
				showLoading();
				break;
		}
	});

	// Update rules list for a specific tab
	function updateRulesList(rules) {
		const rulesContainer = document.getElementById('main-rules');
		if (!rulesContainer) return;

		if (!rules || rules.length === 0) {
			rulesContainer.innerHTML = `
				<div class="empty-state">
					<h3>No rules found</h3>
					<p>Rules will appear here once they are added to the registry.</p>
				</div>
			`;
			return;
		}

		// Get current search term for highlighting
		const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

		const rulesHTML = rules.map(rule => `
			<div class="rule-item" data-rule-id="${rule.id}">
				<div class="rule-header">
					<div class="rule-title">
						${rule.isApplied ? '<span class="status-dot active"></span>' : ''}
						${highlightSearchTerm(escapeHtml(rule.title), searchTerm)}
					</div>
				</div>
				<div class="rule-metadata">
					${rule.description ? `<div class="metadata-item"><strong>Description:</strong> ${highlightSearchTerm(escapeHtml(rule.description), searchTerm)}</div>` : ''}
					${rule.context ? `<div class="metadata-item"><strong>Context:</strong> ${highlightSearchTerm(escapeHtml(rule.context), searchTerm)}</div>` : ''}
					${rule.globs && rule.globs.length > 0 ? `<div class="metadata-item"><strong>Globs:</strong> ${highlightSearchTerm(escapeHtml(Array.isArray(rule.globs) ? rule.globs.join(', ') : rule.globs), searchTerm)}</div>` : ''}
				</div>
				<div class="rule-meta">
					${rule.author ? `By ${highlightSearchTerm(escapeHtml(rule.author), searchTerm)} • ` : ''}
					${rule.lastUpdated ? `Updated ${escapeHtml(rule.lastUpdated)}` : ''}
				</div>
				${rule.contentSnippets && rule.contentSnippets.length > 0 ? 
					`<div class="content-snippets">
						${rule.contentSnippets.map(snippet => 
							`<div class="content-snippet">${highlightSearchTerm(escapeHtml(snippet), searchTerm)}</div>`
						).join('')}
					</div>` : ''
				}
				${rule.preview && (!rule.contentSnippets || rule.contentSnippets.length === 0) ? 
					`<div class="rule-preview">${highlightSearchTerm(escapeHtml(rule.preview), searchTerm)}</div>` : ''
				}
				<div class="rule-actions">
					<button class="btn apply-btn ${rule.isApplied ? 'applied' : ''}" data-rule-id="${rule.id}">
						${rule.isApplied ? 'Remove' : 'Apply'}
					</button>
					<button class="btn btn-secondary preview-btn" data-rule-id="${rule.id}">Preview</button>
				</div>
			</div>
		`).join('');

		rulesContainer.innerHTML = rulesHTML;

		// Attach event listeners to the newly created buttons
		attachRuleButtonListeners(rulesContainer);
	}

	// Attach event listeners to rule action buttons
	function attachRuleButtonListeners(container) {
		// Apply/Remove button listeners
		const applyButtons = container.querySelectorAll('.apply-btn');
		applyButtons.forEach(button => {
			button.addEventListener('click', (event) => {
				const ruleId = event.target.getAttribute('data-rule-id');
				// Always send applyRule command - let the extension handle the toggle logic
				applyRule(ruleId);
			});
		});

		// Preview button listeners
		const previewButtons = container.querySelectorAll('.preview-btn');
		previewButtons.forEach(button => {
			button.addEventListener('click', (event) => {
				const ruleId = event.target.getAttribute('data-rule-id');
				previewRule(ruleId);
			});
		});
	}

	// Update team dropdown
	function initializeFilters(payload) {
		const { teams, users, userEmail, userTeams } = payload;

		// Populate user dropdown
		if (userDropdown) {
			userDropdown.innerHTML = '';

			// All users option
			const allOpt = document.createElement('option');
			allOpt.value = '';
			allOpt.textContent = 'All Users';
			userDropdown.appendChild(allOpt);

			// Own option next
			if (userEmail) {
				const ownOpt = document.createElement('option');
				ownOpt.value = '__own__';
				ownOpt.textContent = `Own – ${userEmail}`;
				userDropdown.appendChild(ownOpt);
			}

			users.forEach(u => {
				// Skip duplicate of own email
				if (userEmail && u.id === userEmail) return;
				const opt = document.createElement('option');
				opt.value = u.id;
				opt.textContent = u.name;
				userDropdown.appendChild(opt);
			});
		}

		// Populate team dropdown with own teams group
		if (teamDropdown) {
			teamDropdown.innerHTML = '';
			const emptyOpt = document.createElement('option');
			emptyOpt.value = '';
			emptyOpt.textContent = 'All Teams';
			teamDropdown.appendChild(emptyOpt);

			if (userTeams && userTeams.length > 0) {
				const ownGroup = document.createElement('optgroup');
				ownGroup.label = 'Own Teams';
				userTeams.forEach(t => {
					const opt = document.createElement('option');
					opt.value = t;
					opt.textContent = t;
					ownGroup.appendChild(opt);
				});
				teamDropdown.appendChild(ownGroup);
			}

			const allGroup = document.createElement('optgroup');
			allGroup.label = 'All Teams';
			teams.forEach(t => {
				const opt = document.createElement('option');
				opt.value = t.id;
				opt.textContent = t.name;
				allGroup.appendChild(opt);
			});
			teamDropdown.appendChild(allGroup);
		}
	}

	// Show error message
	function showError(message) {
		// For now, just log to console
		console.error('Error:', message);
		// TODO: Implement proper error display
	}

	// Show loading state
	function showLoading() {
		const rulesContainer = document.getElementById('main-rules');
		if (!rulesContainer) return;

		rulesContainer.innerHTML = `
			<div class="loading">
				Loading rules...
			</div>
		`;
	}

	// Apply a rule
	function applyRule(ruleId) {
		vscode.postMessage({
			command: 'applyRule',
			ruleId: ruleId
		});
	}

	// Preview a rule
	function previewRule(ruleId) {
		vscode.postMessage({
			command: 'previewRule',
			ruleId: ruleId
		});
	}

	// Utility function to escape HTML
	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	// Highlight search terms in text
	function highlightSearchTerm(text, searchTerm) {
		if (!searchTerm || searchTerm.length === 0) {
			return text;
		}
		
		// Create a case-insensitive regex for the search term
		const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
		return text.replace(regex, '<mark class="search-highlight">$1</mark>');
	}

	// Escape special regex characters
	function escapeRegex(string) {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	// Initialize when DOM is loaded
	document.addEventListener('DOMContentLoaded', initializeUI);

})(); 