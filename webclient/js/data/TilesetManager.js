// Tileset loading and management
import { Logger } from '../utils/Logger.js';

export const MODULE_VERSION = '1.0.2';

export class TilesetManager {
    constructor(config) {
        this.config = config;
        this.tilesetImages = {};
        this.tilesetBlockDefinitions = {};
        this.tilesetPassableTiles = {}; // Store PASSABLE tile IDs (game defines what you CAN walk on)
        this.tilesetGrassTiles = {}; // Store grass tile IDs
        this.tilesetAnimations = {}; // Store animation types
        this.tilesetsData = null;
        
        // Optimized tileset cache for different scales
        this.optimizedTilesets = {}; // Key: "tilesetId_scale" -> Canvas
        this.SCALE_THRESHOLDS = [0.25, 0.5, 0.75, 1.0]; // Pre-render at these scales
    }
    
    async loadTileset(tilesetId, tilesetName) {
        // Check if already loaded
        if (this.tilesetImages[tilesetId]) {
            return this.tilesetImages[tilesetId];
        }
        
        Logger.log(`Loading tileset ${tilesetId} (${tilesetName})...`);
        
        const tilesetPath = this.config.getTilesetPath(tilesetId, tilesetName);
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                this.tilesetImages[tilesetId] = img;
                Logger.success(`Tileset ${tilesetId} loaded`);
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
        }
        
        // Find the tileset in the data
        const tileset = this.tilesetsData.tilesets.find(t => t.tilesetId === tilesetId);
        
        if (!tileset) {
            throw new Error(`Tileset ${tilesetId} not found in tilesets data`);
        }
        
        Logger.success(`Loaded ${tileset.blocks.length} blocks for tileset ${tilesetId}`);
        
        // Cache the block definitions
        this.tilesetBlockDefinitions[tilesetId] = tileset.blocks;
        
        // Cache PASSABLE tiles list (game defines walkable tiles, not impassable ones)
        if (tileset.passableTiles) {
            this.tilesetPassableTiles[tilesetId] = tileset.passableTiles;
        } else {
            this.tilesetPassableTiles[tilesetId] = [];
        }
        
        // Cache grass tile ID
        if (tileset.grassTile !== null && tileset.grassTile !== undefined) {
            this.tilesetGrassTiles[tilesetId] = tileset.grassTile;
        }
        
        // Cache animation type
        if (tileset.animationName) {
            this.tilesetAnimations[tilesetId] = tileset.animationName;
        }
        
        return tileset.blocks;
    }
    
    getTilesetImage(tilesetId) {
        return this.tilesetImages[tilesetId];
    }
    
    /**
     * Get optimized tileset for current scale (with imageSmoothingEnabled false for pixel-perfect scaling)
     * @param {number} tilesetId - Tileset ID
     * @param {number} scale - Current rendering scale
     * @returns {HTMLImageElement|null} Optimized tileset or null
     */
    getOptimizedTileset(tilesetId, scale) {
        // At normal scale or larger, use original tileset
        if (scale >= 1.0) {
            return null; // Use original
        }
        
        // Find closest scale threshold
        let targetScale = this.SCALE_THRESHOLDS[0];
        for (const threshold of this.SCALE_THRESHOLDS) {
            if (scale >= threshold) {
                targetScale = threshold;
            }
        }
        
        const cacheKey = `${tilesetId}_${targetScale}`;
        
        // Return cached if available
        if (this.optimizedTilesets[cacheKey]) {
            return this.optimizedTilesets[cacheKey];
        }
        
        // Create optimized version
        const originalImg = this.tilesetImages[tilesetId];
        if (!originalImg) return null;
        
        // Create canvas for pre-scaled tileset with pixel-perfect scaling
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { 
            alpha: true,
            desynchronized: true // Better performance
        });
        
        // Disable image smoothing for pixel-perfect scaling
        ctx.imageSmoothingEnabled = false;
        
        // Scale the entire tileset
        const scaledWidth = Math.ceil(originalImg.width * targetScale);
        const scaledHeight = Math.ceil(originalImg.height * targetScale);
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        
        // Draw scaled tileset
        ctx.drawImage(originalImg, 0, 0, scaledWidth, scaledHeight);
        
        // Cache it
        this.optimizedTilesets[cacheKey] = canvas;
        
        return canvas;
    }
    
    /**
     * Clear optimized tileset cache (call when tilesets change)
     */
    clearOptimizedCache() {
        this.optimizedTilesets = {};
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
    
    /**
     * Check if a specific tile ID is passable (Tile-based collision)
     * 
     * From pret/pokered CheckTilePassable logic:
     * - Loop through passable tiles list
     * - If tile found in list → PASSABLE (return with Z flag)
     * - If reach 0xFF without finding → IMPASSABLE (set carry flag)
     * 
     * The game defines what you CAN walk on, not what you can't.
     * 
     * @param {number} tilesetId - Tileset ID
     * @param {number} tileId - Tile ID (0x00-0x5F for map tiles)
     * @returns {boolean} - True if passable/walkable
     */
    isTilePassable(tilesetId, tileId) {
        const passableTiles = this.tilesetPassableTiles[tilesetId];
        if (!passableTiles) {
            return false; // Default to impassable if no data (safer)
        }
        
        // Check if tile is IN the passable tiles list
        // This matches CheckTilePassable logic: found in list = passable
        return passableTiles.includes(tileId);
    }
    
    /**
     * Get the tile ID at a specific position within a block
     * @param {number} tilesetId - Tileset ID
     * @param {number} blockId - Block ID (0-255)
     * @param {number} tileRow - Row within block (0-3)
     * @param {number} tileCol - Column within block (0-3)
     * @returns {number|null} - Tile ID or null
     */
    getTileInBlock(tilesetId, blockId, tileRow, tileCol) {
        const block = this.getBlockDefinition(tilesetId, blockId);
        if (!block || !block.tiles) {
            return null;
        }
        
        if (tileRow < 0 || tileRow >= 4 || tileCol < 0 || tileCol >= 4) {
            return null;
        }
        
        return block.tiles[tileRow][tileCol];
    }
    
    /**
     * Check if a tile is grass
     * @param {number} tilesetId - Tileset ID
     * @param {number} tileId - Tile ID
     * @returns {boolean} - True if grass tile
     */
    isGrassTile(tilesetId, tileId) {
        const grassTile = this.tilesetGrassTiles[tilesetId];
        return grassTile !== undefined && grassTile !== null && tileId === grassTile;
    }
    
    /**
     * Check if a tile is water (based on common water tile IDs)
     * @param {number} tileId - Tile ID
     * @returns {boolean} - True if water tile
     */
    isWaterTile(tileId) {
        const waterTiles = [0x14, 0x32, 0x48];
        return waterTiles.includes(tileId);
    }
    
    /**
     * Check if a tile is a ledge (based on common ledge tile IDs)
     * @param {number} tileId - Tile ID
     * @returns {boolean} - True if ledge tile
     */
    isLedgeTile(tileId) {
        // Ledge tiles (jumpable edges)
        const ledgeTiles = [0x27, 0x0D, 0x1D, 0x36, 0x37];
        return ledgeTiles.includes(tileId);
    }
    
    /**
     * Check if a tile is a door/entrance tile
     * @param {number} tileId - Tile ID
     * @returns {boolean} - True if door tile
     */
    isDoorTile(tileId) {
        // Door tiles (typically part of building entrances)
        const doorTiles = [0x0C, 0x0D, 0x3C, 0x17, 0x52, 0x53, 0x58];
        return doorTiles.includes(tileId);
    }
    
    /**
     * Check if a tile is a warp carpet/mat tile
     * @param {number} tileId - Tile ID
     * @returns {boolean} - True if warp carpet tile
     */
    isWarpCarpetTile(tileId) {
        // Warp carpet tiles (used on Pokemon Center/Mart mats)
        const carpetTiles = [0x50, 0x55, 0x56, 0x5C, 0x5D];
        return carpetTiles.includes(tileId);
    }
    
    /**
     * Check if a tile is a counter/blocking tile
     * @param {number} tileId - Tile ID  
     * @returns {boolean} - True if counter tile
     */
    isCounterTile(tileId) {
        // Counter tiles (blocks movement but allows interaction)
        const counterTiles = [0x01, 0x41, 0x47];
        return counterTiles.includes(tileId);
    }
    
    /**
     * Check if a tile is an animated flower/decoration tile
     * Only applies to tilesets with TILEANIM_WATER_FLOWER
     * @param {number} tilesetId - Tileset ID
     * @param {number} tileId - Tile ID
     * @returns {boolean} - True if flower tile
     */
    isFlowerTile(tilesetId, tileId) {
        const animType = this.tilesetAnimations[tilesetId];
        
        // Flowers only animate in WATER_FLOWER tilesets
        if (animType !== 'WATER_FLOWER') {
            return false;
        }
        
        // Flower tiles in OVERWORLD tileset (decorative ground tiles)
        // These are walkable, decorated ground tiles
        const flowerTiles = [
            0x03, // Small flower
            0x5A, // Flower patch
            0x5B, // Flower patch variant
        ];
        
        return flowerTiles.includes(tileId);
    }
    
    /**
     * DEPRECATED: Old block-based collision check (kept for compatibility)
     * Note: Pokemon Red uses tile-based collision, not block-based
     */
    isBlockWalkable(tilesetId, blockId) {
        // Check if ANY tile in the block is walkable
        const block = this.getBlockDefinition(tilesetId, blockId);
        if (!block || !block.tiles) {
            return false;
        }
        
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const tileId = block.tiles[row][col];
                if (this.isTilePassable(tilesetId, tileId)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * Get animation type for a tileset
     * @param {number} tilesetId - Tileset ID
     * @returns {string|null} - Animation name ('WATER', 'WATER_FLOWER', or null)
     */
    getAnimationType(tilesetId) {
        return this.tilesetAnimations[tilesetId] || null;
    }
    
    /**
     * Get numeric animation type constant
     * @param {number} tilesetId - Tileset ID
     * @returns {number} - 0=NONE, 1=WATER, 2=WATER_FLOWER
     */
    getAnimationTypeValue(tilesetId) {
        const animName = this.getAnimationType(tilesetId);
        if (!animName) return 0; // TILEANIM_NONE
        if (animName === 'WATER') return 1; // TILEANIM_WATER
        if (animName === 'WATER_FLOWER') return 2; // TILEANIM_WATER_FLOWER
        return 0;
    }
    
    /**
     * DEPRECATED: Old block collision getter (kept for compatibility)
     */
    getBlockCollision(tilesetId, blockId) {
        return null;
    }
    
    /**
     * DEPRECATED: Old tile walkable check (kept for compatibility)
     */
    isTileWalkable(tilesetId, tileId) {
        return this.isTilePassable(tilesetId, tileId);
    }
    
    /**
     * DEPRECATED: Old tile collision getter (kept for compatibility)
     */
    getTileCollision(tilesetId, tileId) {
        const passable = this.isTilePassable(tilesetId, tileId);
        return {
            walkable: passable,
            type: passable ? 'PASSABLE' : 'WALL'
        };
    }
}
