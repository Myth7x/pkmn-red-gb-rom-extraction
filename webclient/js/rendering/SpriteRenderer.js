/**
 * SpriteRenderer.js
 * 
 * Handles rendering of NPC sprites and movement indicators.
 * Shared by both normal and interior map rendering modes.
 */

import { TILE_SIZE } from '../core/Constants.js';

export const MODULE_VERSION = '1.0.0';

export class SpriteRenderer {
    constructor(canvasRenderer, spriteManager, tilesetManager) {
        this.renderer = canvasRenderer;
        this.spriteManager = spriteManager;
        this.tilesetManager = tilesetManager;
    }

    /**
     * Get sprite facing direction and frame info
     * @param {Object} sprite - Sprite data from map
     * @param {number} facingDirection - Facing direction from movement engine
     * @param {number} animFrame - Animation frame
     * @param {boolean} isWalking - Whether sprite is currently walking
     * @returns {Object} - {facing: string, frameX: number, frameY: number, mirror: boolean}
     */
    getSpriteFrame(sprite, facingDirection = null, animFrame = 0, isWalking = false) {
        let facing = 0; // Default to DOWN (0)
        
        // Priority 1: Check raw byte2 for STAY movement (0xD0-0xD3 are facing directions)
        if (sprite.movement && sprite.movement.byte1 === 0xFF && sprite.movement.byte2 >= 0xD0 && sprite.movement.byte2 <= 0xD3) {
            switch (sprite.movement.byte2) {
                case 0xD0: facing = 0x00; break; // DOWN
                case 0xD1: facing = 0x04; break; // UP
                case 0xD2: facing = 0x08; break; // LEFT
                case 0xD3: facing = 0x0C; break; // RIGHT
            }
        }
        // Priority 2: Movement engine provides facing direction
        else if (facingDirection !== null && facingDirection !== undefined) {
            facing = facingDirection;
        }
        // Priority 3: Sprite data has movement direction string
        else if (sprite.movement && sprite.movement.direction) {
            switch (sprite.movement.direction) {
                case 'DOWN': facing = 0x00; break;
                case 'UP': facing = 0x04; break;
                case 'LEFT': facing = 0x08; break;
                case 'RIGHT': facing = 0x0C; break;
                case 'NONE':
                default: facing = 0x00; break;
            }
        }
        
        // Map facing direction to sprite sheet position
        let frameX = 0, frameY = 0, mirror = false, facingName = 'down';
        
        if (facing === 0x00) { // DOWN
            frameX = 0;
            facingName = 'down';
        } else if (facing === 0x04) { // UP
            frameX = 16;
            facingName = 'up';
        } else if (facing === 0x08) { // LEFT
            frameX = 32;
            facingName = 'left';
        } else if (facing === 0x0C) { // RIGHT
            frameX = 32;
            mirror = true;
            facingName = 'right';
        }
        
        return { facing: facingName, frameX, frameY, mirror };
    }

    /**
     * Render a single sprite
     * @param {Object} sprite - Sprite data
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} scale - Render scale
     * @param {boolean} showOverlays - Whether to show overlay indicators
     * @param {number} facingDirection - Facing direction from movement engine
     * @param {number} animFrame - Animation frame
     * @param {boolean} isWalking - Whether sprite is walking
     * @returns {boolean} - True if sprite was rendered successfully
     */
    renderSprite(sprite, x, y, scale, showOverlays = false, facingDirection = null, animFrame = 0, isWalking = false) {
        const size = 2 * TILE_SIZE * scale;
        const spriteFileId = sprite.pictureId - 1; // ROM uses 1-based, files use 0-based
        
        // Skip invalid sprite IDs
        if (spriteFileId > 71 || spriteFileId < 0) {
            return false;
        }
        
        const spriteImg = this.spriteManager.getSpriteImage(spriteFileId);
        
        if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
            const frameInfo = this.getSpriteFrame(sprite, facingDirection, animFrame, isWalking);
            
            this.renderer.save();
            
            // Apply horizontal flip for right-facing sprites
            if (frameInfo.mirror) {
                this.renderer.translate(x + size, y);
                this.renderer.scale(-1, 1);
                this.renderer.drawImage(
                    spriteImg,
                    frameInfo.frameX, frameInfo.frameY, 16, 16,
                    0, 0, size, size
                );
            } else {
                this.renderer.drawImage(
                    spriteImg,
                    frameInfo.frameX, frameInfo.frameY, 16, 16,
                    x, y, size, size
                );
            }
            
            this.renderer.restore();
            
            // Draw overlay indicator if enabled
            if (showOverlays) {
                this.renderSpriteOverlay(x, y, size, frameInfo);
            }
            
            return true;
        } else {
            // Fallback indicator
            this.renderSpriteFallback(x, y, size);
            
            // Try to load sprite asynchronously
            this.spriteManager.loadSprite(spriteFileId);
            
            return false;
        }
    }

    /**
     * Render sprite overlay indicator
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} size - Sprite size
     * @param {Object} frameInfo - Frame information {facing, frameX, frameY, mirror}
     */
    renderSpriteOverlay(x, y, size, frameInfo) {
        this.renderer.setAlpha(0.36);
        this.renderer.drawRect(x, y, size, size, 'rgba(50, 255, 50, 1.0)', true);
        this.renderer.resetAlpha();
        
        // Draw N label in center
        const fontSize = Math.max(12, Math.min(20, size * 0.4));
        this.renderer.drawText('N', x + size / 2, y + size / 2, {
            font: `bold ${fontSize}px "Courier New"`,
            color: '#fff',
            align: 'center',
            baseline: 'middle',
            shadow: true
        });
        
        // Draw facing direction in top-left corner
        const facingShort = frameInfo.facing.charAt(0).toUpperCase();
        const smallFontSize = Math.max(8, Math.min(12, size * 0.25));
        this.renderer.drawText(facingShort, x + 3, y + 3, {
            font: `bold ${smallFontSize}px "Courier New"`,
            color: '#ffff00',
            align: 'left',
            baseline: 'top',
            shadow: true
        });
        
        // Draw frame index in top-right corner
        const frameIdx = Math.floor(frameInfo.frameX / 16);
        this.renderer.drawText(frameIdx.toString(), x + size - 3, y + 3, {
            font: `bold ${smallFontSize}px "Courier New"`,
            color: '#00ffff',
            align: 'right',
            baseline: 'top',
            shadow: true
        });
    }

    /**
     * Render fallback indicator when sprite not loaded
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} size - Sprite size
     */
    renderSpriteFallback(x, y, size) {
        this.renderer.setAlpha(0.5);
        this.renderer.drawRect(x, y, size, size, '#f0f', true);
        this.renderer.resetAlpha();
        
        const fontSize = Math.max(12, Math.min(20, size * 0.4));
        this.renderer.drawText('N', x + size / 2, y + size / 2, {
            font: `bold ${fontSize}px "Courier New"`,
            color: '#fff',
            align: 'center',
            baseline: 'middle',
            shadow: true
        });
    }

    /**
     * Render movement path visualization for an NPC
     * @param {Object} sprite - Sprite data
     * @param {number} centerX - Center X position
     * @param {number} centerY - Center Y position
     * @param {number} tileSize - Tile size in pixels (already scaled)
     */
    renderMovementPath(sprite, centerX, centerY, tileSize) {
        if (!sprite.movement) return;
        
        const movement = sprite.movement;
        
        // Draw facing indicator for stationary NPCs
        if (movement.type === 'STAY') {
            if (movement.direction && movement.direction !== 'NONE') {
                this.drawFacingArrow(centerX, centerY, tileSize, movement.direction);
            }
            return;
        }
        
        const range = sprite.range || 0;
        if (range === 0) return;
        
        this.renderer.save();
        this.renderer.setAlpha(0.15);
        
        switch (movement.type) {
            case 'WALK':
                this.renderWalkMovementArea(movement, centerX, centerY, tileSize, range);
                break;
            case 'LOOK':
                this.renderLookMovementArea(centerX, centerY, tileSize);
                break;
        }
        
        this.renderer.resetAlpha();
        this.renderer.restore();
    }

    /**
     * Render walk movement area
     * @param {Object} movement - Movement data
     * @param {number} centerX - Center X position
     * @param {number} centerY - Center Y position
     * @param {number} tileSize - Tile size
     * @param {number} range - Movement range
     */
    renderWalkMovementArea(movement, centerX, centerY, tileSize, range) {
        switch (movement.direction) {
            case 'ANY_DIR':
                const areaSize = (range * 2 + 1) * tileSize;
                const areaX = centerX - range * tileSize;
                const areaY = centerY - range * tileSize;
                this.renderer.drawRect(areaX, areaY, areaSize, areaSize, 'rgba(100, 200, 255, 0.8)', true);
                this.renderer.setStrokeStyle('rgba(50, 150, 255, 0.8)', 2);
                this.renderer.drawRect(areaX, areaY, areaSize, areaSize, 'rgba(50, 150, 255, 0.8)', false);
                break;
            case 'UP_DOWN':
                const vHeight = (range * 2 + 1) * tileSize;
                const vY = centerY - range * tileSize;
                this.renderer.drawRect(centerX, vY, tileSize, vHeight, 'rgba(100, 255, 200, 0.8)', true);
                this.renderer.setStrokeStyle('rgba(50, 255, 150, 0.8)', 2);
                this.renderer.drawRect(centerX, vY, tileSize, vHeight, 'rgba(50, 255, 150, 0.8)', false);
                break;
            case 'LEFT_RIGHT':
                const hWidth = (range * 2 + 1) * tileSize;
                const hX = centerX - range * tileSize;
                this.renderer.drawRect(hX, centerY, hWidth, tileSize, 'rgba(255, 200, 100, 0.8)', true);
                this.renderer.setStrokeStyle('rgba(255, 150, 50, 0.8)', 2);
                this.renderer.drawRect(hX, centerY, hWidth, tileSize, 'rgba(255, 150, 50, 0.8)', false);
                break;
        }
    }

    /**
     * Render look movement area
     * @param {number} centerX - Center X position
     * @param {number} centerY - Center Y position
     * @param {number} tileSize - Tile size
     */
    renderLookMovementArea(centerX, centerY, tileSize) {
        const radius = tileSize * 0.8;
        this.renderer.drawCircle(
            centerX + tileSize / 2,
            centerY + tileSize / 2,
            radius,
            'rgba(255, 255, 100, 0.6)',
            true
        );
    }

    /**
     * Draw facing direction arrow for stationary NPCs
     * @param {number} x - NPC x position
     * @param {number} y - NPC y position
     * @param {number} size - Tile size
     * @param {string} direction - Direction ('UP', 'DOWN', 'LEFT', 'RIGHT')
     */
    drawFacingArrow(x, y, size, direction) {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const arrowSize = size * 0.3;
        
        this.renderer.save();
        this.renderer.setAlpha(0.7);
        this.renderer.setStrokeStyle('rgba(255, 255, 0, 0.9)', 3);
        
        switch (direction) {
            case 'UP':
                this.renderer.drawLine(centerX, centerY, centerX, centerY - arrowSize);
                this.renderer.drawLine(centerX, centerY - arrowSize, centerX - arrowSize / 3, centerY - arrowSize * 0.6);
                this.renderer.drawLine(centerX, centerY - arrowSize, centerX + arrowSize / 3, centerY - arrowSize * 0.6);
                break;
            case 'DOWN':
                this.renderer.drawLine(centerX, centerY, centerX, centerY + arrowSize);
                this.renderer.drawLine(centerX, centerY + arrowSize, centerX - arrowSize / 3, centerY + arrowSize * 0.6);
                this.renderer.drawLine(centerX, centerY + arrowSize, centerX + arrowSize / 3, centerY + arrowSize * 0.6);
                break;
            case 'LEFT':
                this.renderer.drawLine(centerX, centerY, centerX - arrowSize, centerY);
                this.renderer.drawLine(centerX - arrowSize, centerY, centerX - arrowSize * 0.6, centerY - arrowSize / 3);
                this.renderer.drawLine(centerX - arrowSize, centerY, centerX - arrowSize * 0.6, centerY + arrowSize / 3);
                break;
            case 'RIGHT':
                this.renderer.drawLine(centerX, centerY, centerX + arrowSize, centerY);
                this.renderer.drawLine(centerX + arrowSize, centerY, centerX + arrowSize * 0.6, centerY - arrowSize / 3);
                this.renderer.drawLine(centerX + arrowSize, centerY, centerX + arrowSize * 0.6, centerY + arrowSize / 3);
                break;
        }
        
        this.renderer.resetAlpha();
        this.renderer.restore();
    }
}
