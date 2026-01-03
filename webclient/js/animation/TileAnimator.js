/**
 * TileAnimator.js
 * 
 * Handles animated tiles (water, flowers) based on pret/pokered's tile animation system.
 * 
 * Reference: https://github.com/pret/pokered
 * - home/vcopy.asm: UpdateMovingBgTiles function
 * - constants/map_data_constants.asm: TILEANIM_* constants
 * - data/tilesets/tileset_headers.asm: Tileset animation assignments
 * 
 * Animation Types:
 * - TILEANIM_NONE (0): No animations
 * - TILEANIM_WATER (1): Water tile $14 animates
 * - TILEANIM_WATER_FLOWER (2): Both water tile $14 and flower tile $03 animate
 * 
 * Water Animation ($14):
 * - Scrolls water pattern by rotating bits left/right
 * - Animates every 20 frames (hMovingBGTilesCounter1)
 * - Uses wMovingBGTilesCounter2 (0-7) to determine direction
 * 
 * Flower Animation ($03):
 * - Cycles through 3 frames: flower1, flower2, flower3
 * - Animates every 21 frames
 * - Uses wMovingBGTilesCounter2 (0-3) to select frame
 */

import { Logger } from '../utils/Logger.js';

// Animation type constants (from constants/map_data_constants.asm)
export const TILEANIM_NONE = 0;
export const TILEANIM_WATER = 1;
export const TILEANIM_WATER_FLOWER = 2;

// Tile IDs that are animated (from pret/pokered)
const WATER_TILE_ID = 0x14;  // $14 in assembly
const FLOWER_TILE_ID = 0x03; // $03 in assembly

// Always update version after changes
export const MODULE_VERSION = '1.0.0';

export class TileAnimator {
    constructor(config) {
        this.config = config;
        
        // Animation counters (mirrors hMovingBGTilesCounter1 and wMovingBGTilesCounter2)
        this.frameCounter1 = 0; // Increments every frame, controls animation timing
        this.waterCounter = 0;  // Water-specific counter (0-7)
        this.flowerCounter = 0; // Flower-specific counter (0-3)
        
        // Current animation frame for each animated tile type
        this.waterFrame = 0;   // 0-7 (8 frames for water animation)
        this.flowerFrame = 0;  // 0-2 (3 frames for flower animation)
        
        // Cached canvas data for animated tiles
        this.animatedTileCache = new Map(); // Key: "tilesetId_tileId_frame", Value: canvas
        
        // Track which tilesets need animation updates
        this.animatedTilesets = new Set();
        
        // Flower tile frames (loaded from separate PNG files)
        this.flowerFrames = [null, null, null]; // flower1.png, flower2.png, flower3.png
        this.flowerFramesLoaded = false;
        
        // Load flower tile graphics
        this.loadFlowerTileGraphics();
        
        Logger.log('TileAnimator initialized');
    }
    
    /**
     * Load the 3 separate flower tile graphics from PNG files
     * Based on pret/pokered: flower1.2bpp, flower2.2bpp, flower3.2bpp
     */
    loadFlowerTileGraphics() {
        const flowerPaths = [
            'assets/tiles/animated/flower1.png',
            'assets/tiles/animated/flower2.png',
            'assets/tiles/animated/flower3.png'
        ];
        
        let loadedCount = 0;
        
        flowerPaths.forEach((path, index) => {
            const img = new Image();
            img.onload = () => {
                this.flowerFrames[index] = img;
                loadedCount++;
                
                if (loadedCount === 3) {
                    this.flowerFramesLoaded = true;
                    Logger.log('✅ All 3 flower tile frames loaded successfully');
                    this.clearCache(); // Clear cache to force re-render with new tiles
                }
            };
            img.onerror = () => {
                Logger.error(`❌ Failed to load flower tile: ${path}`);
            };
            img.src = path;
        });
    }
    
    /**
     * Get flower frame images (for debug panel preview)
     */
    getFlowerFrames() {
        return this.flowerFrames;
    }
    
    /**
     * Get current water animation frame canvas (for debug panel preview)
     * @param {HTMLImageElement} tilesetImage - Source tileset image
     * @param {number} scale - Render scale (default 1)
     * @returns {HTMLCanvasElement|null} - Rendered water tile canvas
     */
    getCurrentWaterFrame(tilesetImage, scale = 1) {
        if (!tilesetImage) return null;
        
        // Use TILEANIM_WATER type to render water tile
        return this.renderAnimatedTile(tilesetImage, 0x14, 1, scale);
    }
    
    /**
     * Update animation state (called every frame)
     * Implements UpdateMovingBgTiles logic from home/vcopy.asm
     */
    update() {
        // Increment main counter
        this.frameCounter1++;
        
        // Water animation updates every 20 frames
        if (this.frameCounter1 === 20) {
            this.updateWaterAnimation();
        }
        
        // Flower animation updates every 21 frames
        else if (this.frameCounter1 === 21) {
            this.updateFlowerAnimation();
            this.frameCounter1 = 0; // Reset counter
        }
    }
    
    /**
     * Update water tile animation
     * Water scrolls by rotating pixel bits left or right
     */
    updateWaterAnimation() {
        // Increment water counter (0-7)
        this.waterCounter = (this.waterCounter + 1) & 7;
        
        // Determine scroll direction based on counter
        // When bit 2 is set (counter >= 4), scroll left, otherwise scroll right
        this.waterFrame = this.waterCounter;
        
        // Mark that water tiles need re-rendering
        this.invalidateAnimatedTiles(WATER_TILE_ID);
    }
    
    /**
     * Update flower tile animation
     * Cycles through 3 different flower frames
     */
    updateFlowerAnimation() {
        // Reset main counter
        this.frameCounter1 = 0;
        
        // Increment flower counter independently (0-3)
        this.flowerCounter = (this.flowerCounter + 1) & 3;
        
        // Select flower frame based on counter
        // 0-1: frame 0, 2: frame 1, 3: frame 2
        if (this.flowerCounter < 2) {
            this.flowerFrame = 0; // FlowerTile1
        } else if (this.flowerCounter === 2) {
            this.flowerFrame = 1; // FlowerTile2
        } else {
            this.flowerFrame = 2; // FlowerTile3
        }
        
        // Debug: Log flower frame changes (uncomment to debug)
        // Logger.log(`🌸 Flower animation: counter=${this.flowerCounter}, frame=${this.flowerFrame}`);
        
        // Mark that flower tiles need re-rendering
        this.invalidateAnimatedTiles(FLOWER_TILE_ID);
    }
    
    /**
     * Check if a tile should be animated
     * @param {number} tileId - Tile ID (0x00-0x5F)
     * @param {number} animationType - Tileset animation type (TILEANIM_*)
     * @returns {boolean} - True if tile is animated
     */
    isAnimatedTile(tileId, animationType) {
        if (animationType === TILEANIM_NONE) {
            return false;
        }
        
        // Water tile animates in WATER and WATER_FLOWER tilesets
        if (tileId === WATER_TILE_ID && animationType >= TILEANIM_WATER) {
            return true;
        }
        
        // Flower tile only animates in WATER_FLOWER tilesets
        if (tileId === FLOWER_TILE_ID && animationType === TILEANIM_WATER_FLOWER) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Get the current animation frame for a tile
     * @param {number} tileId - Tile ID
     * @returns {number} - Current frame index
     */
    getAnimationFrame(tileId) {
        if (tileId === WATER_TILE_ID) {
            return this.waterFrame;
        } else if (tileId === FLOWER_TILE_ID) {
            return this.flowerFrame;
        }
        return 0;
    }
    
    /**
     * Render animated tile to a cached canvas
     * @param {HTMLImageElement} tilesetImage - Source tileset image
     * @param {number} tileId - Tile ID
     * @param {number} animationType - Animation type
     * @param {number} scale - Render scale
     * @returns {HTMLCanvasElement} - Rendered tile canvas
     */
    renderAnimatedTile(tilesetImage, tileId, animationType, scale = 1) {
        if (!this.isAnimatedTile(tileId, animationType)) {
            return null; // Not an animated tile
        }
        
        const frame = this.getAnimationFrame(tileId);
        const cacheKey = `${tileId}_${frame}_${scale}`;
        
        // Return cached canvas if available
        if (this.animatedTileCache.has(cacheKey)) {
            return this.animatedTileCache.get(cacheKey);
        }
        
        // Create canvas for animated tile
        const TILE_SIZE = 8; // 8x8 pixels per tile
        const canvas = document.createElement('canvas');
        canvas.width = TILE_SIZE * scale;
        canvas.height = TILE_SIZE * scale;
        const ctx = canvas.getContext('2d');
        
        // Get source tile position in tileset
        const srcX = (tileId % 16) * TILE_SIZE;
        const srcY = Math.floor(tileId / 16) * TILE_SIZE;
        
        // Draw base tile to temporary canvas at 1:1 scale
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = TILE_SIZE;
        tempCanvas.height = TILE_SIZE;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(
            tilesetImage,
            srcX, srcY, TILE_SIZE, TILE_SIZE,
            0, 0, TILE_SIZE, TILE_SIZE
        );
        
        // Apply animation transformation
        if (tileId === WATER_TILE_ID) {
            this.applyWaterAnimation(tempCtx, frame);
        } else if (tileId === FLOWER_TILE_ID) {
            this.applyFlowerAnimation(tempCtx, tilesetImage, frame);
        }
        
        // Scale to final size
        ctx.imageSmoothingEnabled = false; // Pixel-perfect scaling
        ctx.drawImage(tempCanvas, 0, 0, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE * scale, TILE_SIZE * scale);
        
        // Cache the rendered tile
        this.animatedTileCache.set(cacheKey, canvas);
        
        return canvas;
    }
    
    /**
     * Apply water animation effect (bit rotation)
     * Rotates pixel bits left or right to create scrolling effect
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} frame - Animation frame (0-7)
     */
    applyWaterAnimation(ctx, frame) {
        const imageData = ctx.getImageData(0, 0, 8, 8);
        const data = imageData.data;
        
        // Determine rotation direction (bit 2 of frame)
        const rotateLeft = (frame & 4) !== 0;
        const rotations = frame & 3; // Number of rotations (0-3)
        
        // For now, use a simplified horizontal shift effect
        // Full bit rotation would require manipulating individual pixel bits
        // which is complex with RGBA data
        
        if (rotations > 0) {
            const shift = rotateLeft ? -rotations : rotations;
            this.shiftPixelsHorizontally(imageData, shift);
            ctx.putImageData(imageData, 0, 0);
        }
    }
    
    /**
     * Shift pixels horizontally (simplified water animation)
     * @param {ImageData} imageData - Image data to modify
     * @param {number} shift - Pixels to shift (-7 to 7)
     */
    shiftPixelsHorizontally(imageData, shift) {
        const width = 8;
        const height = 8;
        const data = imageData.data;
        const temp = new Uint8ClampedArray(width * height * 4);
        
        // Copy to temp buffer with shift
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcX = (x - shift + width) % width; // Wrap around
                const srcIdx = (y * width + srcX) * 4;
                const dstIdx = (y * width + x) * 4;
                
                temp[dstIdx] = data[srcIdx];
                temp[dstIdx + 1] = data[srcIdx + 1];
                temp[dstIdx + 2] = data[srcIdx + 2];
                temp[dstIdx + 3] = data[srcIdx + 3];
            }
        }
        
        // Copy back
        data.set(temp);
    }
    
    /**
     * Apply flower animation effect (swap tile graphics)
     * Loads the appropriate flower frame (flower1, flower2, or flower3) 
     * Based on pret/pokered: FlowerTile1/2/3 from gfx/tilesets/flower/*.2bpp
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {HTMLImageElement} tilesetImage - Original tileset (fallback)
     * @param {number} frame - Animation frame (0-2)
     */
    applyFlowerAnimation(ctx, tilesetImage, frame) {
        // If flower frames are loaded, use the actual graphics
        if (this.flowerFramesLoaded && this.flowerFrames[frame]) {
            // Clear canvas and draw the appropriate flower frame
            ctx.clearRect(0, 0, 8, 8);
            ctx.drawImage(this.flowerFrames[frame], 0, 0, 8, 8);
            return;
        }
        
        // Fallback: If frames not loaded yet, keep original tile
        // (This shouldn't happen in normal operation, but provides graceful degradation)
        Logger.warn(`Flower frame ${frame} not loaded, using fallback`);
    }
    
    /**
     * Clear animation cache (call when tileset changes)
     */
    clearCache() {
        this.animatedTileCache.clear();
        Logger.log('Tile animation cache cleared');
    }
    
    /**
     * Mark animated tiles as invalid (need re-render)
     * @param {number} tileId - Tile ID that changed
     */
    invalidateAnimatedTiles(tileId) {
        // Remove all cached frames for this tile
        for (const key of this.animatedTileCache.keys()) {
            if (key.startsWith(`${tileId}_`)) {
                this.animatedTileCache.delete(key);
            }
        }
    }
    
    /**
     * Reset animation state
     */
    reset() {
        this.frameCounter1 = 0;
        this.waterCounter = 0;
        this.flowerCounter = 0;
        this.waterFrame = 0;
        this.flowerFrame = 0;
        this.clearCache();
        Logger.log('TileAnimator reset');
    }
}
