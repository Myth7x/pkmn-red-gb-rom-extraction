/**
 * PlayerState.js
 * 
 * Manages the player state including position, direction, and current map.
 * Only used in game mode.
 */

export const MODULE_VERSION = '1.0.0';

export class PlayerState {
    constructor() {
        // Player position in tiles
        this.x = 0;
        this.y = 0;
        
        // Player position in pixels (for smooth movement)
        this.pixelX = 0;
        this.pixelY = 0;
        
        // Current map ID
        this.mapId = null;
        this.mapName = null;
        
        // Facing direction (0x00 = DOWN, 0x04 = UP, 0x08 = LEFT, 0x0C = RIGHT)
        this.facing = 0x00;
        
        // Movement state
        this.isMoving = false;
        this.moveProgress = 0; // 0-1 for interpolation
        this.moveStartX = 0;
        this.moveStartY = 0;
        this.moveTargetX = 0;
        this.moveTargetY = 0;
        
        // Animation
        this.animFrame = 0;
        this.animTimer = 0;
        
        // Sprite info
        this.spriteId = 0; // RED = 0
        this.spriteName = 'RED';
    }
    
    /**
     * Set player position
     * @param {number} x - X position in tiles
     * @param {number} y - Y position in tiles
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.pixelX = x * 16;
        this.pixelY = y * 16;
    }
    
    /**
     * Set current map
     * @param {number} mapId - Map ID
     * @param {string} mapName - Map name
     */
    setMap(mapId, mapName) {
        this.mapId = mapId;
        this.mapName = mapName;
    }
    
    /**
     * Set facing direction
     * @param {number} direction - Direction (0x00=DOWN, 0x04=UP, 0x08=LEFT, 0x0C=RIGHT)
     */
    setFacing(direction) {
        this.facing = direction;
    }
    
    /**
     * Get facing direction as string
     * @returns {string} - 'down', 'up', 'left', 'right'
     */
    getFacingString() {
        switch (this.facing) {
            case 0x00: return 'down';
            case 0x04: return 'up';
            case 0x08: return 'left';
            case 0x0C: return 'right';
            default: return 'down';
        }
    }
    
    /**
     * Start movement to a new tile
     * @param {number} targetX - Target X in tiles
     * @param {number} targetY - Target Y in tiles
     */
    startMovement(targetX, targetY) {
        this.isMoving = true;
        this.moveProgress = 0;
        this.moveStartX = this.x;
        this.moveStartY = this.y;
        this.moveTargetX = targetX;
        this.moveTargetY = targetY;
    }
    
    /**
     * Update movement progress
     * @param {number} delta - Time delta in seconds
     * @param {number} speed - Movement speed in tiles per second
     */
    updateMovement(delta, speed = 4) {
        if (!this.isMoving) return;
        
        this.moveProgress += delta * speed;
        
        if (this.moveProgress >= 1) {
            // Movement complete
            this.moveProgress = 1;
            this.x = this.moveTargetX;
            this.y = this.moveTargetY;
            this.pixelX = this.x * 16;
            this.pixelY = this.y * 16;
            this.isMoving = false;
        } else {
            // Interpolate position
            this.pixelX = this.moveStartX * 16 + (this.moveTargetX - this.moveStartX) * 16 * this.moveProgress;
            this.pixelY = this.moveStartY * 16 + (this.moveTargetY - this.moveStartY) * 16 * this.moveProgress;
        }
    }
    
    /**
     * Update animation
     * @param {number} delta - Time delta in seconds
     */
    updateAnimation(delta) {
        if (this.isMoving) {
            this.animTimer += delta;
            if (this.animTimer >= 0.15) { // Change frame every 150ms
                this.animFrame = (this.animFrame + 1) % 2;
                this.animTimer = 0;
            }
        } else {
            this.animFrame = 0;
            this.animTimer = 0;
        }
    }
    
    /**
     * Get player state snapshot
     * @returns {Object}
     */
    getSnapshot() {
        return {
            x: this.x,
            y: this.y,
            pixelX: this.pixelX,
            pixelY: this.pixelY,
            mapId: this.mapId,
            mapName: this.mapName,
            facing: this.facing,
            facingString: this.getFacingString(),
            isMoving: this.isMoving,
            animFrame: this.animFrame,
            spriteId: this.spriteId,
            spriteName: this.spriteName
        };
    }
}
