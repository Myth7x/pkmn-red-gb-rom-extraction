/**
 * BaseRenderer.js
 * 
 * Abstract base class for map renderers.
 * Provides common functionality and interface for both normal and interior map rendering.
 */

import { TILE_SIZE, BLOCK_SIZE } from '../core/Constants.js';
import { TileRenderer } from './TileRenderer.js';
import { OverlayRenderer } from './OverlayRenderer.js';
import { SpriteRenderer } from './SpriteRenderer.js';
import { GridRenderer } from './GridRenderer.js';

export const MODULE_VERSION = '1.0.0';

export class BaseRenderer {
    constructor(canvas, ctx, tilesetManager, spriteManager, tileAnimator) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.tilesetManager = tilesetManager;
        this.spriteManager = spriteManager;
        this.tileAnimator = tileAnimator;
        
        // Initialize specialized renderers
        this.tileRenderer = new TileRenderer(
            { drawImage: this.drawImage.bind(this), drawRect: this.drawRect.bind(this), 
              setAlpha: this.setAlpha.bind(this), resetAlpha: this.resetAlpha.bind(this), 
              save: this.save.bind(this), restore: this.restore.bind(this) },
            tilesetManager,
            tileAnimator
        );
        
        this.overlayRenderer = new OverlayRenderer({
            drawRect: this.drawRect.bind(this),
            drawText: this.drawText.bind(this),
            drawCircle: this.drawCircle.bind(this),
            setAlpha: this.setAlpha.bind(this),
            resetAlpha: this.resetAlpha.bind(this)
        });
        
        this.spriteRenderer = new SpriteRenderer(
            {
                drawImage: this.drawImage.bind(this),
                drawRect: this.drawRect.bind(this),
                drawText: this.drawText.bind(this),
                drawLine: this.drawLine.bind(this),
                drawCircle: this.drawCircle.bind(this),
                setAlpha: this.setAlpha.bind(this),
                resetAlpha: this.resetAlpha.bind(this),
                setStrokeStyle: this.setStrokeStyle.bind(this),
                save: this.save.bind(this),
                restore: this.restore.bind(this),
                translate: this.translate.bind(this),
                scale: this.scale.bind(this)
            },
            spriteManager,
            tilesetManager
        );
        
        this.gridRenderer = new GridRenderer({
            drawLine: this.drawLine.bind(this),
            setAlpha: this.setAlpha.bind(this),
            resetAlpha: this.resetAlpha.bind(this)
        });
        
        // State
        this.showOverlays = true;
        this.showGrid = false;
        this.tileOptimizationEnabled = true;
    }

    /**
     * Set overlay visibility
     * @param {boolean} show - Whether to show overlays
     */
    setShowOverlays(show) {
        this.showOverlays = show;
    }

    /**
     * Set grid visibility
     * @param {boolean} show - Whether to show grid
     */
    setShowGrid(show) {
        this.showGrid = show;
    }

    /**
     * Set tile optimization
     * @param {boolean} enabled - Whether to use tile optimization
     */
    setTileOptimization(enabled) {
        this.tileOptimizationEnabled = enabled;
        this.tileRenderer.setTileOptimization(enabled);
    }

    /**
     * Clear canvas
     * @param {string} color - Background color
     */
    clear(color = '#000') {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Render method - must be implemented by subclasses
     * @param {Object} renderContext - Rendering context with all necessary data
     */
    render(renderContext) {
        throw new Error('render() must be implemented by subclass');
    }

    // Canvas drawing methods (wrapper around CanvasRenderer functionality)
    
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
        this.ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    
    drawRect(x, y, w, h, color, fill = true, lineWidth = 1) {
        if (fill) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x, y, w, h);
        } else {
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = lineWidth;
            this.ctx.strokeRect(x, y, w, h);
        }
    }
    
    drawText(text, x, y, options = {}) {
        const {
            font = '10px monospace',
            color = '#fff',
            align = 'left',
            baseline = 'top',
            shadow = false
        } = options;
        
        this.ctx.font = font;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = baseline;
        
        if (shadow) {
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            this.ctx.shadowBlur = 2;
            this.ctx.shadowOffsetX = 1;
            this.ctx.shadowOffsetY = 1;
        }
        
        this.ctx.fillText(text, x, y);
        
        if (shadow) {
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
        }
    }
    
    drawLine(x1, y1, x2, y2, color, lineWidth = 1) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }
    
    drawCircle(x, y, radius, color, fill = true) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        if (fill) {
            this.ctx.fillStyle = color;
            this.ctx.fill();
        } else {
            this.ctx.strokeStyle = color;
            this.ctx.stroke();
        }
    }
    
    setStrokeStyle(color, lineWidth = 1) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
    }
    
    setAlpha(alpha) {
        this.ctx.globalAlpha = alpha;
    }
    
    resetAlpha() {
        this.ctx.globalAlpha = 1.0;
    }
    
    save() {
        this.ctx.save();
    }
    
    restore() {
        this.ctx.restore();
    }
    
    translate(x, y) {
        this.ctx.translate(x, y);
    }
    
    scale(x, y) {
        this.ctx.scale(x, y);
    }
}
