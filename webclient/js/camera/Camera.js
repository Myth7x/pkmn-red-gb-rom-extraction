/**
 * Camera.js
 * 
 * Handles camera positioning and following the player in game mode.
 * Centers the camera on the player in a seamless world (no map boundaries).
 */

export const MODULE_VERSION = '1.0.0';

export class Camera {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Camera offset (in pixels)
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Target offset (for smooth camera movement)
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
        
        // Camera smoothing
        this.smoothing = 0.1; // Lower = smoother but slower, higher = snappier
        
        // Zoom level
        this.zoom = 2;
        
        // Anti-flicker mechanism for large position jumps
        this.skipUpdateFrames = 0;  // Number of frames to skip smooth updates
        this.lastPlayerPixelX = 0;
        this.lastPlayerPixelY = 0;
    }
    
    /**
     * Set zoom level
     * @param {number} zoom - Zoom level
     */
    setZoom(zoom) {
        this.zoom = zoom;
    }
    
    /**
     * Set map boundaries (deprecated - kept for compatibility)
     * In seamless world mode, boundaries are ignored
     * @param {number} widthPixels - Map width in pixels
     * @param {number} heightPixels - Map height in pixels
     */
    setMapBoundaries(widthPixels, heightPixels) {
        // No-op in seamless world mode
        // Method kept for backwards compatibility
    }
    
    /**
     * Focus camera on player position (global coordinates)
     * @param {number} playerPixelX - Player X position in global pixels
     * @param {number} playerPixelY - Player Y position in global pixels
     * @param {boolean} immediate - If true, snap camera immediately without smoothing
     */
    focusOnPlayer(playerPixelX, playerPixelY, immediate = false) {
        // Detect large position jumps (for debugging, but shouldn't happen in seamless world)
        const deltaX = Math.abs(playerPixelX - this.lastPlayerPixelX);
        const deltaY = Math.abs(playerPixelY - this.lastPlayerPixelY);
        const largeJump = deltaX > 200 || deltaY > 200;
        
        if (largeJump && this.lastPlayerPixelX !== 0 && this.lastPlayerPixelY !== 0) {
            console.log(`[Camera] 🎥 Large position jump detected (ΔX: ${deltaX}, ΔY: ${deltaY})`);
            // Skip smooth updates for a few frames to avoid flicker
            this.skipUpdateFrames = 3;
        }
        
        this.lastPlayerPixelX = playerPixelX;
        this.lastPlayerPixelY = playerPixelY;
        
        // Center player on screen
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Calculate desired offset to center player
        // In seamless world mode, we always center on the player without constraints
        this.targetOffsetX = centerX - (playerPixelX * this.zoom);
        this.targetOffsetY = centerY - (playerPixelY * this.zoom);
        
        // If immediate, snap camera to target position
        if (immediate) {
            this.offsetX = this.targetOffsetX;
            this.offsetY = this.targetOffsetY;
        }
    }
    
    /**
     * Update camera position (smooth interpolation)
     */
    update() {
        // If we're in skip frames mode (after large jump), snap to target immediately
        if (this.skipUpdateFrames > 0) {
            this.offsetX = this.targetOffsetX;
            this.offsetY = this.targetOffsetY;
            this.skipUpdateFrames--;
            console.log(`[Camera] 🎥 Skipping smooth update (${this.skipUpdateFrames} frames remaining)`);
            return;
        }
        
        // Smooth camera movement
        this.offsetX += (this.targetOffsetX - this.offsetX) * this.smoothing;
        this.offsetY += (this.targetOffsetY - this.offsetY) * this.smoothing;
        
        // Snap to target if very close (prevent floating point drift)
        if (Math.abs(this.targetOffsetX - this.offsetX) < 0.1) {
            this.offsetX = this.targetOffsetX;
        }
        if (Math.abs(this.targetOffsetY - this.offsetY) < 0.1) {
            this.offsetY = this.targetOffsetY;
        }
    }
    
    /**
     * Get camera offset
     * @returns {Object} - {offsetX, offsetY}
     */
    getOffset() {
        return {
            offsetX: this.offsetX,
            offsetY: this.offsetY
        };
    }
    
    /**
     * Get zoom level
     * @returns {number}
     */
    getZoom() {
        return this.zoom;
    }
    
    /**
     * Set camera position directly (no smoothing)
     * @param {number} offsetX - X offset in pixels
     * @param {number} offsetY - Y offset in pixels
     */
    setPosition(offsetX, offsetY) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.targetOffsetX = offsetX;
        this.targetOffsetY = offsetY;
    }
    
    /**
     * Reset camera to default position
     */
    reset() {
        this.offsetX = 0;
        this.offsetY = 0;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
    }
}
