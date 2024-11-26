const CharacterList = {
    name: 'CharacterList',
    template: `
    <div class="character-list-container">
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h5 mb-0">Characters</h3>
            <button class="btn btn-primary btn-sm" @click="addCharacter">
                <i class="bi bi-plus-lg me-1"></i> Add Character
            </button>
        </div>
        <div class="mb-3">
            <label class="form-label small fw-medium text-secondary mb-1">Upload Font</label>
            <label class="btn btn-outline-secondary btn-sm w-100">
                <i class="bi bi-file-earmark-font me-1"></i> Choose Font File
                <input type="file" @change="handleFontUpload" accept=".ttf" class="d-none">
            </label>
        </div>
        <div class="speaker-list">
            <div v-for="(character, index) in characters" 
                 :key="character.id || index" 
                 class="speaker-entry bg-body-secondary rounded p-3 mb-3">
                <div class="d-flex align-items-center gap-2 mb-3">
                    <div class="flex-grow-1">
                        <input type="text" class="form-control form-control-sm" 
                               v-model="character.name" 
                               placeholder="Character Name"
                               @input="updateCharacters">
                    </div>
                    <div class="font-preview px-2 py-1 bg-body border rounded text-nowrap overflow-hidden" :style="getPreviewStyle(character)">
                        {{ character.name }}
                    </div>
                </div>
                <div class="d-flex flex-wrap gap-3 align-items-end">
                    <div>
                        <button class="btn btn-secondary btn-sm me-1" 
                                @click="$emit('insert-tag', character.name)"
                                title="Insert character tag">
                            <i class="bi bi-plus-lg me-1"></i>Insert
                        </button>
                        <button class="btn btn-danger btn-sm" 
                                @click="showDeleteModal(index)"
                                title="Remove character">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                    <div>
                        <label class="form-label small fw-medium text-secondary mb-1">Color</label>
                        <div class="color-picker-wrapper">
                            <div :class="'font-color-picker-' + getSafeId(character)" class="border rounded"></div>
                        </div>
                    </div>
                    <div class="flex-grow-1">
                        <label class="form-label small fw-medium text-secondary mb-1">Font</label>
                        <select class="form-select form-select-sm" 
                                v-model="character.fontType" 
                                @change="updateCharacters"
                                title="Font Type">
                            <option v-for="font in availableFonts" 
                                    :key="font.path" 
                                    :value="font.path">{{ font.name }}</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label small fw-medium text-secondary mb-1">Rel. Height</label>
                        <input type="number" class="form-control form-control-sm w-auto" 
                               v-model="character.fontHeight" 
                               @input="updateCharacters"
                               min="0" max="100" step="0.1" 
                               title="Font Height">
                    </div>
                    <div>
                        <label class="form-label small fw-medium text-secondary mb-1">Stroke</label>
                        <input type="number" class="form-control form-control-sm w-auto" 
                               v-model="character.strokeWidth" 
                               @input="updateCharacters"
                               min="0" max="10" step="0.1" 
                               title="Stroke Width">
                    </div>
                    <div>
                        <label class="form-label small fw-medium text-secondary mb-1">Stroke Color</label>
                        <div class="color-picker-wrapper">
                            <div :class="'stroke-color-picker-' + getSafeId(character)" class="border rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div class="modal fade" id="deleteCharacterModal" tabindex="-1" aria-labelledby="deleteCharacterModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content bg-body">
                    <div class="modal-header">
                        <h5 class="modal-title" id="deleteCharacterModalLabel">Confirm Delete</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" v-if="characterToDelete !== null">
                        Are you sure you want to remove "{{ characters[characterToDelete].name }}"?
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-danger" @click="confirmDelete">Delete</button>
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
            initializationTimeout: null,
            characterToDelete: null,
            deleteModal: null
        }
    },

    methods: {
        getSafeId(character) {
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
                id: Math.floor(Date.now()),
                name: `Character${newCharNum}`,
                fontType: defaultFont,
                fontHeight: 1,
                strokeWidth: 0,
                fontColor: '#000000',
                strokeColor: '#ffffff'
            };
            
            this.$emit('update:characters', [...this.characters, newCharacter]);
        },

        showDeleteModal(index) {
            this.characterToDelete = index;
            this.deleteModal.show();
        },

        confirmDelete() {
            if (this.characterToDelete !== null) {
                const character = this.characters[this.characterToDelete];
                this.cleanupColorPicker(character.id);
                const updatedCharacters = [...this.characters];
                updatedCharacters.splice(this.characterToDelete, 1);
                this.$emit('update:characters', updatedCharacters);
                this.deleteModal.hide();
                this.characterToDelete = null;
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
            this.ensureCharacterIds();

            if (this.initializationTimeout) {
                clearTimeout(this.initializationTimeout);
            }

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
        this.deleteModal = new bootstrap.Modal(document.getElementById('deleteCharacterModal'));
    },

    beforeUnmount() {
        if (this.initializationTimeout) {
            clearTimeout(this.initializationTimeout);
        }
        this.cleanupAllColorPickers();
        if (this.deleteModal) {
            this.deleteModal.dispose();
        }
    }
};

export default CharacterList;
