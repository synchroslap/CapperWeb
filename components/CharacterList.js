const CharacterList = {
    name: 'CharacterList',
    template: `
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="mb-0">Characters</h3>
            <button class="btn btn-primary" @click="addCharacter">
                <i class="bi bi-plus"></i> Add Character
            </button>
        </div>
        <div class="mb-3">
            <label class="form-label">Upload Font</label>
            <input type="file" 
                   class="form-control" 
                   @change="handleFontUpload" 
                   accept=".ttf"
                   title="Upload TTF Font">
        </div>
        <div class="speaker-list">
            <div v-for="(character, index) in characters" 
                 :key="character.id || index" 
                 class="speaker-entry">
                <div class="name-preview-row">
                    <div class="name-input">
                        <input type="text" class="form-control speaker-name" 
                               v-model="character.name" 
                               placeholder="Character Name"
                               @input="updateCharacters">
                    </div>
                    <div class="font-preview" :style="getPreviewStyle(character)">
                        {{ character.name }}
                    </div>
                </div>
                <div class="format-controls">
                    <div class="control-group insert-btn-group">
                        <label class="form-label">&nbsp;</label>
                        <div class="d-flex gap-2">
                            <button class="btn btn-secondary insert-btn" 
                                    @click="$emit('insert-tag', character.name)"
                                    title="Insert character tag">Insert</button>
                            <button class="btn btn-danger" 
                                    @click="removeCharacter(index)"
                                    title="Remove character">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="control-group">
                        <label class="form-label">Color</label>
                        <div class="color-picker-wrapper">
                            <div :class="'font-color-picker-' + getSafeId(character)"></div>
                        </div>
                    </div>
                    <div class="control-group">
                        <label class="form-label">Font</label>
                        <select class="form-select font-type-select" 
                                v-model="character.fontType" 
                                @change="updateCharacters"
                                title="Font Type">
                            <option v-for="font in availableFonts" 
                                    :key="font.path" 
                                    :value="font.path">{{ font.name }}</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label class="form-label">Height</label>
                        <input type="number" class="form-control number-input" 
                               v-model="character.fontHeight" 
                               @input="updateCharacters"
                               min="0" max="100" step="0.1" 
                               title="Font Height">
                    </div>
                    <div class="control-group">
                        <label class="form-label">Stroke</label>
                        <input type="number" class="form-control number-input" 
                               v-model="character.strokeWidth" 
                               @input="updateCharacters"
                               min="0" max="10" step="0.1" 
                               title="Stroke Width">
                    </div>
                    <div class="control-group">
                        <label class="form-label">Stroke Color</label>
                        <div class="color-picker-wrapper">
                            <div :class="'stroke-color-picker-' + getSafeId(character)"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `,

    props: {
        characters: {
            type: Array,
            required: true
        },
        availableFonts: {
            type: Array,
            required: true,
            default: () => []
        }
    },

    emits: ['update:characters', 'insert-tag', 'font-upload'],

    data() {
        return {
            colorPickers: {},
            initializationTimeout: null
        }
    },

    methods: {
        getSafeId(character) {
            // Convert any ID to a CSS-safe class name by removing invalid characters
            return `id${String(character.id || '').replace(/[^a-zA-Z0-9]/g, '')}`;
        },

        handleFontUpload(event) {
            const file = event.target.files[0];
            if (file && file.name.toLowerCase().endsWith('.ttf')) {
                this.$emit('font-upload', file);
            }
        },

        addCharacter() {
            const newCharNum = this.characters.length + 1;
            const defaultFont = this.availableFonts.length > 0 ? this.availableFonts[0].path : '';
            const newCharacter = {
                id: Math.floor(Date.now()), // Use integer timestamp
                name: `Character${newCharNum}`,
                fontType: defaultFont,
                fontHeight: 1,
                strokeWidth: 0,
                fontColor: '#000000',
                strokeColor: '#ffffff'
            };
            
            this.$emit('update:characters', [...this.characters, newCharacter]);
        },

        removeCharacter(index) {
            if (confirm(`Are you sure you want to remove "${this.characters[index].name}"?`)) {
                const character = this.characters[index];
                this.cleanupColorPicker(character.id);
                const updatedCharacters = [...this.characters];
                updatedCharacters.splice(index, 1);
                this.$emit('update:characters', updatedCharacters);
            }
        },

        getPreviewStyle(character) {
            const font = this.availableFonts.find(f => f.path === character.fontType);
            return {
                fontFamily: font ? font.name : 'sans-serif',
                fontSize: `${character.fontHeight * 16}px`,
                color: character.fontColor,
                WebkitTextStroke: `${character.strokeWidth}px ${character.strokeColor}`
            };
        },

        updateCharacters() {
            this.$emit('update:characters', [...this.characters]);
        },

        cleanupColorPicker(characterId) {
            if (this.colorPickers[characterId]) {
                if (this.colorPickers[characterId].font) {
                    this.colorPickers[characterId].font.destroyAndRemove();
                }
                if (this.colorPickers[characterId].stroke) {
                    this.colorPickers[characterId].stroke.destroyAndRemove();
                }
                delete this.colorPickers[characterId];
            }
        },

        cleanupAllColorPickers() {
            Object.keys(this.colorPickers).forEach(characterId => {
                this.cleanupColorPicker(characterId);
            });
        },

        ensureCharacterIds() {
            let updated = false;
            this.characters.forEach(character => {
                if (!character.id) {
                    character.id = Math.floor(Date.now() + Math.random() * 1000);
                    updated = true;
                }
            });
            if (updated) {
                this.updateCharacters();
            }
        },

        initializeColorPicker(character) {
            const safeId = this.getSafeId(character);
            const fontColorEl = document.querySelector(`.font-color-picker-${safeId}`);
            const strokeColorEl = document.querySelector(`.stroke-color-picker-${safeId}`);
            
            if (!fontColorEl || !strokeColorEl) {
                return false;
            }

            const pickrConfig = {
                theme: 'nano',
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
            };

            try {
                // Clean up existing pickers if they exist
                this.cleanupColorPicker(character.id);

                const fontColorPicker = Pickr.create({
                    ...pickrConfig,
                    el: fontColorEl,
                    default: character.fontColor
                });

                const strokeColorPicker = Pickr.create({
                    ...pickrConfig,
                    el: strokeColorEl,
                    default: character.strokeColor
                });

                fontColorPicker.on('save', (color) => {
                    if (color) {
                        character.fontColor = color.toHEXA().toString();
                        this.updateCharacters();
                    }
                    fontColorPicker.hide();
                });

                strokeColorPicker.on('save', (color) => {
                    if (color) {
                        character.strokeColor = color.toHEXA().toString();
                        this.updateCharacters();
                    }
                    strokeColorPicker.hide();
                });

                this.colorPickers[character.id] = {
                    font: fontColorPicker,
                    stroke: strokeColorPicker
                };

                return true;
            } catch (error) {
                console.error(`Error initializing color pickers for character ${character.id}:`, error);
                return false;
            }
        },

        initializeAllColorPickers() {
            // Ensure all characters have IDs first
            this.ensureCharacterIds();

            // Clear any existing timeout
            if (this.initializationTimeout) {
                clearTimeout(this.initializationTimeout);
            }

            // Wait for Vue to finish rendering
            this.initializationTimeout = setTimeout(() => {
                this.$nextTick(() => {
                    this.characters.forEach(character => {
                        this.initializeColorPicker(character);
                    });
                });
            }, 250);
        }
    },

    watch: {
        characters: {
            handler() {
                this.initializeAllColorPickers();
            },
            deep: true
        }
    },

    mounted() {
        this.initializeAllColorPickers();
    },

    beforeUnmount() {
        if (this.initializationTimeout) {
            clearTimeout(this.initializationTimeout);
        }
        this.cleanupAllColorPickers();
    }
};

export default CharacterList;
