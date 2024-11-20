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

async function loadFontFile(filepath) {
    try {
        const response = await fetch(filepath);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }
        return await response.arrayBuffer();
    } catch (error) {
        throw new Error(`Failed to load font ${filepath}: ${error.message}`);
    }
}

const { createApp } = Vue;

createApp({
    components: {
        CharacterList
    },

    data() {
        return {
            projectName: '',
            characters: [{
                name: 'Character1',
                fontType: '/fonts/Noto_Sans/NotoSans-Regular.ttf',
                fontHeight: 1,
                strokeWidth: 0,
                fontColor: '#000000',
                strokeColor: '#ffffff'
            }],
            textContent: '',
            textPosition: 'left',
            textAlignment: 'left',
            credits: '',
            creditsPosition: 'br',
            backgroundColor: '#aaaaaa',
            output: '',
            imageName: '',
            imagePreview: null,
            selectedFile: null,
            initialized: false,
            availableFonts: [],
            bgColorPicker: null,
            generatedImage: null
        }
    },

    methods: {
        async handleImageUpload(event) {
            const file = event.target.files[0];
            if (file) {
                this.selectedFile = file;

                this.imageName = file.name
                
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

        async handleFontUpload(file) {
            if (this.initialized && pyodideInstance) {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    const fontPath = `/fonts/custom/${file.name}`;
                    
                    // Create custom fonts directory if it doesn't exist
                    try {
                        pyodideInstance.FS.mkdir('/fonts/custom');
                    } catch (e) {
                        // Directory might already exist
                    }
                    
                    // Write the font file
                    pyodideInstance.FS.writeFile(fontPath, uint8Array);
                    
                    // Add to available fonts
                    const fontName = file.name.replace('.ttf', '').replace('.TTF', '').replace(/([A-Z])/g, ' $1').trim();
                    this.availableFonts.push({
                        name: fontName,
                        path: fontPath
                    });

                    this.output = `Font ${fontName} uploaded successfully!`;
                } catch (error) {
                    this.output = `Error uploading font: ${error.message}`;
                    console.error('Font upload error:', error);
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

        scanFonts() {
            const fonts = [];
            const fontDirs = ['Noto_Sans', 'Noto_Serif', 'Noto_Emoji'];
            
            for (const dir of fontDirs) {
                try {
                    const files = pyodideInstance.FS.readdir(`/fonts/${dir}`);
                    for (const file of files) {
                        if (file.endsWith('.ttf')) {
                            const fontPath = `/fonts/${dir}/${file}`;
                            const fontName = file.replace('.ttf', '')
                                              .replace(/([A-Z])/g, ' $1')
                                              .trim();
                            fonts.push({
                                name: fontName,
                                path: fontPath
                            });
                        }
                    }
                } catch (e) {
                    console.warn(`Could not read directory /fonts/${dir}:`, e);
                }
            }

            // Also scan custom fonts directory if it exists
            try {
                const customFiles = pyodideInstance.FS.readdir('/fonts/custom');
                for (const file of customFiles) {
                    if (file.endsWith('.ttf')) {
                        const fontPath = `/fonts/custom/${file}`;
                        const fontName = file.replace('.ttf', '')
                                           .replace(/([A-Z])/g, ' $1')
                                           .trim();
                        fonts.push({
                            name: fontName,
                            path: fontPath
                        });
                    }
                }
            } catch (e) {
                // Custom fonts directory might not exist yet
            }

            this.availableFonts = fonts;
            
            // Update any characters using fonts that no longer exist
            if (fonts.length > 0) {
                const defaultFont = fonts[0].path;
                this.characters.forEach(char => {
                    if (!fonts.some(f => f.path === char.fontType)) {
                        char.fontType = defaultFont;
                    }
                });
            }
        },

        initializeBackgroundColorPicker() {
            const pickrConfig = {
                theme: 'nano',
                swatches: [
                    '#ffffff', '#000000', '#808080', '#c0c0c0',
                    '#ff0000', '#00ff00', '#0000ff', '#ffff00',
                    '#00ffff', '#ff00ff'
                ],
                components: {
                    preview: true,
                    opacity: true,
                    hue: true,
                    interaction: {
                        hex: true,
                        rgba: true,
                        input: true,
                        save: true
                    }
                }
            };

            this.bgColorPicker = Pickr.create({
                ...pickrConfig,
                el: '#bgColorPicker',
                default: "#aaaaaa"
            });

            this.bgColorPicker.on('save', (color) => {
                if (color) {
                    this.backgroundColor = color.toHEXA().toString();
                }
                this.bgColorPicker.hide();
            });
        },

        downloadGeneratedImage() {
            if (this.generatedImage) {
                const link = document.createElement('a');
                link.href = this.generatedImage;
                link.download = `${this.projectName}_cap.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        },

        async generate() {
            try {
                if (!this.initialized) {
                    throw new Error('Python environment not yet initialized');
                }

                if (!this.selectedFile) {
                    throw new Error('Please upload an image first');
                }

                if (!this.projectName) {
                    throw new Error('Please set the project name')
                }

                // Write text content to file
                pyodideInstance.FS.writeFile('text.txt', this.textContent);

                // Convert characters to font settings
                const fontSettings = [];
                this.characters.forEach(char => {
                    fontSettings.push({
                        name: char.name,
                        color: char.fontColor,
                        font: char.fontType,
                        relative_height: char.fontHeight,
                        stroke_width: char.strokeWidth,
                        stroke_color: char.strokeColor
                    });
                });

                // Add new settings
                const settings = {
                    image: {
                        art: this.imageName,
                        bg_color: this.backgroundColor
                    },
                    text: {
                        text: 'text.txt',
                        text_box_pos: this.textPosition,
                        alignment: this.textAlignment,
                        credits_pos: this.creditsPosition,
                        credits: this.credits.split('\n')
                    },
                    output: {
                        base_filename: this.projectName,
                        output_directory: './',
                        outputs: ['caption']
                    },
                    characters: fontSettings
                };

                console.log(settings)

                // Convert settings to Python dict string and properly escape it
                const settingsStr = JSON.stringify(settings).replace(/"/g, "'");
                const result = await pyodideInstance.runPythonAsync(`
                    processRequest("${settingsStr}")
                `);
                
                this.output = result;

                // After successful generation, read and display the generated image
                if (result.includes('Successfully generated')) {
                    const generatedFileName = `${this.projectName}_cap.png`;
                    try {
                        const imageData = pyodideInstance.FS.readFile(generatedFileName);
                        const blob = new Blob([imageData], { type: 'image/png' });
                        this.generatedImage = URL.createObjectURL(blob);
                        this.output = `<div class="generated-output">
                            <img src="${this.generatedImage}" alt="Generated Caption" style="max-width: 100%; margin-bottom: 10px;">
                            <button onclick="app.downloadGeneratedImage()" class="download-btn">Download Image</button>
                        </div>`;
                    } catch (error) {
                        console.error('Error reading generated image:', error);
                    }
                }
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

                // Load fonts
                this.output = 'Loading fonts...';
                await this.loadFonts();

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
        },

        async loadFonts() {
            // Create fonts directory structure
            try {
                pyodideInstance.FS.mkdir('/fonts');
                pyodideInstance.FS.mkdir('/fonts/Noto_Sans');
                pyodideInstance.FS.mkdir('/fonts/Noto_Serif');
                pyodideInstance.FS.mkdir('/fonts/Noto_Emoji');
            } catch (e) {
                console.log('Font directories may already exist');
            }

            // Define font files to load
            const fontFiles = {
                'Noto_Sans': ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'NotoSans-Italic.ttf', 'NotoSans-BoldItalic.ttf'],
                'Noto_Serif': ['NotoSerif-Regular.ttf', 'NotoSerif-Bold.ttf', 'NotoSerif-Italic.ttf', 'NotoSerif-BoldItalic.ttf'],
                'Noto_Emoji': ['NotoEmoji-Regular.ttf', 'NotoEmoji-Light.ttf', 'NotoEmoji-Medium.ttf', 'NotoEmoji-SemiBold.ttf', 'NotoEmoji-Bold.ttf']
            };

            // Load each font file
            for (const [family, files] of Object.entries(fontFiles)) {
                for (const file of files) {
                    try {
                        const fontData = await loadFontFile(`fonts/${family}/${file}`);
                        const uint8Array = new Uint8Array(fontData);
                        pyodideInstance.FS.writeFile(`/fonts/${family}/${file}`, uint8Array);
                        console.log(`Loaded font: ${family}/${file}`);
                    } catch (error) {
                        console.error(`Failed to load font ${family}/${file}:`, error);
                    }
                }
            }

            // Scan available fonts after loading
            this.scanFonts();
        }
    },

    async mounted() {
        try {
            // Initialize Pyodide
            await this.initializePyodide();
            // Initialize background color picker
            this.initializeBackgroundColorPicker();
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }
}).mount('#app');
