// Tileset loading and management
import { Logger } from '../utils/Logger.js';

export const MODULE_VERSION = '1.0.1';

export class TilesetManager {
    constructor(config) {
        this.config = config;
        this.tilesetImages = {};
        this.tilesetBlockDefinitions = {};
        this.tilesetImpassableTiles = {}; // NEW: Store impassable tile IDs
        this.tilesetGrassTiles = {}; // NEW: Store grass tile IDs
        this.tilesetAnimations = {}; // NEW: Store animation types
        this.tilesetsData = null;
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
        
        // Cache impassable tiles list (NEW: Tile-based collision)
        if (tileset.impassableTiles) {
            this.tilesetImpassableTiles[tilesetId] = tileset.impassableTiles;
            console.log(`[TilesetManager] Loaded ${tileset.impassableTiles.length} impassable tiles for tileset ${tilesetId}`);
            console.log(`[TilesetManager] Impassable tiles:`, tileset.impassableTiles);
        } else {
            console.warn(`[TilesetManager] No impassable tiles data for tileset ${tilesetId}!`);
            this.tilesetImpassableTiles[tilesetId] = [];
        }
        
        // Cache grass tile ID
        if (tileset.grassTile !== null && tileset.grassTile !== undefined) {
            this.tilesetGrassTiles[tilesetId] = tileset.grassTile;
            console.log(`[TilesetManager] Grass tile for tileset ${tilesetId}: ${tileset.grassTile}`);
        }
        
        // Cache animation type
        if (tileset.animationName) {
            this.tilesetAnimations[tilesetId] = tileset.animationName;
            console.log(`[TilesetManager] Animation type for tileset ${tilesetId}: ${tileset.animationName}`);
        }
        
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
    
    /**
     * Check if a specific tile ID is passable (NEW: Tile-based collision)
     * 
     * Special handling:
     * - Grass tiles are in the impassable list (for encounter detection)
     *   but are actually walkable
     * 
     * @param {number} tilesetId - Tileset ID
     * @param {number} tileId - Tile ID (0x00-0x5F for map tiles)
     * @returns {boolean} - True if passable/walkable
     */
    isTilePassable(tilesetId, tileId) {
        const impassableTiles = this.tilesetImpassableTiles[tilesetId];
        if (!impassableTiles) {
            console.warn(`[TilesetManager] No impassable tiles data for tileset ${tilesetId}`);
            return true; // Default to passable if no data
        }
        
        // Special case: Grass tiles are in impassable list but are walkable
        // (they're marked impassable for encounter detection)
        if (this.isGrassTile(tilesetId, tileId)) {
            return true; // Grass is walkable
        }
        
        // Normal check: if tile is NOT in impassable list, it's passable
        return !impassableTiles.includes(tileId);
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
        const ledgeTiles = [0x27, 0x0D, 0x1D, 0x36, 0x37];
        return ledgeTiles.includes(tileId);
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
        console.warn(`[TilesetManager] isBlockWalkable is deprecated. Use isTilePassable instead.`);
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
     * DEPRECATED: Old block collision getter (kept for compatibility)
     */
    getBlockCollision(tilesetId, blockId) {
        console.warn(`[TilesetManager] getBlockCollision is deprecated. Use getTileInBlock and isTilePassable instead.`);
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
        console.warn(`[TilesetManager] getTileCollision is deprecated. Use isTilePassable instead.`);
        const passable = this.isTilePassable(tilesetId, tileId);
        return {
            walkable: passable,
            type: passable ? 'PASSABLE' : 'WALL'
        };
    }
}
