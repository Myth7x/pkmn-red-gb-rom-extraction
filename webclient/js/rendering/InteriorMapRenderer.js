/**
 * InteriorMapRenderer.js
 * 
 * Renders interior map layouts with multiple connected rooms.
 * Draws rooms side-by-side with connection indicators.
 * Refactored to extend BaseRenderer and use specialized renderer modules.
 */

import { Logger } from '../utils/Logger.js';
import { BaseRenderer } from './BaseRenderer.js';
import { ConnectionRenderer } from './ConnectionRenderer.js';
import { TILE_SIZE, BLOCK_SIZE } from '../core/Constants.js';

// Version: Update patch number for bug fixes, minor for new features, major for breaking changes
export const MODULE_VERSION = '2.0.0';

export class InteriorMapRenderer extends BaseRenderer {
    constructor(canvas, ctx, tilesetManager, collisionTileManager, tileAnimator, spriteManager) {
        super(canvas, ctx, tilesetManager, spriteManager, tileAnimator);
        
        this.collisionTileManager = collisionTileManager;
        
        // Initialize connection renderer
        this.connectionRenderer = new ConnectionRenderer({ 
            ctx: this.ctx,
            drawLine: this.drawLine.bind(this),
            drawCircle: this.drawCircle.bind(this),
            drawRect: this.drawRect.bind(this),
            drawText: this.drawText.bind(this),
            setAlpha: this.setAlpha.bind(this),
            resetAlpha: this.resetAlpha.bind(this)
        });
        
        this.showConnections = true;
        this.showWarpPoints = true;
        this.showDragOverlay = false;
    }
    
    /**
     * Set whether to show collision overlays
     * @param {boolean} show - Whether to show collision overlays
     */
    setShowCollisionOverlays(show) {
        this.setShowOverlays(show);
        this.showConnections = show;
        this.showWarpPoints = show;
    }
    
    /**
     * Set the currently hovered connection for highlighting
     * @param {Object|null} connection - Hovered connection data or null
     */
    setHoveredConnection(connection) {
        this.connectionRenderer.setHoveredConnection(connection);
    }
    
    /**
     * Set whether to show drag overlay (Ctrl key pressed)
     * @param {boolean} show - Whether to show drag overlay
     */
    setShowDragOverlay(show) {
        this.showDragOverlay = show;
    }

    /**
     * Render an entire interior layout with all connected rooms
     * @param {Object} renderContext - Rendering context containing layout, scale, offsets, etc.
     */
    render(renderContext) {
        const {
            layout,
            scale,
            cameraOffsetX = 0,
            cameraOffsetY = 0,
            mainMapId = null,
            movementEngine,
            movementEnabled
        } = renderContext;

        if (!layout || !layout.rooms || layout.rooms.length === 0) {
            Logger.warn('No layout to render');
            return;
        }
        
        // Clear canvas
        this.clear('#000');
        
        // Render each room
        for (const room of layout.rooms) {
            const isMainRoom = room.mapData.mapId === mainMapId;
            this.renderRoom(room, scale, cameraOffsetX, cameraOffsetY, isMainRoom);
        }
        
        // Draw connections between rooms
        if (this.showConnections) {
            this.connectionRenderer.renderConnections(layout, scale, cameraOffsetX, cameraOffsetY);
        }
        
        // Draw room labels (only when overlays are shown)
        if (this.showOverlays) {
            this.connectionRenderer.renderRoomLabels(layout, scale, cameraOffsetX, cameraOffsetY, mainMapId);
        }
        
        // Render overlays and sprites for the main map only
        const mainRoom = layout.rooms.find(room => room.mapData.mapId === mainMapId);
        if (mainRoom && this.showOverlays) {
            const mainRoomOffsetX = cameraOffsetX + (mainRoom.offsetX * BLOCK_SIZE * TILE_SIZE * scale);
            const mainRoomOffsetY = cameraOffsetY + (mainRoom.offsetY * BLOCK_SIZE * TILE_SIZE * scale);
            const mainRoomOffset = { x: mainRoomOffsetX, y: mainRoomOffsetY };
            
            // Render sprites for main room
            if (mainRoom.mapData && mainRoom.mapData.objects && mainRoom.mapData.objects.sprites) {
                this.renderMapSprites(mainRoom.mapData, mainRoomOffset, scale, movementEngine, movementEnabled);
            }
        }
        
        // Draw grid if enabled
        if (this.showGrid && scale >= 2) {
            this.gridRenderer.renderGrid(cameraOffsetX, cameraOffsetY, scale, this.canvas.width, this.canvas.height);
        }
        
        // Show drag overlay at top center of screen
        if (this.showDragOverlay) {
            this.connectionRenderer.renderDragOverlay(this.canvas.width);
        }
    }

    /**
     * Render an entire interior layout (legacy method for backward compatibility)
     * @param {Object} layout - Layout data from InteriorMapLayoutManager
     * @param {number} scale - Render scale
     * @param {number} cameraOffsetX - Camera X offset for panning
     * @param {number} cameraOffsetY - Camera Y offset for panning
     * @param {number} mainMapId - The ID of the main/current map (for highlighting)
     */
    renderInteriorLayout(layout, scale, cameraOffsetX = 0, cameraOffsetY = 0, mainMapId = null) {
        this.render({
            layout,
            scale,
            cameraOffsetX,
            cameraOffsetY,
            mainMapId,
            movementEngine: null,
            movementEnabled: false
        });
    }
    
    /**
     * Render a single room in the layout
     * @param {Object} room - Room data with mapData and offset
     * @param {number} scale - Render scale
     * @param {number} cameraOffsetX - Camera X offset
     * @param {number} cameraOffsetY - Camera Y offset
     * @param {boolean} isMainRoom - Whether this is the currently selected main room
     */
    renderRoom(room, scale, cameraOffsetX, cameraOffsetY, isMainRoom = false) {
        const mapData = room.mapData;
        
        // Calculate base position in pixels
        const baseX = (room.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetX;
        const baseY = (room.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetY;
        
        // Draw room border (highlight main room with different color)
        const borderColor = isMainRoom ? '#00ff00' : '#ffcc00';
        const borderWidth = isMainRoom ? 3 : 2;
        this.drawRect(
            baseX,
            baseY,
            mapData.width * BLOCK_SIZE * TILE_SIZE * scale,
            mapData.height * BLOCK_SIZE * TILE_SIZE * scale,
            borderColor,
            false,
            borderWidth
        );
        
        // Render tiles using TileRenderer
        const showCollision = isMainRoom && this.showOverlays;
        this.tileRenderer.renderMapTiles(mapData, baseX, baseY, scale, showCollision, null);
        
        // Draw warp points
        if (this.showWarpPoints && room.warps) {
            this.overlayRenderer.renderWarpCircles(room.warps, baseX, baseY, scale);
        }
    }

    /**
     * Render sprites for a map (interior layout mode)
     * @param {Object} mapData - Map data
     * @param {Object} offset - Viewport offset
     * @param {number} scale - Render scale
     * @param {Object} movementEngine - Movement engine instance
     * @param {boolean} movementEnabled - Whether movement is enabled
     */
    renderMapSprites(mapData, offset, scale, movementEngine, movementEnabled) {
        if (!mapData.objects || !mapData.objects.sprites || !mapData.objects.sprites.data) return;

        const spritePositions = movementEnabled ? movementEngine.getSpritePositions() : null;

        mapData.objects.sprites.data.forEach((sprite, index) => {
            let spriteX = sprite.x;
            let spriteY = sprite.y;
            let facingDirection = null;
            let animFrame = 0;
            let isWalking = false;

            if (spritePositions && spritePositions[index]) {
                const pos = spritePositions[index];
                spriteX = pos.pixelX / 16;
                spriteY = pos.pixelY / 16;
                if (pos.isWalking) {
                    facingDirection = pos.facingDirection;
                }
                animFrame = pos.animFrame;
                isWalking = pos.isWalking;
            }

            const x = offset.x + spriteX * 2 * TILE_SIZE * scale;
            const y = offset.y + spriteY * 2 * TILE_SIZE * scale;

            // Render the sprite
            this.spriteRenderer.renderSprite(
                sprite,
                x,
                y,
                scale,
                this.showOverlays,
                facingDirection,
                animFrame,
                isWalking
            );
        });
    }

    /**
     * Toggle connection line visibility
     */
    toggleConnections() {
        this.showConnections = !this.showConnections;
        return this.showConnections;
    }
    
    /**
     * Toggle warp point visibility
     */
    toggleWarpPoints() {
        this.showWarpPoints = !this.showWarpPoints;
        return this.showWarpPoints;
    }
}
