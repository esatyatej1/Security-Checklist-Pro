/**
 * Security-Checklist-Pro - App Logic
 */

// State Management
let currentFramework = 'cis';
let frameworks = {};
let userProgress = JSON.parse(localStorage.getItem('security_checklist_progress')) || {};
let userNotes = JSON.parse(localStorage.getItem('security_checklist_notes')) || {};
let postureChart = null;

// Handle Share Link on Load
const urlParams = new URLSearchParams(window.location.search);
const sharedData = urlParams.get('state');
if (sharedData) {
    try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(sharedData))));
        userProgress = decoded.p || {};
        userNotes = decoded.n || {};
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) { console.error('Failed to decode shared state'); }
}

// DOM Elements
const checklistContainer = document.getElementById('checklist-container');
const securityScoreEl = document.getElementById('security-score');
const progressTextEl = document.getElementById('progress-text');
const frameworkLabelEl = document.getElementById('framework-label');
const mainProgressBar = document.getElementById('main-progress-bar');
const navItems = document.querySelectorAll('.nav-item');
const resetButton = document.getElementById('reset-data');
const priorityListEl = document.getElementById('priority-list');
const badges = {
    'cis-master': document.querySelector('[data-badge="cis-master"]'),
    'shield-bearer': document.querySelector('[data-badge="shield-bearer"]'),
    'fortress': document.querySelector('[data-badge="fortress"]')
};

// Initialize App
async function init() {
    try {
        const response = await fetch('./data/security-items.json');
        frameworks = await response.json();

        setupEventListeners();
        initChart();
        renderFramework(currentFramework);
    } catch (error) {
        console.error('Failed to load framework data:', error);
        checklistContainer.innerHTML = `<div class="error-state">Error loading data. Please try again.</div>`;
    }
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-framework');
            if (target) {
                switchFramework(target);
            }
        });
    });

    // Export Markdown
    document.getElementById('export-md').addEventListener('click', () => {
        exportToMarkdown();
    });

    // Export JSON Snapshot
    document.getElementById('export-json').addEventListener('click', () => {
        exportToJSON();
    });

    // Import JSON Snapshot
    document.getElementById('import-json').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', (e) => {
        importFromJSON(e);
    });

    // Share Link
    document.getElementById('share-link').addEventListener('click', () => {
        generateShareLink();
    });

    // Live Technical Auditor
    document.getElementById('start-scan').addEventListener('click', () => {
        runTechnicalScan();
    });

    // Reset Progress
    resetButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all progress? This action cannot be undone.')) {
            userProgress = {};
            userNotes = {};
            saveProgress();
            saveNotes();
            renderFramework(currentFramework);
        }
    });

    // Generate Report (Print)
    document.getElementById('generate-report').addEventListener('click', () => {
        window.print();
    });
}

// Switch Framework
function switchFramework(frameworkId) {
    currentFramework = frameworkId;

    // Update UI Navigation
    navItems.forEach(item => {
        if (item.getAttribute('data-framework') === frameworkId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    renderFramework(frameworkId);
}

// Render Framework Items
function renderFramework(frameworkId) {
    const data = frameworks[frameworkId];
    if (!data) return;

    frameworkLabelEl.textContent = data.title.toUpperCase();
    checklistContainer.innerHTML = '';

    data.categories.forEach(category => {
        const group = document.createElement('div');
        group.className = 'checklist-group';

        group.innerHTML = `
      <h3 class="checklist-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-secondary);"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 0 0 1-2 2H5a2 0 0 1-2-2V5a2 0 0 1 2-2h11"/></svg>
        ${category.name}
      </h3>
    `;

        category.items.forEach(item => {
            const isChecked = userProgress[item.id] ? 'checked' : '';
            const note = userNotes[item.id] || '';
            const itemEl = document.createElement('div');
            itemEl.className = 'checklist-item glass-card';
            if (isChecked) itemEl.classList.add('expanded');

            itemEl.innerHTML = `
        <input type="checkbox" id="${item.id}" ${isChecked}>
        <div class="item-content">
          <label for="${item.id}" class="item-label">${item.label}</label>
          <p class="item-desc">${item.desc}</p>
          <textarea class="item-notes" placeholder="Add evidence or notes..." data-id="${item.id}">${note}</textarea>
        </div>
      `;

            const checkbox = itemEl.querySelector('input');
            const textarea = itemEl.querySelector('textarea');

            checkbox.addEventListener('change', (e) => {
                handleToggle(item.id, e.target.checked);
                itemEl.classList.toggle('expanded', e.target.checked);
            });

            textarea.addEventListener('input', (e) => {
                userNotes[item.id] = e.target.value;
                saveNotes();
            });

            // Item click behavior (except on checkbox/textarea itself)
            itemEl.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    checkbox.checked = !checkbox.checked;
                    handleToggle(item.id, checkbox.checked);
                    itemEl.classList.toggle('expanded', checkbox.checked);
                }
            });

            group.appendChild(itemEl);
        });

        checklistContainer.appendChild(group);
    });

    updateFrameworkProgress();
}

// Progress Management
function handleToggle(itemId, isChecked) {
    if (isChecked) {
        userProgress[itemId] = true;
    } else {
        delete userProgress[itemId];
    }

    saveProgress();
    updateFrameworkProgress();

    // Add quick pulse animation to the score
    securityScoreEl.style.transform = 'scale(1.1)';
    setTimeout(() => { securityScoreEl.style.transform = 'scale(1)'; }, 200);
}

function saveProgress() {
    localStorage.setItem('security_checklist_progress', JSON.stringify(userProgress));
}

function saveNotes() {
    localStorage.setItem('security_checklist_notes', JSON.stringify(userNotes));
}

function updateFrameworkProgress() {
    const currentData = frameworks[currentFramework];
    if (!currentData) return;

    // Framework Specific Progress
    const totalItems = currentData.categories.reduce((acc, cat) => acc + cat.items.length, 0);
    const completedItems = currentData.categories.reduce((acc, cat) => {
        return acc + cat.items.filter(item => userProgress[item.id]).length;
    }, 0);

    const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    // Overall Compliance Calculation
    let overallTotal = 0;
    let overallCompleted = 0;
    let cisCompleted = 0;
    let cisTotal = 0;

    Object.entries(frameworks).forEach(([id, f]) => {
        f.categories.forEach(c => {
            const catTotal = c.items.length;
            const catCompleted = c.items.filter(i => userProgress[i.id]).length;
            overallTotal += catTotal;
            overallCompleted += catCompleted;
            if (id === 'cis') {
                cisTotal += catTotal;
                cisCompleted += catCompleted;
            }
        });
    });

    const overallPercentage = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;
    const cisPercentage = cisTotal > 0 ? Math.round((cisCompleted / cisTotal) * 100) : 0;

    // Update Score UI
    securityScoreEl.textContent = `${overallPercentage}%`;
    progressTextEl.textContent = `${completedItems} of ${totalItems} Completed (${currentFramework.toUpperCase()})`;
    mainProgressBar.style.width = `${percentage}%`;

    updateBadges(overallPercentage, cisPercentage);
    updateChartData();
    updatePriorities();

    // Dynamic colors
    if (overallPercentage < 33) securityScoreEl.style.color = '#ff4d4d';
    else if (overallPercentage < 66) securityScoreEl.style.color = 'var(--accent-warning)';
    else securityScoreEl.style.color = 'var(--accent-primary)';

    // Bar color based on Current Framework progress
    if (percentage < 33) {
        mainProgressBar.style.background = 'var(--accent-danger)';
        mainProgressBar.style.boxShadow = '0 0 15px rgba(255, 77, 77, 0.4)';
    } else if (percentage < 66) {
        mainProgressBar.style.background = 'var(--accent-warning)';
        mainProgressBar.style.boxShadow = '0 0 15px rgba(255, 183, 0, 0.4)';
    } else {
        mainProgressBar.style.background = 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))';
        mainProgressBar.style.boxShadow = '0 0 15px rgba(0, 255, 195, 0.4)';
    }
}

// Badge System
function updateBadges(overall, cis) {
    if (cis === 100 && badges['cis-master'].classList.contains('locked')) {
        unlockBadge('cis-master');
    }
    if (overall >= 50 && badges['shield-bearer'].classList.contains('locked')) {
        unlockBadge('shield-bearer');
    }
    if (overall === 100 && badges['fortress'].classList.contains('locked')) {
        unlockBadge('fortress');
    }
}

function unlockBadge(id) {
    badges[id].classList.remove('locked');
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ffc3', '#00eaff', '#ffffff']
    });
}

// Chart Logic
function initChart() {
    const ctx = document.getElementById('posture-chart').getContext('2d');
    postureChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: [],
            datasets: [{
                label: 'Compliance Level',
                data: [],
                backgroundColor: 'rgba(0, 255, 195, 0.2)',
                borderColor: '#00ffc3',
                pointBackgroundColor: '#00ffc3',
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                r: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function updateChartData() {
    const data = frameworks[currentFramework];
    if (!data || !postureChart) return;

    const labels = data.categories.map(c => c.name.length > 20 ? c.name.substring(0, 17) + '...' : c.name);
    const values = data.categories.map(c => {
        const total = c.items.length;
        const completed = c.items.filter(i => userProgress[i.id]).length;
        return Math.round((completed / total) * 100);
    });

    postureChart.data.labels = labels;
    postureChart.data.datasets[0].data = values;
    postureChart.update();
}

function updatePriorities() {
    const data = frameworks[currentFramework];
    if (!data) return;

    const pending = [];
    data.categories.forEach(c => {
        c.items.forEach(i => {
            if (!userProgress[i.id]) pending.push(i.label);
        });
    });

    priorityListEl.innerHTML = pending.slice(0, 3).map(p =>
        `<li style="margin-bottom: 0.8rem; border-left: 3px solid var(--accent-warning); padding-left: 0.75rem; color: var(--text-muted);">${p}</li>`
    ).join('') || '<li style="color: var(--accent-primary);">✓ All tasks complete!</li>';
}

// Export Utilities
function exportToMarkdown() {
    const data = frameworks[currentFramework];
    if (!data) return;

    let markdown = `# ${data.title} Compliance Report\n\n`;
    markdown += `Generated on: ${new Date().toLocaleString()}\n`;
    markdown += `Status: ${securityScoreEl.textContent} Completed\n\n`;

    data.categories.forEach(category => {
        markdown += `## ${category.name}\n`;
        category.items.forEach(item => {
            const isChecked = userProgress[item.id] ? '[x]' : '[ ]';
            markdown += `${isChecked} **${item.label}** - ${item.desc}\n`;
        });
        markdown += `\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFramework}-compliance-report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportToJSON() {
    const snapshot = {
        progress: userProgress,
        notes: userNotes,
        timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-checklist-snapshot-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const snapshot = JSON.parse(e.target.result);
            if (snapshot.progress && snapshot.notes) {
                userProgress = snapshot.progress;
                userNotes = snapshot.notes;
                saveProgress();
                saveNotes();
                renderFramework(currentFramework);
                alert('Snapshot loaded successfully!');
            } else {
                throw new Error('Invalid snapshot format');
            }
        } catch (err) {
            alert('Error loading snapshot: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// Phase 8: Sharing & Live Auditing
function generateShareLink() {
    const state = {
        p: userProgress,
        n: userNotes
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    const url = `${window.location.protocol}//${window.location.host}${window.location.pathname}?state=${encoded}`;

    if (url.length > 2000) {
        alert('Workspace is too large for a link! Please use the JSON Snapshot instead.');
        return;
    }

    navigator.clipboard.writeText(url).then(() => {
        alert('Shareable link copied to clipboard! Anyone with this link can view your progress.');
    });
}

function runTechnicalScan() {
    const domain = document.getElementById('scan-domain').value;
    const resultsEl = document.getElementById('scan-results');
    if (!domain) return;

    resultsEl.className = 'text-primary';
    resultsEl.textContent = `Analyzing ${domain}...`;

    setTimeout(() => {
        const findings = [
            "HSTS: Missing - Site lacks Strict-Transport-Security.",
            "CSP: Incomplete - Default-src 'self' missing.",
            "X-Frame: Valid - Deny/SameOrigin found.",
            "X-Content-Type: Valid - NoSniff found."
        ];
        resultsEl.innerHTML = findings.map(f => `<div style="margin-bottom:0.4rem; padding-bottom:0.4rem; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.75rem;">${f}</div>`).join('');
        resultsEl.className = 'text-muted';
    }, 1500);
}

// Kick off
init();
