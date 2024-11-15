// main.js
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

async function initializeApp() {
    const outputDiv = document.getElementById('output');
    try {
        outputDiv.textContent = 'Loading Pyodide...';
        pyodideInstance = await loadPyodide();
        
        // Install required packages
        outputDiv.textContent = 'Installing Python packages...';
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
        
        // Load Python files from capper directory
        outputDiv.textContent = 'Loading Python source files...';
        const pythonFiles = {
            'text.py': 'capper/text.py',
            'spec_parse.py': 'capper/spec_parse.py',
            'pretty_logging.py': 'capper/pretty_logging.py',
            'caption.py': 'capper/caption.py'
        };

        // Create capper directory in virtual filesystem
        pyodideInstance.FS.mkdir('capper');

        // Load and write each file
        for (const [filename, filepath] of Object.entries(pythonFiles)) {
            try {
                const content = await loadPythonFile(filepath);
                // Write to virtual filesystem with original filename in capper directory
                pyodideInstance.FS.writeFile(`capper/${filename}`, content);
            } catch (error) {
                outputDiv.textContent = error.message;
                throw error;
            }
        }

        // Initialize Python environment with updated path
        outputDiv.textContent = 'Initializing Python environment...';
        await pyodideInstance.runPythonAsync(`
            import sys
            sys.path.append('capper')
            from caption import processRequest
        `);

        outputDiv.textContent = 'Environment ready!';
        setupEventListeners();
        return pyodideInstance;

    } catch (error) {
        const errorMessage = `Error: ${error.message}`;
        console.error('Failed to initialize Python:', error);
        outputDiv.textContent = errorMessage;
        throw error;
    }
}

function createCharacterEntry(charNum) {
    const entry = document.createElement('div');
    entry.className = 'speaker-entry';
    entry.innerHTML = `
        <div class="name-preview-row">
            <div class="name-input">
                <input type="text" class="form-control speaker-name" placeholder="Character Name" value="Character ${charNum}">
            </div>
            <div class="font-preview">Character ${charNum}</div>
        </div>
        <div class="format-controls">
            <div class="control-group">
                <label class="form-label">Color</label>
                <div class="color-picker-container" data-type="font"></div>
            </div>
            <div class="control-group">
                <label class="form-label">Font</label>
                <select class="form-select font-type-select" title="Font Type">
                    <option value="Noto Sans">Sans</option>
                    <option value="Noto Serif">Serif</option>
                    <option value="Noto Emoji">Emoji</option>
                </select>
            </div>
            <div class="control-group">
                <label class="form-label">Rel. Height</label>
                <input type="number" class="form-control number-input font-height" value="1" min="0" max="100" step="0.1" title="Font Height">
            </div>
            <div class="control-group">
                <label class="form-label">Stroke</label>
                <input type="number" class="form-control number-input stroke-width" value="0" min="0" max="10" step="0.1" title="Stroke Width">
            </div>
            <div class="control-group">
                <label class="form-label">Stroke Color</label>
                <div class="color-picker-container" data-type="stroke"></div>
            </div>
            <div class="control-group insert-btn-group">
                <label class="form-label">&nbsp;</label>
                <button class="btn btn-secondary insert-btn" title="Insert character tag">Insert</button>
            </div>
        </div>
    `;

    // Initialize color pickers
    const fontColorContainer = entry.querySelector('.color-picker-container[data-type="font"]');
    const strokeColorContainer = entry.querySelector('.color-picker-container[data-type="stroke"]');
    
    const fontColorPicker = Pickr.create({
        el: fontColorContainer,
        theme: 'nano',
        default: '#000000',
        swatches: [
            '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
            '#ffff00', '#00ffff', '#ff00ff', '#808080', '#800000'
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
    });

    const strokeColorPicker = Pickr.create({
        el: strokeColorContainer,
        theme: 'nano',
        default: '#ffffff',
        swatches: [
            '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
            '#ffff00', '#00ffff', '#ff00ff', '#808080', '#800000'
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
    });

    // Store color pickers in the entry element for later access
    entry.fontColorPicker = fontColorPicker;
    entry.strokeColorPicker = strokeColorPicker;

    // Add event listeners for formatting changes
    const preview = entry.querySelector('.font-preview');
    const updatePreview = () => {
        const name = entry.querySelector('.speaker-name').value;
        const fontType = entry.querySelector('.font-type-select').value;
        const height = entry.querySelector('.font-height').value;
        const strokeWidth = entry.querySelector('.stroke-width').value;

        preview.style.fontFamily = fontType;
        preview.style.fontSize = `${height * 16}px`;
        preview.textContent = name;
    };

    // Add event listeners to inputs
    entry.querySelectorAll('input:not([type="color"]), select').forEach(input => {
        input.addEventListener('input', updatePreview);
        input.addEventListener('change', updatePreview);
    });

    // Add color picker event listeners
    fontColorPicker.on('save', (color) => {
        if (color) {
            preview.style.color = color.toRGBA().toString();
        }
        fontColorPicker.hide();
    });

    strokeColorPicker.on('save', (color) => {
        if (color) {
            preview.style.webkitTextStroke = `${entry.querySelector('.stroke-width').value}px ${color.toRGBA().toString()}`;
        }
        strokeColorPicker.hide();
    });

    // Add event listener for stroke width changes
    entry.querySelector('.stroke-width').addEventListener('input', () => {
        const strokeWidth = entry.querySelector('.stroke-width').value;
        const strokeColor = strokeColorPicker.getColor()?.toRGBA().toString() || '#ffffff';
        preview.style.webkitTextStroke = `${strokeWidth}px ${strokeColor}`;
    });

    // Add event listener for insert button
    entry.querySelector('.insert-btn').addEventListener('click', () => {
        const textEditor = document.getElementById('textEditor');
        const name = entry.querySelector('.speaker-name').value;
        const tag = `[${name}]`;
        
        // Get cursor position
        const start = textEditor.selectionStart;
        const end = textEditor.selectionEnd;
        
        // Insert tag at cursor position
        textEditor.value = textEditor.value.substring(0, start) + 
                          tag + 
                          textEditor.value.substring(end);
        
        // Move cursor after inserted tag
        textEditor.selectionStart = textEditor.selectionEnd = start + tag.length;
        textEditor.focus();
    });

    updatePreview();
    return entry;
}

function setupEventListeners() {
    const imageUpload = document.getElementById('imageUpload');
    const generateBtn = document.getElementById('generateBtn');
    const imagePreview = document.getElementById('imagePreview');
    const speakerList = document.getElementById('speakerList');
    const addSpeakerBtn = document.getElementById('addSpeaker');

    // Initialize character list
    speakerList.innerHTML = '';
    speakerList.appendChild(createCharacterEntry(1));

    // Add character button
    let charCount = 1;
    addSpeakerBtn.addEventListener('click', () => {
        charCount++;
        speakerList.appendChild(createCharacterEntry(charCount));
        speakerList.scrollTop = speakerList.scrollHeight;
    });

    imageUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            // Display preview
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);

            // Add to Pyodide filesystem
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            pyodideInstance.FS.writeFile(file.name, uint8Array);
        }
    });

    generateBtn.addEventListener('click', async () => {
        const outputDiv = document.getElementById('output');
        const textEditor = document.getElementById('textEditor');
        const imageUpload = document.getElementById('imageUpload');

        try {
            if (!imageUpload.files[0]) {
                throw new Error('Please upload an image first');
            }

            // Collect font settings from all character entries
            const fontSettings = {};
            document.querySelectorAll('.speaker-entry').forEach(entry => {
                const name = entry.querySelector('.speaker-name').value;
                const fontType = entry.querySelector('.font-type-select').value;
                const fontHeight = entry.querySelector('.font-height').value;
                const strokeWidth = entry.querySelector('.stroke-width').value;
                const fontColor = entry.fontColorPicker.getColor()?.toRGBA().toString() || '#000000';
                const strokeColor = entry.strokeColorPicker.getColor()?.toRGBA().toString() || '#ffffff';

                fontSettings[name] = {
                    font_type: fontType,
                    font_height: parseFloat(fontHeight),
                    font_color: fontColor,
                    stroke_width: parseFloat(strokeWidth),
                    stroke_color: strokeColor
                };
            });

            // Write text content to file
            const textContent = textEditor.value;
            pyodideInstance.FS.writeFile('input.txt', textContent);

            // Convert font settings to Python dict string
            const fontSettingsStr = JSON.stringify(fontSettings).replace(/"/g, "'");

            // Call processRequest with the image file and font settings
            const result = await pyodideInstance.runPythonAsync(`
                processRequest("${imageUpload.files[0].name}", font_settings=${fontSettingsStr})
            `);
            
            outputDiv.textContent = result;
        } catch (error) {
            outputDiv.textContent = `Error: ${error.message}`;
            console.error('Processing error:', error);
        }
    });
}

// Initialize when page loads
window.addEventListener('load', async () => {
    try {
        await initializeApp();
        console.log('Python environment initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
});
