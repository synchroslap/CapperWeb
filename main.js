import CharacterList from './components/CharacterList.js';

let pyodideInstance = null;

async function loadPythonFile(filepath) {
    try {
        const response = await fetch(filepath);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        throw new Error(`Failed to load ${filepath}: ${error.message}`);
    }
}

const { createApp } = Vue;

createApp({
    components: {
        CharacterList
    },

    data() {
        return {
            characters: [{
                name: 'Character 1',
                fontType: 'Noto Sans',
                fontHeight: 1,
                strokeWidth: 0,
                fontColor: '#000000',
                strokeColor: '#ffffff'
            }],
            textContent: '',
            output: '',
            imagePreview: null,
            selectedFile: null,
            initialized: false
        }
    },

    methods: {
        async handleImageUpload(event) {
            const file = event.target.files[0];
            if (file) {
                this.selectedFile = file;
                
                // Create image preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.imagePreview = e.target.result;
                };
                reader.readAsDataURL(file);

                // Add to Pyodide filesystem if initialized
                if (this.initialized && pyodideInstance) {
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    pyodideInstance.FS.writeFile(file.name, uint8Array);
                }
            }
        },

        insertCharacterTag(name) {
            const tag = `[${name}]`;
            const textarea = document.querySelector('textarea');
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            
            this.textContent = this.textContent.substring(0, start) + 
                             tag + 
                             this.textContent.substring(end);
            
            this.$nextTick(() => {
                textarea.selectionStart = textarea.selectionEnd = start + tag.length;
                textarea.focus();
            });
        },

        async generate() {
            try {
                if (!this.initialized) {
                    throw new Error('Python environment not yet initialized');
                }

                if (!this.selectedFile) {
                    throw new Error('Please upload an image first');
                }

                // Write text content to file
                pyodideInstance.FS.writeFile('input.txt', this.textContent);

                // Convert characters to font settings
                const fontSettings = {};
                this.characters.forEach(char => {
                    fontSettings[char.name] = {
                        font_type: char.fontType,
                        font_height: parseFloat(char.fontHeight),
                        font_color: char.fontColor,
                        stroke_width: parseFloat(char.strokeWidth),
                        stroke_color: char.strokeColor
                    };
                });

                // Convert font settings to Python dict string
                const fontSettingsStr = JSON.stringify(fontSettings).replace(/"/g, "'");

                // Call processRequest with the image file and font settings
                const result = await pyodideInstance.runPythonAsync(`
                    processRequest("${this.selectedFile.name}", font_settings=${fontSettingsStr})
                `);
                
                this.output = result;
            } catch (error) {
                this.output = `Error: ${error.message}`;
                console.error('Processing error:', error);
            }
        },

        async initializePyodide() {
            try {
                this.output = 'Loading Pyodide...';
                pyodideInstance = await loadPyodide();
                
                this.output = 'Installing Python packages...';
                await pyodideInstance.loadPackage('micropip');
                await pyodideInstance.runPythonAsync(`
                    import micropip
                    await micropip.install([
                        'colorama',
                        'Pillow',
                        'termcolor',
                        'toml'
                    ])
                `);

                // Load Python files
                this.output = 'Loading Python source files...';
                const pythonFiles = {
                    'text.py': './capper/text.py',
                    'spec_parse.py': './capper/spec_parse.py',
                    'pretty_logging.py': './capper/pretty_logging.py',
                    'caption.py': './capper/caption.py'
                };

                try {
                    // Create capper directory in virtual filesystem
                    pyodideInstance.FS.mkdir('capper');
                } catch (e) {
                    // Directory might already exist
                    console.log('Capper directory already exists');
                }

                // Load and write each file
                for (const [filename, filepath] of Object.entries(pythonFiles)) {
                    try {
                        const content = await loadPythonFile(filepath);
                        pyodideInstance.FS.writeFile(`capper/${filename}`, content);
                    } catch (error) {
                        console.error(`Failed to load ${filename}:`, error);
                        this.output = `Failed to load ${filename}: ${error.message}`;
                        throw error;
                    }
                }
                
                this.output = 'Initializing Python environment...';
                await pyodideInstance.runPythonAsync(`
                    import sys
                    sys.path.append('capper')
                    from caption import processRequest
                `);

                this.initialized = true;
                this.output = 'Environment ready!';
            } catch (error) {
                const errorMsg = `Failed to initialize Python: ${error.message}`;
                this.output = errorMsg;
                console.error(errorMsg, error);
                throw error;
            }
        }
    },

    async mounted() {
        try {
            // Initialize Pyodide
            await this.initializePyodide();
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }
}).mount('#app');
