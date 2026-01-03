// Viewport state management (zoom, pan, offset)
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM, DEFAULT_OFFSET_X, DEFAULT_OFFSET_Y } from '../core/Constants.js';
import { Logger } from '../utils/Logger.js';

// Always update version after changes
export const MODULE_VERSION = '1.0.0';

export class ViewportState {
    constructor() {
        this.scale = DEFAULT_ZOOM;
        this.offsetX = DEFAULT_OFFSET_X;
        this.offsetY = DEFAULT_OFFSET_Y;
    }
    
    zoomIn(canvasWidth, canvasHeight) {
        if (this.scale < MAX_ZOOM) {
            const oldScale = this.scale;
            this.scale = Math.min(MAX_ZOOM, this.scale + 1);
            
            // Adjust offset to zoom towards center
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            this.offsetX = centerX - (centerX - this.offsetX) * (this.scale / oldScale);
            this.offsetY = centerY - (centerY - this.offsetY) * (this.scale / oldScale);
            
            Logger.log(`Zoom: ${this.scale}x`);
            return true;
        }
        return false;
    }
    
    zoomOut(canvasWidth, canvasHeight) {
        if (this.scale > MIN_ZOOM) {
            const oldScale = this.scale;
            this.scale = Math.max(MIN_ZOOM, this.scale - 1);
            
            // Adjust offset to zoom towards center
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            this.offsetX = centerX - (centerX - this.offsetX) * (this.scale / oldScale);
            this.offsetY = centerY - (centerY - this.offsetY) * (this.scale / oldScale);
            
            Logger.log(`Zoom: ${this.scale}x`);
            return true;
        }
        return false;
    }
    
    resetZoom() {
        this.scale = DEFAULT_ZOOM;
        Logger.log(`Zoom reset: ${this.scale}x`);
    }
    
    resetPosition() {
        this.offsetX = DEFAULT_OFFSET_X;
        this.offsetY = DEFAULT_OFFSET_Y;
    }
    
    resetView() {
        this.resetZoom();
        this.resetPosition();
    }
    
    pan(dx, dy) {
        this.offsetX += dx;
        this.offsetY += dy;
    }
    
    setScale(scale) {
        this.scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
    }
    
    getScale() {
        return this.scale;
    }
    
    getOffset() {
        return { x: this.offsetX, y: this.offsetY };
    }
}
