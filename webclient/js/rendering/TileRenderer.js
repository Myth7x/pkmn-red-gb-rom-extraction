/**
 * TileRenderer.js
 * 
 * Handles rendering of map tiles, blocks, and collision overlays.
 * Shared by both normal and interior map rendering modes.
 */

import { TILE_SIZE, BLOCK_SIZE } from '../core/Constants.js';

export const MODULE_VERSION = '1.0.0';

export class TileRenderer {
    constructor(canvasRenderer, tilesetManager, tileAnimator) {
        this.renderer = canvasRenderer;
        this.tilesetManager = tilesetManager;
        this.tileAnimator = tileAnimator;
        this.tileOptimizationEnabled = true;
    }

    /**
     * Set whether to use tile optimization (pre-scaled tilesets)
     * @param {boolean} enabled - Whether to use optimized tilesets
     */
    setTileOptimization(enabled) {
        this.tileOptimizationEnabled = enabled;
    }

    /**
     * Render a single block with its 4x4 tiles
     * @param {number} blockId - Block ID to render
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} scale - Render scale
     * @param {number} tilesetNumber - Tileset to use
     * @param {boolean} showCollision - Whether to show collision overlays
     */
    renderBlock(blockId, x, y, scale, tilesetNumber, showCollision = false) {
        const blockData = this.tilesetManager.getBlockDefinition(tilesetNumber, blockId);
        if (!blockData || !blockData.tiles) return;
        
        // Render 4x4 tiles in the block (tiles is a 2D array [row][col])
        for (let tileY = 0; tileY < BLOCK_SIZE; tileY++) {
            for (let tileX = 0; tileX < BLOCK_SIZE; tileX++) {
                const tileId = blockData.tiles[tileY][tileX];
                
                if (tileId === undefined) continue;
                
                const tileScreenX = x + (tileX * TILE_SIZE * scale);
                const tileScreenY = y + (tileY * TILE_SIZE * scale);
                
                this.renderTile(tileId, tileScreenX, tileScreenY, scale, tilesetNumber);
                
                // Render collision indicators if enabled
                if (showCollision) {
                    this.renderCollisionIndicator(tileId, tileScreenX, tileScreenY, scale, tilesetNumber);
                }
            }
        }
    }

    /**
     * Render a single tile
     * @param {number} tileId - Tile ID to render
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} scale - Render scale
     * @param {number} tilesetNumber - Tileset to use
     */
    renderTile(tileId, x, y, scale, tilesetNumber) {
        const tilesetImg = this.tilesetManager.getTilesetImage(tilesetNumber);
        if (!tilesetImg) return;
        
        const animationType = this.tilesetManager.getAnimationTypeValue(tilesetNumber);
        
        // Check if this is an animated tile (disable at very small scales)
        if (scale >= 0.5 && this.tileAnimator && this.tileAnimator.isAnimatedTile(tileId, animationType)) {
            const animatedCanvas = this.tileAnimator.renderAnimatedTile(tilesetImg, tileId, animationType, scale);
            if (animatedCanvas) {
                this.renderer.drawImage(animatedCanvas, 0, 0, animatedCanvas.width, animatedCanvas.height, x, y, TILE_SIZE * scale, TILE_SIZE * scale);
                return;
            }
        }
        
        // Use optimized tileset for small scales
        const optimizedTileset = this.tileOptimizationEnabled 
            ? this.tilesetManager.getOptimizedTileset(tilesetNumber, scale)
            : null;
        const tilesetToUse = optimizedTileset || tilesetImg;
        
        // Calculate source position in tileset image (16 tiles per row)
        const srcX = (tileId % 16) * TILE_SIZE;
        const srcY = Math.floor(tileId / 16) * TILE_SIZE;
        
        // Draw the tile
        this.renderer.drawImage(
            tilesetToUse,
            srcX, srcY, TILE_SIZE, TILE_SIZE,
            x, y,
            TILE_SIZE * scale,
            TILE_SIZE * scale
        );
    }

    /**
     * Render collision indicator overlay for a tile
     * @param {number} tileId - Tile ID
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} scale - Render scale
     * @param {number} tilesetNumber - Tileset to use
     */
    renderCollisionIndicator(tileId, x, y, scale, tilesetNumber) {
        const tileSize = TILE_SIZE * scale;
        
        // Analyze tile collision type
        const isPassable = this.tilesetManager.isTilePassable(tilesetNumber, tileId);
        const isGrass = this.tilesetManager.isGrassTile(tilesetNumber, tileId);
        const isWater = this.tilesetManager.isWaterTile(tileId);
        const isLedge = this.tilesetManager.isLedgeTile(tileId);
        const isFlower = this.tilesetManager.isFlowerTile(tilesetNumber, tileId);
        const isDoor = this.tilesetManager.isDoorTile(tileId);
        const isWarpCarpet = this.tilesetManager.isWarpCarpetTile(tileId);
        const isCounter = this.tilesetManager.isCounterTile(tileId);
        
        // Determine collision overlay color based on tile type (priority order)
        let overlayColor = null;
        let overlayAlpha = 0.3;
        
        if (isGrass) {
            overlayColor = 'rgba(0, 255, 0, 1.0)';
            overlayAlpha = 0.4;
        } else if (isWater) {
            overlayColor = 'rgba(0, 100, 255, 1.0)';
            overlayAlpha = 0.35;
        } else if (isLedge) {
            overlayColor = 'rgba(255, 140, 0, 1.0)';
            overlayAlpha = 0.4;
        } else if (isWarpCarpet) {
            overlayColor = 'rgba(255, 0, 255, 1.0)';
            overlayAlpha = 0.35;
        } else if (isDoor) {
            overlayColor = 'rgba(128, 0, 255, 1.0)';
            overlayAlpha = 0.35;
        } else if (isCounter) {
            overlayColor = 'rgba(255, 200, 0, 1.0)';
            overlayAlpha = 0.3;
        } else if (isFlower) {
            overlayColor = 'rgba(255, 192, 203, 1.0)';
            overlayAlpha = 0.25;
        } else if (!isPassable) {
            overlayColor = 'rgba(255, 0, 0, 1.0)';
            overlayAlpha = 0.25;
        }
        
        // Draw overlay if applicable
        if (overlayColor) {
            this.renderer.save();
            this.renderer.setAlpha(overlayAlpha);
            this.renderer.drawRect(x, y, tileSize, tileSize, overlayColor, true);
            this.renderer.restore();
        }
    }

    /**
     * Render a map with blocks and tiles
     * @param {Object} mapData - Map data to render
     * @param {number} baseX - Base screen X position
     * @param {number} baseY - Base screen Y position
     * @param {number} scale - Render scale
     * @param {boolean} showCollision - Whether to show collision overlays
     * @param {Object} visibleArea - Optional visible area {startX, startY, endX, endY}
     */
    renderMapTiles(mapData, baseX, baseY, scale, showCollision = false, visibleArea = null) {
        const allBlockDefs = this.tilesetManager.tilesetBlockDefinitions[mapData.tileset];
        if (!allBlockDefs) return;

        // Determine visible area
        let startX = 0, startY = 0, endX = mapData.width - 1, endY = mapData.height - 1;
        if (visibleArea) {
            startX = Math.max(0, visibleArea.startX);
            startY = Math.max(0, visibleArea.startY);
            endX = Math.min(mapData.width - 1, visibleArea.endX);
            endY = Math.min(mapData.height - 1, visibleArea.endY);
        }

        // Render blocks
        for (let blockY = startY; blockY <= endY; blockY++) {
            for (let blockX = startX; blockX <= endX; blockX++) {
                const blockIndex = blockY * mapData.width + blockX;
                const blockId = mapData.blockData[blockIndex];
                
                if (blockId === undefined) continue;
                
                const screenBlockX = baseX + blockX * BLOCK_SIZE * TILE_SIZE * scale;
                const screenBlockY = baseY + blockY * BLOCK_SIZE * TILE_SIZE * scale;
                
                this.renderBlock(blockId, screenBlockX, screenBlockY, scale, mapData.tileset, showCollision);
            }
        }
    }
}
