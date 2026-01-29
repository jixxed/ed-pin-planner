import i18n from './localization.js';

// Configuration
const CONFIG = {
    // Default empty state
    selectedBlueprints: {},
    // Default language
    language: 'en'
};

// DOM Elements
let tableContainer;
let copyLinkBtn;
let resetBtn;

// Data storage
let engineers = [];
let blueprints = [];
let engineerData = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    tableContainer = document.getElementById('tableContainer');
    copyLinkBtn = document.getElementById('copyLink');
    resetBtn = document.getElementById('reset');

    // Set loading state
    tableContainer.innerHTML = '<div class="loading">Loading translations...</div>';

    try {
        // Initialize localization first
        await i18n.init();
        
        // Set initial language from localStorage or default
        const savedLanguage = localStorage.getItem('preferredLanguage') || 'en';
        i18n.setLanguage(savedLanguage);
        document.getElementById('language').value = savedLanguage;
        
        // Load data and render table
        await loadData();
        const hasLoadedFromUrl = loadStateFromUrl();
        renderTable();
        setupEventListeners();
        
        // Listen for language changes
        window.addEventListener('languageChanged', () => {
            renderTable();
        });
        // If we didn't load from URL, try to load from localStorage
        
        
    } catch (error) {
        console.error('Error initializing application:', error);
        tableContainer.innerHTML = `<div class="error">Error loading data: ${error.message}</div>`;
    }
});

// Load engineer and blueprint data
async function loadData() {
    try {
        const response = await fetch('possible.csv');
        if (!response.ok) throw new Error('Failed to load data');
        
        const csvData = await response.text();
        if (!csvData) {
            throw new Error('Empty CSV data received');
        }
        parseCSVData(csvData);
    } catch (error) {
        console.warn('Using sample data due to error:', error);
        // Provide sample data
        engineerData = {
            'Engineer 1': {
                id: 'engineer_1',
                name: 'Engineer 1',
                blueprints: {
                    'Blueprint 1 - Type A': 1,
                    'Blueprint 2 - Type B': 2
                }
            },
            'Engineer 2': {
                id: 'engineer_2',
                name: 'Engineer 2',
                blueprints: {
                    'Blueprint 1 - Type A': 3,
                    'Blueprint 3 - Type C': 1
                }
            }
        };
        
        // Update engineers and blueprints
        engineers = Object.values(engineerData).map(eng => ({
            id: eng.id,
            name: eng.name
        })).sort((a, b) => a.name.localeCompare(b.name));
        
        // Get all unique blueprints
        const blueprintSet = new Set();
        Object.values(engineerData).forEach(eng => {
            Object.keys(eng.blueprints).forEach(bp => blueprintSet.add(bp));
        });
        blueprints = Array.from(blueprintSet).sort();
    }
}

// Parse CSV data into structured format
function parseCSVData(csvText) {
    // Reset data structures
    engineerData = {};
    const blueprintSet = new Set();
    const seenEngineers = new Set();
    
    // Split CSV into lines and process each line
    const lines = csvText.split('\n');
    
    // Skip header row and process each line
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Split by comma, handling quoted fields
        const [engineer, blueprintName, blueprintType, maxGrade] = line
            .match(/(?:"([^"]*)"|([^,"]*))(?:,|$)/g)
            .map(field => field.replace(/^\s*"|"\s*$|,$/g, '').trim())
            .filter(field => field !== '');
        
        if (!engineer || !blueprintName) {
            console.warn('Skipping row - missing engineer or blueprint name:', {engineer, blueprintName, blueprintType, maxGrade});
            continue;
        }
        
        const blueprintKey = `${blueprintName} - ${blueprintType}`;
        
        // Add to engineer data
        if (!engineerData[engineer]) {
            const engineerKey = engineer.toLowerCase().replace(/[^a-z0-9]/g, '_');
            engineerData[engineer] = {
                id: engineerKey,
                name: engineer, // We'll localize this later
                blueprints: {}
            };
        }
        
        // Add to blueprints set
        blueprintSet.add(blueprintKey);
        
        // Add to engineer's blueprints
        const grade = parseInt(maxGrade) || 1;
        engineerData[engineer].blueprints[blueprintKey] = grade;
        
        // Track unique blueprints
        blueprintSet.add(blueprintKey);
        seenEngineers.add(engineer);
    }
    
    // Update engineers array
    engineers = Object.entries(engineerData).map(([name, data]) => ({
        id: data.id,
        name: name
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    // Update blueprints array
    blueprints = Array.from(blueprintSet).sort();
    
    // Debug: Log the parsed data
    // console.log('Parsed engineers:', engineers);
    // console.log('Parsed blueprints:', blueprints);
    // console.log('Engineer data:', engineerData);
}

// Helper function to format engineer names
function formatEngineerName(engineerId) {
    return engineerId
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// Load state from URL parameters
function loadStateFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    let configParam = urlParams.get('config');
    
    if (configParam) {
        try {
            // URL-decode the parameter first
            configParam = decodeURIComponent(configParam);
            
            // Replace URL-safe characters back to base64
            configParam = configParam.replace(/-/g, '+').replace(/_/g, '/');
            
            // Add padding if needed
            const pad = configParam.length % 4;
            if (pad) {
                if (pad === 1) {
                    throw new Error('Invalid base64 string');
                }
                configParam += '='.repeat(4 - pad);
            }
            
            // Decode base64 to binary string
            const binaryString = atob(configParam);
            
            // Rest of the function remains the same...
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const decompressed = pako.inflate(bytes, { to: 'string' });
            const loadedConfig = JSON.parse(decompressed);
            CONFIG.selectedBlueprints = {};
            
            Object.entries(loadedConfig).forEach(([engineerId, data]) => {
                CONFIG.selectedBlueprints[engineerId.toLowerCase()] = {
                    name: data.name,
                    type: data.type
                };
            });
            
            return true;
        } catch (error) {
            console.error('Error parsing URL config:', error);
        }
    }
    return false;
}

// Generate URL with current configuration
function generateConfigUrl() {
    try {
        // Convert to JSON string and compress with zlib
        const config = {};
        Object.entries(CONFIG.selectedBlueprints).forEach(([engineerId, data]) => {
            config[engineerId.toUpperCase()] = {
                name: data.name,
                type: data.type
            };
        });
        
        
        const jsonString = JSON.stringify(config);
        const encoder = new TextEncoder();
        const inputBytes = encoder.encode(jsonString);
        const compressed = pako.deflate(inputBytes);
        
        // URL-safe base64 encoding
        const base64 = btoa(String.fromCharCode(...compressed))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        
        // Create URL with config
        const url = new URL(window.location.href);
        url.searchParams.set('config', base64);
        return url.toString();
    } catch (error) {
        console.error('Error generating config URL:', error);
        return window.location.href;
    }
}

// Generate EDOMH URL
function generateEdomhUrl() {
    try {
        // Create a simplified version of the configuration
        const config = {};
        Object.entries(CONFIG.selectedBlueprints).forEach(([engineerId, data]) => {
            config[engineerId.toUpperCase()] = {
                name: data.name,
                type: data.type
            };
        });
        
        
        const jsonString = JSON.stringify(config);
        const encoder = new TextEncoder();
        const inputBytes = encoder.encode(jsonString);
        const compressed = pako.deflate(inputBytes);
        
        // URL-safe base64 encoding
        const base64 = btoa(String.fromCharCode(...compressed)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        console.log(base64);
        return `edomh://pinconfig/?${base64}`;
    } catch (error) {
        console.error('Error generating EDOMH URL:', error);
        return '#';
    }
}

// Set up event listeners
function setupEventListeners() {
    // Handle language change
    document.getElementById('language').addEventListener('change', (e) => {
        const newLang = e.target.value;
        i18n.setLanguage(newLang);
        localStorage.setItem('preferredLanguage', newLang);
        renderTable();  // Re-render with new language
    });

    // Open EDOMH link
    copyLinkBtn.addEventListener('click', () => {
        const url = generateEdomhUrl();
        window.open(url, '_blank');
    });

    // Reset selections
    resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all selections?')) {
            CONFIG.selectedBlueprints = {};
            renderTable();
            updateUrl();
        }
    });
}

// Update URL with current configuration
function updateUrl() {
    const url = generateConfigUrl();
    window.history.pushState({}, '', url);
}

// Handle blueprint selection
function handleBlueprintSelect(engineerId, blueprintName, grade, checkbox) {
    const [name, type] = blueprintName.split(' - ');
    const blueprintKey = `${name} - ${type}`;
    
    // If already selected, deselect it
    if (checkbox.checked) {
        // Deselect any other blueprint for this engineer first
        Object.keys(CONFIG.selectedBlueprints).forEach(id => {
            if (id === engineerId) {
                delete CONFIG.selectedBlueprints[id];
            }
        });
        CONFIG.selectedBlueprints[engineerId] = { name, type };
    } else {
        // Only deselect if it's the currently selected blueprint
        const selected = CONFIG.selectedBlueprints[engineerId];
        if (selected && selected.name === name && selected.type === type) {
            delete CONFIG.selectedBlueprints[engineerId];
        }
    }
    
    // Update UI and URL
    updateUrl();
    renderTable();
}

// Localize engineer names
function localizeEngineerName(engineerId) {
    // The engineerId might already be in the format we need (from the CSV)
    if (engineerId.startsWith('engineer.name.')) {
        return i18n.translate(engineerId, engineerId.replace('engineer.name.', '').replace(/_/g, ' '));
    }
    
    // Otherwise, try to convert the engineer name to the expected format
    const nameKey = engineerId.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const engineerKey = `engineer.name.${nameKey}`;
    const result = i18n.translate(engineerKey, engineerId);
    return result;
}

// Localize blueprint name and type
function localizeBlueprint(blueprint) {
    const [name, type] = blueprint.split(' - ');
    if (!name || !type) return blueprint;
    
    const nameKey = `blueprint.horizons.name.${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const typeKey = `blueprint.horizons.type.${type.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    const localizedName = i18n.translate(nameKey, name);
    const localizedType = i18n.translate(typeKey, type);
    
    return `${localizedName} - ${localizedType}`;
}

// Render the main table
function renderTable() {
    // console.log('Rendering table...');
    // console.log('Engineers:', engineers);
    // console.log('Blueprints:', blueprints);
    
    if (engineers.length === 0 || blueprints.length === 0) {
        const errorMsg = engineers.length === 0 ? 'No engineers loaded' : 'No blueprints loaded';
        console.error('Cannot render table:', errorMsg);
        tableContainer.innerHTML = `<div class="error">${errorMsg}</div>`;
        return;
    }

    // Create table element
    const table = document.createElement('table');
    
    // Create header row with engineer names
    const thead = document.createElement('thead');
    thead.className = 'table-header';
    const headerRow = document.createElement('tr');
    
    // Add empty cell for blueprint names column
    const emptyHeader = document.createElement('th');
    emptyHeader.textContent = '';
    emptyHeader.className = 'blueprint-cell';
    headerRow.appendChild(emptyHeader);
    
    // Add engineer headers
    engineers.forEach(engineer => {
        const th = document.createElement('th');
        th.className = 'engineer-cell';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'engineer-name';
        nameDiv.textContent = localizeEngineerName(engineer.name);
        
        th.appendChild(nameDiv);
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body with blueprints
    const tbody = document.createElement('tbody');
    
    blueprints.forEach(blueprint => {
        const row = document.createElement('tr');
        
        // Add blueprint name
        const blueprintCell = document.createElement('td');
        blueprintCell.textContent = localizeBlueprint(blueprint);
        blueprintCell.className = 'blueprint-cell';
        blueprintCell.setAttribute('data-original', blueprint); // Store original for reference
        row.appendChild(blueprintCell);
        
        // First pass: collect all grades for this blueprint to find the maximum
        const grades = [];
        engineers.forEach(engineer => {
            const engineerName = engineer.name;
            const grade = engineerData[engineerName]?.blueprints[blueprint];
            if (grade) {
                grades.push(grade);
            }
        });
        const maxGrade = grades.length > 0 ? Math.max(...grades) : null;
        
        // Add cells for each engineer
        engineers.forEach(engineer => {
            const cell = document.createElement('td');
            const engineerName = engineer.name; // Get the engineer's name
            const grade = engineerData[engineerName]?.blueprints[blueprint];
            // console.log(`Engineer: ${engineerName}, Blueprint: ${blueprint}, Grade:`, grade);
            
            if (grade) {
                const [blueprintName, blueprintType] = blueprint.split(' - ');
                const selected = CONFIG.selectedBlueprints[engineer.id];
                const isSelected = selected?.name === blueprintName && selected?.type === blueprintType;
                // console.log(`Checkbox state - Engineer ID: ${engineer.id}, Blueprint: ${blueprintName}, Selected: ${isSelected}`);
                
                const container = document.createElement('div');
                container.className = 'checkbox-container';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = isSelected;
                
                // Disable if another blueprint is already selected for this engineer
                const hasOtherSelection = engineer.id in CONFIG.selectedBlueprints && 
                                       !(CONFIG.selectedBlueprints[engineer.id].name === blueprintName && 
                                         CONFIG.selectedBlueprints[engineer.id].type === blueprintType);
                
                checkbox.disabled = hasOtherSelection && !isSelected;
                // console.log(`Checkbox disabled state - Engineer ID: ${engineer.id}, Has other selection: ${hasOtherSelection}, Disabled: ${checkbox.disabled}`);
                
                checkbox.addEventListener('change', () => {
                    handleBlueprintSelect(engineer.id, blueprint, grade, checkbox);
                });
                
                const gradeSpan = document.createElement('span');
                gradeSpan.className = 'grade';
                gradeSpan.textContent = `G${grade}`;
                
                // Color the maximum grade with #89D07F
                if (grade === maxGrade) {
                    gradeSpan.classList.add('grade-max');
                }
                
                container.appendChild(checkbox);
                container.appendChild(gradeSpan);
                cell.appendChild(container);
                // console.log('Added checkbox container to cell:', {engineer: engineerName, blueprint, grade});
            } else {
                // console.log('No grade for:', {engineer: engineer.name, blueprint});
            }
            
            row.appendChild(cell);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);

    setupHoverHighlight(table);
    
    // Clear and update container
    tableContainer.innerHTML = '';
    if (table.rows.length <= 1) { // Only header row
        console.error('No data rows were added to the table');
        tableContainer.innerHTML = '<div class="error">No data rows available. Check console for details.</div>';
        // console.log('Engineer data structure:', engineerData);
    } else {
        tableContainer.appendChild(table);
        // console.log('Table rendered with', table.rows.length, 'rows');
    }
}

function clearHighlights(table) {
    table.querySelectorAll('.highlight-row, .highlight-col').forEach(cell => {
        cell.classList.remove('highlight-row', 'highlight-col');
    });
}

function highlightRowAndColumn(table, rowIndex, colIndex) {
    const rows = Array.from(table.querySelectorAll('tr'));

    rows.forEach((row, rIdx) => {
        const cells = Array.from(row.children);

        cells.forEach((cell, cIdx) => {
            if (rIdx === rowIndex) {
                cell.classList.add('highlight-row');
            }
            if (cIdx === colIndex) {
                cell.classList.add('highlight-col');
            }
        });
    });
}

function setupHoverHighlight(table) {
    const rows = Array.from(table.querySelectorAll('tr'));

    rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.children);

        cells.forEach((cell, colIndex) => {
            cell.addEventListener('mouseenter', () => {
                clearHighlights(table);
                highlightRowAndColumn(table, rowIndex, colIndex);
            });

            cell.addEventListener('mouseleave', () => {
                clearHighlights(table);
            });
        });
    });
}
