// Localization system
class Localization {
    constructor() {
        this.translations = {
            blueprintNames: {},
            blueprintTypes: {},
            engineerNames: {}
        };
        this.currentLanguage = 'en';
        this.availableLanguages = ['en', 'de', 'es', 'fr', 'pt', 'ru', 'zh', 'ka'];
        this.loadingPromises = [];
    }

    // Initialize the localization system
    async init() {
        try {
            // Load all translation files in parallel
            this.loadingPromises = [
                this.loadTranslationFile('blueprint.name', 'blueprintNames'),
                this.loadTranslationFile('type.names', 'blueprintTypes'),
                this.loadTranslationFile('names', 'engineerNames')
            ];
            
            await Promise.all(this.loadingPromises);
            
            // Set up language change handler
            const languageSelect = document.getElementById('language');
            if (languageSelect) {
                languageSelect.value = localStorage.getItem('preferredLanguage') || 'en';
                languageSelect.addEventListener('change', (e) => {
                    this.setLanguage(e.target.value);
                    localStorage.setItem('preferredLanguage', e.target.value);
                    window.dispatchEvent(new Event('languageChanged'));
                });
            }
            
            return true;
        } catch (error) {
            console.error('Failed to initialize localization:', error);
            return false;
        }
    }

    // Load a translation file
    async loadTranslationFile(fileName, target) {
        try {
            const response = await fetch(`locale/${fileName}.csv`);
            if (!response.ok) throw new Error(`Failed to load ${fileName}`);
            
            const csvText = await response.text();
            this.parseCSV(csvText, target);
        } catch (error) {
            console.error(`Error loading ${fileName}:`, error);
            throw error;
        }
    }

    // Parse CSV data into the translations object
    parseCSV(csvText, target) {
        const lines = csvText.split('\n');
        if (lines.length < 2) return;

        // Parse header to get language indices
        const headers = this.parseCSVLine(lines[0]);
        const langIndices = {};
        
        // Find the fallback column (the one without a language header)
        let fallbackIndex = -1;
        headers.forEach((header, index) => {
            if (header.trim() === '') {
                fallbackIndex = index;
            } else if (this.availableLanguages.includes(header)) {
                langIndices[header] = index;
            }
        });

        // Process each line
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = this.parseCSVLine(line);
            if (values.length < 2) continue;

            const key = values[0];
            this.translations[target][key] = {};

            // Store the fallback value (from the column without a language header)
            if (fallbackIndex !== -1 && values[fallbackIndex]) {
                this.translations[target][key]._fallback = values[fallbackIndex];
            }

            // Store translations for each language
            Object.entries(langIndices).forEach(([lang, index]) => {
                if (values[index]) {
                    this.translations[target][key][lang] = values[index];
                }
            });
        }
    }

    // Helper to parse a CSV line (handling quoted fields)
    parseCSVLine(line) {
        const values = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        
        values.push(currentValue);
        return values;
    }

    // Set the current language
    setLanguage(lang) {
        if (this.availableLanguages.includes(lang)) {
            this.currentLanguage = lang;
            return true;
        }
        return false;
    }

    // Get a translated string
    translate(key, fallback = '') {
        if (!key) return fallback;
        
        for (const category of Object.values(this.translations)) {
            const translations = category[key];
            if (!translations) continue;
            
            // First try the current language
            if (translations[this.currentLanguage]) {
                return translations[this.currentLanguage];
            }
            // Then try the fallback value from the CSV (stored in _fallback)
            if (translations._fallback) {
                return translations._fallback;
            }
            
            // Then try any other available language as a last resort
            const availableTranslation = Object.entries(translations).find(([lang]) => 
                lang !== '_fallback' && translations[lang]
            )?.[1];
            
            if (availableTranslation) {
                return availableTranslation;
            }
        }
        
        // Finally, use the provided fallback or the key itself
        return fallback || key;
    }

    // Get all translations for a key (for debugging)
    getAllTranslations(key) {
        for (const [categoryName, category] of Object.entries(this.translations)) {
            if (category[key]) {
                return category[key];
            }
        }
        return null;
    }
}

// Create and export a singleton instance
const i18n = new Localization();
export default i18n;
