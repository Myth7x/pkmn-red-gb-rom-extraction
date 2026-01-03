/**
 * NPC Movement System for Pokemon Red Map Viewer
 * Based on pret/pokered movement engine
 */

import { MOVEMENT_TYPES } from '../constants/movementTypes.js';

// Always update version after changes
export const MODULE_VERSION = '1.0.0';

export class NPCMovementEngine {
    constructor(tilesetManager = null, currentMap = null) {
        this.sprites = [];
        this.walkCounter = 0;
        this.animationFrameCounter = 0;
        this.isRunning = false;
        this.tilesetManager = tilesetManager;
        this.currentMap = currentMap;
    }
    
    /**
     * Set tileset manager for collision detection
     */
    setTilesetManager(tilesetManager) {
        this.tilesetManager = tilesetManager;
    }
    
    /**
     * Set current map for collision detection
     */
    setCurrentMap(currentMap) {
        this.currentMap = currentMap;
    }

    /**
     * Initialize sprites for movement simulation
     * @param {Array} spriteData - Array of sprite objects from map data
     */
    initializeSprites(spriteData) {
        this.sprites = spriteData.map(sprite => ({
            // Original data
            ...sprite,
            
            // Movement state
            movementStatus: 1, // 1 = ready, 2 = delayed, 3 = walking
            movementDelay: 0,
            intraAnimFrameCounter: 0,
            walkAnimationCounter: 0,
            
            // Position (in pixels, tile * 16)
            pixelX: sprite.x * 16,
            pixelY: sprite.y * 16,
            
            // Target position
            targetPixelX: sprite.x * 16,
            targetPixelY: sprite.y * 16,
            
            // Step vectors
            xStepVector: 0,
            yStepVector: 0,
            
            // Facing direction
            facingDirection: this.getInitialFacing(sprite.movement),
            
            // Animation frame
            animFrame: 0,
            
            // Movement range displacement (for WALK types)
            yDisplacement: 8, // initialized at 8
            xDisplacement: 8, // initialized at 8
        }));
    }

    /**
     * Get initial facing direction based on movement type
     */
    getInitialFacing(movementByte) {
        const movementType = MOVEMENT_TYPES[movementByte];
        if (!movementType) return 0; // FACING_DOWN
        
        // Extract direction from movement type
        if (movementType.category === 'STAY') {
            const direction = movementType.name.split(' ')[1];
            switch (direction) {
                case 'DOWN': return 0;
                case 'UP': return 4;
                case 'LEFT': return 8;
                case 'RIGHT': return 12;
                default: return 0;
            }
        }
        
        return 0; // Default to facing down
    }

    /**
     * Start the movement simulation
     */
    start() {
        this.isRunning = true;
        this.lastUpdateTime = Date.now();
        this.animate();
    }

    /**
     * Stop the movement simulation
     */
    stop() {
        this.isRunning = false;
    }

    /**
     * Main animation loop
     */
    animate() {
        if (!this.isRunning) return;

        const now = Date.now();
        const deltaTime = now - this.lastUpdateTime;
        
        // Update at ~60 FPS (16.67ms per frame)
        if (deltaTime >= 16) {
            this.update();
            this.lastUpdateTime = now;
        }

        requestAnimationFrame(() => this.animate());
    }

    /**
     * Update all sprites (called each frame)
     */
    update() {
        this.animationFrameCounter++;
        
        for (let i = 0; i < this.sprites.length; i++) {
            this.updateSprite(i);
        }
    }

    /**
     * Update a single sprite
     */
    updateSprite(index) {
        const sprite = this.sprites[index];
        const movementType = MOVEMENT_TYPES[sprite.movement];
        
        if (!movementType || movementType.name === 'NONE') {
            return; // No movement
        }

        // Handle movement based on status
        if (sprite.movementStatus === 1) {
            // Ready to move
            this.initiateSpriteMovement(sprite, movementType);
        } else if (sprite.movementStatus === 2) {
            // Delayed (waiting)
            this.updateSpriteDelay(sprite, movementType);
        } else if (sprite.movementStatus === 3) {
            // Currently walking
            this.updateWalkingSprite(sprite);
        }
    }

    /**
     * Initiate movement for a sprite
     */
    initiateSpriteMovement(sprite, movementType) {
        const category = movementType.category;
        
        if (category === 'STAY') {
            // Standing still, just update facing occasionally
            if (Math.random() < 0.01) { // 1% chance per frame to turn
                this.changeSpriteFacing(sprite, movementType);
            }
            return;
        }

        // For WALK types, determine direction to walk
        const direction = this.determineWalkDirection(sprite, movementType);
        
        if (direction) {
            this.startWalking(sprite, direction);
        } else {
            // Can't walk, enter delayed state
            sprite.movementStatus = 2;
            sprite.movementDelay = Math.floor(Math.random() * 128); // Random delay 0-127 frames
        }
    }

    /**
     * Determine which direction to walk based on movement type
     */
    determineWalkDirection(sprite, movementType) {
        const pattern = movementType.pattern;
        const rand = Math.random();
        
        if (pattern === 'ANY_DIR') {
            // Walk in any random direction
            const r = Math.random();
            if (r < 0.25) return 'DOWN';
            if (r < 0.5) return 'UP';
            if (r < 0.75) return 'LEFT';
            return 'RIGHT';
        } else if (pattern === 'LEFT_RIGHT') {
            // Walk horizontally
            return rand < 0.5 ? 'LEFT' : 'RIGHT';
        } else if (pattern === 'UP_DOWN') {
            // Walk vertically
            return rand < 0.5 ? 'UP' : 'DOWN';
        } else if (pattern === 'LEFT' || pattern === 'RIGHT' || pattern === 'UP' || pattern === 'DOWN') {
            // Walk in specific direction
            return pattern;
        }
        
        return null;
    }

    /**
     * Start walking animation
     */
    startWalking(sprite, direction) {
        // Check if we can walk in this direction (basic boundary check)
        const canWalk = this.canWalkInDirection(sprite, direction);
        
        if (!canWalk) {
            // Can't walk, enter delayed state
            sprite.movementStatus = 2;
            sprite.movementDelay = Math.floor(Math.random() * 128);
            return;
        }

        // Set up walk vectors
        sprite.xStepVector = 0;
        sprite.yStepVector = 0;
        
        switch (direction) {
            case 'DOWN':
                sprite.yStepVector = 1;
                sprite.facingDirection = 0;
                sprite.targetPixelY += 16;
                break;
            case 'UP':
                sprite.yStepVector = -1;
                sprite.facingDirection = 4;
                sprite.targetPixelY -= 16;
                break;
            case 'LEFT':
                sprite.xStepVector = -1;
                sprite.facingDirection = 8;
                sprite.targetPixelX -= 16;
                break;
            case 'RIGHT':
                sprite.xStepVector = 1;
                sprite.facingDirection = 12;
                sprite.targetPixelX += 16;
                break;
        }

        sprite.movementStatus = 3;
        sprite.walkAnimationCounter = 16; // Walk for 16 frames
        sprite.intraAnimFrameCounter = 0;
    }

    /**
     * Check if sprite can walk in direction (collision check + bounds check)
     */
    canWalkInDirection(sprite, direction) {
        const movementType = MOVEMENT_TYPES[sprite.movement];
        if (!movementType) {
            return false;
        }

        // Get target position in tiles
        const currentTileX = Math.floor(sprite.pixelX / 16);
        const currentTileY = Math.floor(sprite.pixelY / 16);
        
        let targetTileX = currentTileX;
        let targetTileY = currentTileY;
        
        switch (direction) {
            case 'DOWN':
                targetTileY += 1;
                break;
            case 'UP':
                targetTileY -= 1;
                break;
            case 'LEFT':
                targetTileX -= 1;
                break;
            case 'RIGHT':
                targetTileX += 1;
                break;
        }
        
        // Check map bounds (in tiles, each block is 4x4 tiles)
        if (this.currentMap) {
            const maxTileX = this.currentMap.width * 4; // 4 tiles per block width
            const maxTileY = this.currentMap.height * 4; // 4 tiles per block height
            
            if (targetTileX < 0 || targetTileX >= maxTileX || targetTileY < 0 || targetTileY >= maxTileY) {
                return false; // Out of bounds
            }
            
            // Check collision if tileset manager is available
            if (this.tilesetManager && this.currentMap.tileset !== undefined) {
                // Convert tile coordinates to block coordinates
                const blockX = Math.floor(targetTileX / 4);
                const blockY = Math.floor(targetTileY / 4);
                const tileInBlockX = targetTileX % 4;
                const tileInBlockY = targetTileY % 4;
                
                // Get block ID from map data
                const blockIndex = blockY * this.currentMap.width + blockX;
                const blockId = this.currentMap.blockData[blockIndex];
                
                if (blockId !== undefined) {
                    // Get tile ID from block definition
                    const blockDef = this.tilesetManager.getBlockDefinition(this.currentMap.tileset, blockId);
                    if (blockDef && blockDef.tiles) {
                        // Get tile ID from block's 4x4 structure
                        const tileId = blockDef.tiles[tileInBlockY][tileInBlockX];
                        
                        // Check if tile is walkable
                        const isWalkable = this.tilesetManager.isTileWalkable(this.currentMap.tileset, tileId);
                        
                        if (!isWalkable) {
                            return false; // Tile is blocked
                        }
                    }
                }
            }
        }
        
        // Check displacement limits (sprites have a "leash" from their start position)
        const maxDisplacement = 5; // From pokered: can walk up to 5 tiles from start
        
        let newYDisp = sprite.yDisplacement;
        let newXDisp = sprite.xDisplacement;
        
        switch (direction) {
            case 'DOWN':
                newYDisp += 1;
                if (newYDisp >= maxDisplacement + 8) return false;
                break;
            case 'UP':
                newYDisp -= 1;
                if (newYDisp < 0) return false;
                break;
            case 'LEFT':
                newXDisp -= 1;
                if (newXDisp < 0) return false;
                break;
            case 'RIGHT':
                newXDisp += 1;
                if (newXDisp >= maxDisplacement + 8) return false;
                break;
        }
        
        // Update displacement
        sprite.yDisplacement = newYDisp;
        sprite.xDisplacement = newXDisp;
        
        return true;
    }

    /**
     * Update sprite in delayed state
     */
    updateSpriteDelay(sprite, movementType) {
        if (movementType.category === 'WALK') {
            sprite.movementDelay--;
            
            if (sprite.movementDelay <= 0) {
                sprite.movementStatus = 1; // Ready to move again
            }
        }
    }

    /**
     * Update sprite that is currently walking
     */
    updateWalkingSprite(sprite) {
        // Update pixel position
        sprite.pixelX += sprite.xStepVector * 2; // Move 2 pixels per frame
        sprite.pixelY += sprite.yStepVector * 2;
        
        // Update walk animation
        sprite.intraAnimFrameCounter++;
        if (sprite.intraAnimFrameCounter >= 4) {
            sprite.intraAnimFrameCounter = 0;
            sprite.animFrame = (sprite.animFrame + 1) % 4; // 4 animation frames
        }
        
        // Decrease walk counter
        sprite.walkAnimationCounter--;
        
        if (sprite.walkAnimationCounter <= 0) {
            // Walking finished
            sprite.movementStatus = 1; // Ready for next move
            sprite.xStepVector = 0;
            sprite.yStepVector = 0;
            sprite.intraAnimFrameCounter = 0;
            sprite.animFrame = 0;
            
            // Snap to target position
            sprite.pixelX = sprite.targetPixelX;
            sprite.pixelY = sprite.targetPixelY;
        }
    }

    /**
     * Change facing direction for STAY movement types
     */
    changeSpriteFacing(sprite, movementType) {
        const pattern = movementType.pattern;
        
        if (pattern === 'LOOK_AROUND') {
            // Randomly look in any direction
            const directions = [0, 4, 8, 12]; // DOWN, UP, LEFT, RIGHT
            sprite.facingDirection = directions[Math.floor(Math.random() * 4)];
        }
        // Other STAY types don't change facing
    }

    /**
     * Get sprite positions for rendering
     */
    getSpritePositions() {
        return this.sprites.map(sprite => ({
            index: sprite.index || 0,
            pixelX: sprite.pixelX,
            pixelY: sprite.pixelY,
            facingDirection: sprite.facingDirection,
            animFrame: sprite.animFrame,
            isWalking: sprite.movementStatus === 3,
            pictureId: sprite.pictureId
        }));
    }

    /**
     * Reset a sprite to its original position
     */
    resetSprite(index) {
        const sprite = this.sprites[index];
        if (sprite) {
            sprite.pixelX = sprite.x * 16;
            sprite.pixelY = sprite.y * 16;
            sprite.targetPixelX = sprite.x * 16;
            sprite.targetPixelY = sprite.y * 16;
            sprite.movementStatus = 1;
            sprite.yDisplacement = 8;
            sprite.xDisplacement = 8;
        }
    }

    /**
     * Reset all sprites
     */
    resetAllSprites() {
        for (let i = 0; i < this.sprites.length; i++) {
            this.resetSprite(i);
        }
    }
}
