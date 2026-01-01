// Tileset loading and management
import { Logger } from '../utils/Logger.js';

export const MODULE_VERSION = '1.0.1';

export class TilesetManager {
    constructor(config) {
        this.config = config;
        this.tilesetImages = {};
        this.tilesetBlockDefinitions = {};
        this.tilesetsData = null;
    }
    
    async loadTileset(tilesetId, tilesetName) {
        // Check if already loaded
        if (this.tilesetImages[tilesetId]) {
            Logger.log(`Tileset ${tilesetId} already cached`);
            return this.tilesetImages[tilesetId];
        }
        
        Logger.log(`Loading tileset ${tilesetId} (${tilesetName})...`);
        
        const tilesetPath = this.config.getTilesetPath(tilesetId, tilesetName);
        Logger.log(`Tileset path: ${tilesetPath}`);
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                this.tilesetImages[tilesetId] = img;
                Logger.success(`Tileset ${tilesetId} loaded successfully`);
                Logger.info(`Tileset dimensions: ${img.width}x${img.height}`);
                resolve(img);
            };
            
            img.onerror = (error) => {
                const errorMsg = `Failed to load tileset ${tilesetId} from ${tilesetPath}`;
                Logger.error(errorMsg, error);
                reject(new Error(errorMsg));
            };
            
            img.src = tilesetPath;
        });
    }
    
    async loadTilesetBlocks(tilesetId) {
        // Check if already loaded
        if (this.tilesetBlockDefinitions[tilesetId]) {
            Logger.log(`Block definitions for tileset ${tilesetId} already cached`);
            return this.tilesetBlockDefinitions[tilesetId];
        }
        
        Logger.log(`Loading block definitions for tileset ${tilesetId}...`);
        
        // Load tilesets_complete.json if not loaded
        if (!this.tilesetsData) {
            const response = await fetch(this.config.paths.tilesetData);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} loading tileset data`);
            }
            this.tilesetsData = await response.json();
            Logger.success('Tilesets data loaded');
        }
        
        // Find the tileset in the data
        const tileset = this.tilesetsData.tilesets.find(t => t.tilesetId === tilesetId);
        
        if (!tileset) {
            throw new Error(`Tileset ${tilesetId} not found in tilesets data`);
        }
        
        Logger.success(`Found ${tileset.blocks.length} block definitions for tileset ${tilesetId}`);
        
        // Cache the block definitions
        this.tilesetBlockDefinitions[tilesetId] = tileset.blocks;
        
        return tileset.blocks;
    }
    
    getTilesetImage(tilesetId) {
        return this.tilesetImages[tilesetId];
    }
    
    getBlockDefinition(tilesetId, blockId) {
        const blocks = this.tilesetBlockDefinitions[tilesetId];
        if (!blocks) {
            return null;
        }
        return blocks[blockId];
    }
    
    hasTileset(tilesetId) {
        return !!this.tilesetImages[tilesetId];
    }
    
    hasBlockDefinitions(tilesetId) {
        return !!this.tilesetBlockDefinitions[tilesetId];
    }
}
