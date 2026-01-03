/**
 * NormalMapRenderer.js
 * 
 * Renders maps in normal mode (single map or with connected maps).
 * Extends BaseRenderer with specialized rendering logic for outdoor and indoor maps.
 */

import { BaseRenderer } from './BaseRenderer.js';
import { TILE_SIZE, BLOCK_SIZE } from '../core/Constants.js';

export const MODULE_VERSION = '1.0.0';

export class NormalMapRenderer extends BaseRenderer {
    constructor(canvas, ctx, tilesetManager, spriteManager, tileAnimator) {
        super(canvas, ctx, tilesetManager, spriteManager, tileAnimator);
    }

    /**
     * Render map in normal mode
     * @param {Object} renderContext - Rendering context
     */
    render(renderContext) {
        const {
            currentMap,
            connectedMaps,
            scale,
            offset,
            movementEngine,
            movementEnabled
        } = renderContext;

        if (!currentMap) return;

        // Clear canvas
        this.clear('#000');

        // Check if this is an interior map (no connections)
        const isInteriorMap = !currentMap.connections || 
                             (!currentMap.connections.north && 
                              !currentMap.connections.south && 
                              !currentMap.connections.east && 
                              !currentMap.connections.west);

        if (isInteriorMap) {
            // Render single map
            this.renderMapAtOffset(currentMap, 0, 0, scale, offset, true);
        } else {
            // Render with connected maps
            if (connectedMaps && connectedMaps.length > 0) {
                for (const { map, offsetX, offsetY, isMainMap } of connectedMaps) {
                    this.renderMapAtOffset(map, offsetX, offsetY, scale, offset, isMainMap);
                }
            } else {
                // Fallback: render only main map
                this.renderMapAtOffset(currentMap, 0, 0, scale, offset, true);
            }
        }

        // Render overlays for main map
        if (this.showOverlays) {
            this.renderMapOverlays(currentMap, offset, scale);
        }

        // Render sprites for main map
        this.renderMapSprites(currentMap, offset, scale, movementEngine, movementEnabled);

        // Render grid if enabled
        if (this.showGrid && scale >= 2) {
            this.gridRenderer.renderGrid(offset.x, offset.y, scale, this.canvas.width, this.canvas.height);
        }

        // Render map boundary
        const mapWidthScreen = currentMap.width * BLOCK_SIZE * TILE_SIZE * scale;
        const mapHeightScreen = currentMap.height * BLOCK_SIZE * TILE_SIZE * scale;
        this.overlayRenderer.renderMapBoundary(offset.x, offset.y, mapWidthScreen, mapHeightScreen, '#ff0', 1);
        this.overlayRenderer.renderMapBoundary(offset.x - 1, offset.y - 1, mapWidthScreen + 2, mapHeightScreen + 2, '#f00', 1);
    }

    /**
     * Render a single map at a specific offset
     * @param {Object} mapData - Map data to render
     * @param {number} offsetXBlocks - X offset in blocks
     * @param {number} offsetYBlocks - Y offset in blocks
     * @param {number} scale - Rendering scale
     * @param {Object} viewportOffset - Viewport offset {x, y}
     * @param {boolean} isMainMap - Whether this is the main map
     */
    renderMapAtOffset(mapData, offsetXBlocks, offsetYBlocks, scale, viewportOffset, isMainMap = false) {
        if (!this.tilesetManager.hasTileset(mapData.tileset)) return;

        const mapOffsetX = offsetXBlocks * BLOCK_SIZE * TILE_SIZE * scale;
        const mapOffsetY = offsetYBlocks * BLOCK_SIZE * TILE_SIZE * scale;

        const baseX = viewportOffset.x + mapOffsetX;
        const baseY = viewportOffset.y + mapOffsetY;

        // Calculate visible area (if optimization enabled)
        let visibleArea = null;
        if (this.tileOptimizationEnabled) {
            const startX = Math.max(0, Math.floor((-viewportOffset.x - mapOffsetX) / (BLOCK_SIZE * TILE_SIZE * scale)));
            const startY = Math.max(0, Math.floor((-viewportOffset.y - mapOffsetY) / (BLOCK_SIZE * TILE_SIZE * scale)));
            const endX = Math.min(mapData.width - 1, Math.ceil((this.canvas.width - viewportOffset.x - mapOffsetX) / (BLOCK_SIZE * TILE_SIZE * scale)));
            const endY = Math.min(mapData.height - 1, Math.ceil((this.canvas.height - viewportOffset.y - mapOffsetY) / (BLOCK_SIZE * TILE_SIZE * scale)));

            // Only render if visible
            if (startX > mapData.width || startY > mapData.height || endX < 0 || endY < 0) {
                return;
            }

            visibleArea = { startX, startY, endX, endY };
        }

        // Render map tiles with collision indicators only for main map
        const showCollision = isMainMap && this.showOverlays && scale >= 0.75;
        this.tileRenderer.renderMapTiles(mapData, baseX, baseY, scale, showCollision, visibleArea);
    }

    /**
     * Render overlays for a map (warps, signs, boundary connections)
     * @param {Object} mapData - Map data
     * @param {Object} offset - Viewport offset
     * @param {number} scale - Render scale
     */
    renderMapOverlays(mapData, offset, scale) {
        // Render warps
        if (mapData.objects && mapData.objects.warps && mapData.objects.warps.data) {
            this.overlayRenderer.renderWarps(mapData.objects.warps.data, offset.x, offset.y, scale);
        }

        // Render signs
        if (mapData.objects && mapData.objects.signs && mapData.objects.signs.data) {
            this.overlayRenderer.renderSigns(mapData.objects.signs.data, offset.x, offset.y, scale);
        }

        // Render boundary connections
        if (mapData.connections) {
            this.overlayRenderer.renderBoundaryConnections(
                mapData.connections,
                offset.x,
                offset.y,
                mapData.width,
                mapData.height,
                scale
            );
        }
    }

    /**
     * Render sprites for a map
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

            // Get animated position if available
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

            // Draw movement path if overlays enabled and movement disabled
            if (this.showOverlays && !movementEnabled) {
                const tileSize = 2 * TILE_SIZE * scale;
                this.spriteRenderer.renderMovementPath(sprite, x, y, tileSize);
            }

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
}
