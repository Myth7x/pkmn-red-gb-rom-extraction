/**
 * GridRenderer.js
 * 
 * Handles rendering of grid overlays.
 * Shared by both normal and interior map rendering modes.
 */

import { TILE_SIZE, BLOCK_SIZE } from '../core/Constants.js';

export const MODULE_VERSION = '1.0.0';

export class GridRenderer {
    constructor(canvasRenderer) {
        this.renderer = canvasRenderer;
    }

    /**
     * Render grid overlay
     * @param {number} offsetX - Camera X offset
     * @param {number} offsetY - Camera Y offset
     * @param {number} scale - Render scale
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     */
    renderGrid(offsetX, offsetY, scale, canvasWidth, canvasHeight) {
        // Calculate visible blocks for grid
        const startX = Math.floor(-offsetX / (BLOCK_SIZE * TILE_SIZE * scale));
        const startY = Math.floor(-offsetY / (BLOCK_SIZE * TILE_SIZE * scale));
        const endX = Math.ceil((canvasWidth - offsetX) / (BLOCK_SIZE * TILE_SIZE * scale));
        const endY = Math.ceil((canvasHeight - offsetY) / (BLOCK_SIZE * TILE_SIZE * scale));
        
        // Calculate line width based on zoom level
        const lineWidth = Math.max(0.5, Math.min(1, scale / 2));
        
        this.renderer.setAlpha(0.15);
        
        // Draw vertical grid lines
        for (let x = startX; x <= endX; x++) {
            const screenX = offsetX + x * BLOCK_SIZE * TILE_SIZE * scale;
            this.renderer.drawLine(screenX, 0, screenX, canvasHeight, '#fff', lineWidth);
        }
        
        // Draw horizontal grid lines
        for (let y = startY; y <= endY; y++) {
            const screenY = offsetY + y * BLOCK_SIZE * TILE_SIZE * scale;
            this.renderer.drawLine(0, screenY, canvasWidth, screenY, '#fff', lineWidth);
        }
        
        this.renderer.resetAlpha();
    }
}
