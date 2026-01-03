/**
 * RenderManager.js
 * 
 * Coordinates all rendering operations for the map viewer.
 * Manages switching between normal and interior layout rendering modes.
 * Delegates rendering to appropriate renderer based on active mode.
 */

import { NormalMapRenderer } from './NormalMapRenderer.js';
import { InteriorMapRenderer } from './InteriorMapRenderer.js';
import { Logger } from '../utils/Logger.js';

export const MODULE_VERSION = '1.0.0';

// Rendering modes
export const RENDER_MODE = {
    NORMAL: 'normal',
    INTERIOR: 'interior'
};

export class RenderManager {
    constructor(canvas, ctx, tilesetManager, spriteManager, tileAnimator) {
        this.canvas = canvas;
        this.ctx = ctx;
        
        // Initialize renderers
        this.normalRenderer = new NormalMapRenderer(
            canvas,
            ctx,
            tilesetManager,
            spriteManager,
            tileAnimator
        );
        
        this.interiorRenderer = new InteriorMapRenderer(
            canvas,
            ctx,
            tilesetManager,
            null, // collisionTileManager - not needed
            tileAnimator,
            spriteManager
        );
        
        // Current rendering mode
        this.currentMode = RENDER_MODE.NORMAL;
        
        // Rendering state (prevent concurrent renders)
        this.isRendering = false;
    }

    /**
     * Set the active rendering mode
     * @param {string} mode - Rendering mode (RENDER_MODE.NORMAL or RENDER_MODE.INTERIOR)
     */
    setMode(mode) {
        if (mode !== RENDER_MODE.NORMAL && mode !== RENDER_MODE.INTERIOR) {
            Logger.error(`Invalid render mode: ${mode}`);
            return;
        }
        
        if (this.currentMode !== mode) {
            Logger.log(`Switching render mode: ${this.currentMode} -> ${mode}`);
            this.currentMode = mode;
        }
    }

    /**
     * Get the current rendering mode
     * @returns {string} - Current mode
     */
    getMode() {
        return this.currentMode;
    }

    /**
     * Check if currently in interior layout mode
     * @returns {boolean}
     */
    isInteriorMode() {
        return this.currentMode === RENDER_MODE.INTERIOR;
    }

    /**
     * Check if currently in normal mode
     * @returns {boolean}
     */
    isNormalMode() {
        return this.currentMode === RENDER_MODE.NORMAL;
    }

    /**
     * Set overlay visibility for both renderers
     * @param {boolean} show - Whether to show overlays
     */
    setShowOverlays(show) {
        this.normalRenderer.setShowOverlays(show);
        this.interiorRenderer.setShowCollisionOverlays(show);
    }

    /**
     * Set grid visibility for both renderers
     * @param {boolean} show - Whether to show grid
     */
    setShowGrid(show) {
        this.normalRenderer.setShowGrid(show);
        this.interiorRenderer.setShowGrid(show);
    }

    /**
     * Set tile optimization for both renderers
     * @param {boolean} enabled - Whether to use tile optimization
     */
    setTileOptimization(enabled) {
        this.normalRenderer.setTileOptimization(enabled);
        this.interiorRenderer.setTileOptimization(enabled);
    }

    /**
     * Set hovered connection for interior renderer
     * @param {Object|null} connection - Hovered connection data
     */
    setHoveredConnection(connection) {
        this.interiorRenderer.setHoveredConnection(connection);
    }

    /**
     * Set drag overlay visibility for interior renderer
     * @param {boolean} show - Whether to show drag overlay
     */
    setShowDragOverlay(show) {
        this.interiorRenderer.setShowDragOverlay(show);
    }

    /**
     * Main render method - delegates to appropriate renderer based on mode
     * @param {Object} renderContext - Complete rendering context
     * @returns {Promise<void>}
     */
    async render(renderContext) {
        // Prevent concurrent render calls
        if (this.isRendering) {
            return;
        }
        
        this.isRendering = true;
        
        try {
            if (this.currentMode === RENDER_MODE.INTERIOR) {
                // Interior layout mode
                this.interiorRenderer.render(renderContext);
            } else {
                // Normal mode
                this.normalRenderer.render(renderContext);
            }
        } catch (error) {
            Logger.error('Render error:', error);
            throw error;
        } finally {
            this.isRendering = false;
        }
    }

    /**
     * Get the active renderer
     * @returns {BaseRenderer} - Current active renderer
     */
    getActiveRenderer() {
        return this.currentMode === RENDER_MODE.INTERIOR 
            ? this.interiorRenderer 
            : this.normalRenderer;
    }

    /**
     * Get both renderers (for direct access if needed)
     * @returns {Object} - Object with normalRenderer and interiorRenderer
     */
    getRenderers() {
        return {
            normalRenderer: this.normalRenderer,
            interiorRenderer: this.interiorRenderer
        };
    }

    /**
     * Toggle between normal and interior modes
     * @returns {string} - New active mode
     */
    toggleMode() {
        const newMode = this.currentMode === RENDER_MODE.NORMAL 
            ? RENDER_MODE.INTERIOR 
            : RENDER_MODE.NORMAL;
        this.setMode(newMode);
        return newMode;
    }

    /**
     * Clear the canvas
     * @param {string} color - Background color
     */
    clear(color = '#000') {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
