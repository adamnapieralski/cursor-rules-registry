// Main JavaScript for Cursor Rules Registry WebView

(function() {
	'use strict';

	// Get the VS Code API
	const vscode = acquireVsCodeApi();

	// DOM elements
	const tabButtons = document.querySelectorAll('.tab-button');
	const tabContents = document.querySelectorAll('.tab-content');
	const searchInput = document.getElementById('search-input');
	const teamDropdown = document.getElementById('team-dropdown');

	// Initialize the UI
	function initializeUI() {
		// Set up tab switching
		tabButtons.forEach(button => {
			button.addEventListener('click', () => {
				const tabName = button.getAttribute('data-tab');
				switchTab(tabName);
			});
		});

		// Set up search functionality
		if (searchInput) {
			searchInput.addEventListener('input', handleSearch);
		}

		// Set up team dropdown
		if (teamDropdown) {
			teamDropdown.addEventListener('change', handleTeamChange);
		}

		// Load initial data
		loadInitialData();
	}

	// Switch between tabs
	function switchTab(tabName) {
		// Update tab buttons
		tabButtons.forEach(button => {
			button.classList.remove('active');
			if (button.getAttribute('data-tab') === tabName) {
				button.classList.add('active');
			}
		});

		// Update tab contents
		tabContents.forEach(content => {
			content.classList.remove('active');
			if (content.id === tabName) {
				content.classList.add('active');
			}
		});

		// Load data for the selected tab
		loadTabData(tabName);
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

	// Handle team dropdown change
	function handleTeamChange(event) {
		const selectedTeam = event.target.value;
		
		// Send team selection message to extension
		vscode.postMessage({
			command: 'selectTeam',
			team: selectedTeam
		});
	}

	// Load initial data
	function loadInitialData() {
		// Request initial data from extension
		vscode.postMessage({
			command: 'loadData'
		});
	}

	// Load data for specific tab
	function loadTabData(tabName) {
		vscode.postMessage({
			command: 'loadTabData',
			tab: tabName
		});
	}

	// Handle messages from the extension
	window.addEventListener('message', event => {
		const message = event.data;

		switch (message.command) {
			case 'updateRules':
				updateRulesList(message.tab, message.rules);
				break;
			case 'updateTeams':
				updateTeamDropdown(message.teams);
				break;
			case 'showError':
				showError(message.text);
				break;
			case 'showLoading':
				showLoading(message.tab);
				break;
		}
	});

	// Update rules list for a specific tab
	function updateRulesList(tabName, rules) {
		const rulesContainer = document.getElementById(`${tabName}-rules`);
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

		const rulesHTML = rules.map(rule => `
			<div class="rule-item" data-rule-id="${rule.id}">
				<div class="rule-title">${escapeHtml(rule.title)}</div>
				<div class="rule-description">${escapeHtml(rule.description || '')}</div>
				<div class="rule-meta">
					${rule.author ? `By ${escapeHtml(rule.author)} • ` : ''}
					${rule.lastUpdated ? `Updated ${escapeHtml(rule.lastUpdated)}` : ''}
				</div>
				${rule.preview ? `<div class="rule-preview">${escapeHtml(rule.preview)}</div>` : ''}
				<div class="rule-actions">
					<button class="btn" onclick="applyRule('${rule.id}')">Apply</button>
					<button class="btn btn-secondary" onclick="previewRule('${rule.id}')">Preview</button>
				</div>
			</div>
		`).join('');

		rulesContainer.innerHTML = rulesHTML;
	}

	// Update team dropdown
	function updateTeamDropdown(teams) {
		if (!teamDropdown) return;

		// Clear existing options except the first one
		while (teamDropdown.children.length > 1) {
			teamDropdown.removeChild(teamDropdown.lastChild);
		}

		// Add team options
		teams.forEach(team => {
			const option = document.createElement('option');
			option.value = team.id;
			option.textContent = team.name;
			teamDropdown.appendChild(option);
		});
	}

	// Show error message
	function showError(message) {
		// For now, just log to console
		console.error('Error:', message);
		// TODO: Implement proper error display
	}

	// Show loading state
	function showLoading(tabName) {
		const rulesContainer = document.getElementById(`${tabName}-rules`);
		if (!rulesContainer) return;

		rulesContainer.innerHTML = `
			<div class="loading">
				Loading rules...
			</div>
		`;
	}

	// Apply a rule
	window.applyRule = function(ruleId) {
		vscode.postMessage({
			command: 'applyRule',
			ruleId: ruleId
		});
	};

	// Preview a rule
	window.previewRule = function(ruleId) {
		vscode.postMessage({
			command: 'previewRule',
			ruleId: ruleId
		});
	};

	// Utility function to escape HTML
	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	// Initialize when DOM is loaded
	document.addEventListener('DOMContentLoaded', initializeUI);

})(); 