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
            <div v-for="(character, index) in characters" :key="index" class="speaker-entry">
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
                        <div :id="'fontColor' + index" class="color-picker-container"></div>
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
                        <div :id="'strokeColor' + index" class="color-picker-container"></div>
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
            colorPickers: []
        }
    },

    methods: {
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
                name: `Character${newCharNum}`,
                fontType: defaultFont,
                fontHeight: 1,
                strokeWidth: 0,
                fontColor: '#000000',
                strokeColor: '#ffffff'
            };
            
            this.$emit('update:characters', [...this.characters, newCharacter]);
            
            this.$nextTick(() => {
                this.initializeColorPickers(this.characters.length - 1);
            });
        },

        removeCharacter(index) {
            if (confirm(`Are you sure you want to remove "${this.characters[index].name}"?`)) {
                // Clean up color pickers for the removed character
                if (this.colorPickers[index]) {
                    if (this.colorPickers[index].font) {
                        this.colorPickers[index].font.destroyAndRemove();
                    }
                    if (this.colorPickers[index].stroke) {
                        this.colorPickers[index].stroke.destroyAndRemove();
                    }
                }

                // Remove the character and its color pickers
                const updatedCharacters = [...this.characters];
                updatedCharacters.splice(index, 1);
                this.colorPickers.splice(index, 1);
                
                this.$emit('update:characters', updatedCharacters);

                // Reinitialize remaining color pickers with updated indices
                this.$nextTick(() => {
                    updatedCharacters.forEach((_, i) => {
                        this.initializeColorPickers(i);
                    });
                });
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

        initializeColorPickers(index) {
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

            // Initialize font color picker
            const fontColorPicker = Pickr.create({
                ...pickrConfig,
                el: `#fontColor${index}`,
                default: this.characters[index].fontColor
            });

            // Initialize stroke color picker
            const strokeColorPicker = Pickr.create({
                ...pickrConfig,
                el: `#strokeColor${index}`,
                default: this.characters[index].strokeColor
            });

            fontColorPicker.on('save', (color) => {
                if (color) {
                    this.characters[index].fontColor = color.toHEXA().toString();
                    this.updateCharacters();
                }
                fontColorPicker.hide();
            });

            strokeColorPicker.on('save', (color) => {
                if (color) {
                    this.characters[index].strokeColor = color.toHEXA().toString();
                    this.updateCharacters();
                }
                strokeColorPicker.hide();
            });

            // Store pickers for cleanup
            if (!this.colorPickers[index]) {
                this.colorPickers[index] = {};
            }
            this.colorPickers[index].font = fontColorPicker;
            this.colorPickers[index].stroke = strokeColorPicker;
        }
    },

    mounted() {
        // Initialize color pickers for existing characters
        this.characters.forEach((_, index) => {
            this.initializeColorPickers(index);
        });
    },

    beforeUnmount() {
        // Cleanup color pickers
        this.colorPickers.forEach(pickers => {
            if (pickers.font) pickers.font.destroyAndRemove();
            if (pickers.stroke) pickers.stroke.destroyAndRemove();
        });
    }
};

export default CharacterList;
