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
        async exportProject() {
            try {
                if (!this.selectedFile || !this.projectName) {
                    throw new Error('Please ensure you have an image uploaded and project name set');
                }

                const zip = new JSZip();

                // Add image file
                zip.file(`image/${this.imageName}`, this.selectedFile);

                // Add text content
                zip.file('text.txt', this.textContent);

                // Add settings
                const settings = {
                    projectName: this.projectName,
                    image: {
                        art: this.imageName,
                        bg_color: this.backgroundColor
                    },
                    text: {
                        text_box_pos: this.textPosition,
                        alignment: this.textAlignment,
                        credits_pos: this.creditsPosition,
                        credits: this.credits.split('\n')
                    },
                    characters: this.characters
                };
                zip.file('settings.json', JSON.stringify(settings, null, 2));

                // Add custom fonts
                const customFonts = this.availableFonts.filter(font => 
                    font.path.startsWith('/fonts/custom/')
                );
                if (customFonts.length > 0) {
                    const fontsFolder = zip.folder('fonts');
                    for (const font of customFonts) {
                        try {
                            const fontData = pyodideInstance.FS.readFile(font.path);
                            const fontName = font.path.split('/').pop();
                            fontsFolder.file(fontName, fontData);
                        } catch (error) {
                            console.error(`Failed to add font ${font.path}:`, error);
                        }
                    }
                }

                // Generate and download zip
                const blob = await zip.generateAsync({type: 'blob'});
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${this.projectName}_project.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.output = 'Project exported successfully!';
            } catch (error) {
                this.output = `Export error: ${error.message}`;
                console.error('Export error:', error);
            }
        },

async importProject(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;

        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        
        // Load settings
        const settingsFile = contents.file('settings.json');
        if (!settingsFile) {
            throw new Error('Invalid project file: settings.json not found');
        }
        const settingsJson = await settingsFile.async('string');
        const settings = JSON.parse(settingsJson);
        
        // Restore project name
        this.projectName = settings.projectName;
        
        // Find the actual image file (not the directory)
        const imageFile = Object.values(contents.files).find(f => 
            f.name.startsWith('image/') && !f.dir && f.name !== 'image/'
        );
        
        if (imageFile) {
            const imageBlob = await imageFile.async('blob');
            const fileName = imageFile.name.split('/').pop();
            
            if (!fileName) {
                throw new Error('Invalid image file name in project');
            }
            
            // Create a proper File object with the correct type
            const file = new File([imageBlob], fileName, {
                type: imageBlob.type || this.getImageMimeType(fileName)
            });
            
            // Set the file directly
            this.selectedFile = file;
            this.imageName = fileName;
            
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
                pyodideInstance.FS.writeFile(fileName, uint8Array);
            }
        } else {
            throw new Error('No image file found in project');
        }
        
        // Restore text content
        const textFile = contents.file('text.txt');
        if (textFile) {
            this.textContent = await textFile.async('string');
        }
        
        // Restore text settings
        this.textPosition = settings.text.text_box_pos;
        this.textAlignment = settings.text.alignment;
        this.creditsPosition = settings.text.credits_pos;
        this.credits = settings.text.credits.join('\n');
        
        // Restore background color
        this.backgroundColor = settings.image.bg_color;
        this.bgColorPicker.setColor(settings.image.bg_color);
        
        // Debug logging for fonts
        console.log('All zip contents:', Object.keys(contents.files));
        
        // Import custom fonts
        const fontFiles = Object.keys(contents.files).filter(path => 
            path.startsWith('fonts/') && !path.endsWith('/') && path !== 'fonts/'
        );
        
        console.log('Found font files:', fontFiles);
        
        if (fontFiles.length > 0) {
            for (const fontPath of fontFiles) {
                const fontFile = contents.file(fontPath);
                console.log('Processing font file:', fontPath, 'exists:', !!fontFile);
                
                if (fontFile) {
                    try {
                        const fontData = await fontFile.async('arraybuffer');
                        const fileName = fontPath.split('/').pop();
                        const fontFileObj = new File([fontData], fileName, {
                            type: 'font/ttf'
                        });
                        await this.handleFontUpload(fontFileObj);
                    } catch (error) {
                        console.error(`Error processing font ${fontPath}:`, error);
                    }
                }
            }
        }
        
        // Restore characters
        this.characters = settings.characters;
        
        this.output = 'Project imported successfully!';
    } catch (error) {
        this.output = `Import error: ${error.message}`;
        console.error('Import error:', error);
    }
        },

        getImageMimeType(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'bmp': 'image/bmp'
            };
            return mimeTypes[ext] || 'image/jpeg';
        },

        async handleImageUpload(event) {
            const file = event.target.files[0];
            console.log(file)
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
                
                console.log('---- Result: ' + result)
                // After successful generation, read and display the generated image
                if (result.includes('Success')) {
                    const generatedFileName = `${this.projectName}_cap.png`;
                    try {
                        const imageData = pyodideInstance.FS.readFile(generatedFileName);
                        const blob = new Blob([imageData], { type: 'image/png' });
                        this.generatedImage = URL.createObjectURL(blob);
                        this.output = `<div class="generated-output">
                            <img src="${this.generatedImage}" alt="Generated Caption" class="col-8 align-self-center">
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
