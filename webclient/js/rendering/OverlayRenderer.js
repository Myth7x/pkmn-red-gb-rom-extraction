/**
 * OverlayRenderer.js
 * 
 * Handles rendering of overlays like warps, signs, NPCs indicators, and boundary connections.
 * Shared by both normal and interior map rendering modes.
 */

import { TILE_SIZE, BLOCK_SIZE } from '../core/Constants.js';

export const MODULE_VERSION = '1.0.0';

export class OverlayRenderer {
    constructor(canvasRenderer) {
        this.renderer = canvasRenderer;
    }

    /**
     * Render warp points
     * @param {Array} warps - Array of warp data
     * @param {number} offsetX - Base X offset
     * @param {number} offsetY - Base Y offset
     * @param {number} scale - Render scale
     */
    renderWarps(warps, offsetX, offsetY, scale) {
        if (!warps || warps.length === 0) return;
        
        warps.forEach((warp, index) => {
            const x = offsetX + warp.x * 2 * TILE_SIZE * scale;
            const y = offsetY + warp.y * 2 * TILE_SIZE * scale;
            const size = 2 * TILE_SIZE * scale;
            
            // Draw warp indicator
            this.renderer.setAlpha(0.5);
            this.renderer.drawRect(x, y, size, size, '#00f', true);
            this.renderer.resetAlpha();
            
            // Draw W label
            const fontSize = Math.max(12, Math.min(20, size * 0.4));
            this.renderer.drawText('W', x + size / 2, y + size / 2, {
                font: `bold ${fontSize}px "Courier New"`,
                color: '#fff',
                align: 'center',
                baseline: 'middle',
                shadow: true
            });
        });
    }

    /**
     * Render warp points as circles with IDs (for interior layout mode)
     * @param {Array} warps - Array of warp data
     * @param {number} baseX - Base X position
     * @param {number} baseY - Base Y position
     * @param {number} scale - Render scale
     */
    renderWarpCircles(warps, baseX, baseY, scale) {
        if (!warps || warps.length === 0) return;
        
        for (const warp of warps) {
            const warpX = baseX + (warp.x * 2 * TILE_SIZE * scale);
            const warpY = baseY + (warp.y * 2 * TILE_SIZE * scale);
            const warpSizePixels = 2 * TILE_SIZE * scale;
            
            // Draw warp indicator (blue circle)
            this.renderer.drawCircle(
                warpX + (warpSizePixels / 2),
                warpY + (warpSizePixels / 2),
                warpSizePixels / 3,
                'rgba(0, 100, 255, 0.6)',
                true
            );
            
            // Draw warp ID
            const fontSize = Math.max(10, 10 * scale);
            this.renderer.drawText(
                `W${warp.warpId}`,
                warpX + (warpSizePixels / 2),
                warpY + (warpSizePixels / 2),
                {
                    font: `bold ${fontSize}px monospace`,
                    color: 'white',
                    align: 'center',
                    baseline: 'middle',
                    shadow: false
                }
            );
        }
    }

    /**
     * Render signs
     * @param {Array} signs - Array of sign data
     * @param {number} offsetX - Base X offset
     * @param {number} offsetY - Base Y offset
     * @param {number} scale - Render scale
     */
    renderSigns(signs, offsetX, offsetY, scale) {
        if (!signs || signs.length === 0) return;
        
        signs.forEach((sign, index) => {
            const x = offsetX + sign.x * 2 * TILE_SIZE * scale;
            const y = offsetY + sign.y * 2 * TILE_SIZE * scale;
            const size = 2 * TILE_SIZE * scale;
            
            // Draw sign indicator
            this.renderer.setAlpha(0.5);
            this.renderer.drawRect(x, y, size, size, '#ff0', true);
            this.renderer.resetAlpha();
            
            // Draw S label
            const fontSize = Math.max(12, Math.min(20, size * 0.4));
            this.renderer.drawText('S', x + size / 2, y + size / 2, {
                font: `bold ${fontSize}px "Courier New"`,
                color: '#000',
                align: 'center',
                baseline: 'middle',
                shadow: true
            });
        });
    }

    /**
     * Render boundary connections (edges where maps connect)
     * @param {Object} connections - Connection data (north, south, east, west)
     * @param {number} offsetX - Base X offset
     * @param {number} offsetY - Base Y offset
     * @param {number} mapWidth - Map width in blocks
     * @param {number} mapHeight - Map height in blocks
     * @param {number} scale - Render scale
     */
    renderBoundaryConnections(connections, offsetX, offsetY, mapWidth, mapHeight, scale) {
        if (!connections) return;
        
        const connectionWidth = TILE_SIZE * scale;
        const mapWidthScreen = mapWidth * BLOCK_SIZE * TILE_SIZE * scale;
        const mapHeightScreen = mapHeight * BLOCK_SIZE * TILE_SIZE * scale;
        
        // North connection (top edge)
        if (connections.north) {
            this.renderer.setAlpha(0.8);
            this.renderer.drawRect(offsetX, offsetY, mapWidthScreen, connectionWidth, 'rgba(255, 140, 0, 1.0)', true);
            this.renderer.resetAlpha();
        }
        
        // South connection (bottom edge)
        if (connections.south) {
            this.renderer.setAlpha(0.8);
            this.renderer.drawRect(offsetX, offsetY + mapHeightScreen - connectionWidth, mapWidthScreen, connectionWidth, 'rgba(255, 140, 0, 1.0)', true);
            this.renderer.resetAlpha();
        }
        
        // West connection (left edge)
        if (connections.west) {
            this.renderer.setAlpha(0.8);
            this.renderer.drawRect(offsetX, offsetY, connectionWidth, mapHeightScreen, 'rgba(255, 140, 0, 1.0)', true);
            this.renderer.resetAlpha();
        }
        
        // East connection (right edge)
        if (connections.east) {
            this.renderer.setAlpha(0.8);
            this.renderer.drawRect(offsetX + mapWidthScreen - connectionWidth, offsetY, connectionWidth, mapHeightScreen, 'rgba(255, 140, 0, 1.0)', true);
            this.renderer.resetAlpha();
        }
    }

    /**
     * Render map boundary rectangle
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width in pixels
     * @param {number} height - Height in pixels
     * @param {string} color - Border color
     * @param {number} lineWidth - Line width
     */
    renderMapBoundary(x, y, width, height, color = '#ff0', lineWidth = 1) {
        this.renderer.setAlpha(1.0);
        this.renderer.drawRect(x, y, width, height, color, false, lineWidth);
        this.renderer.resetAlpha();
    }
}
