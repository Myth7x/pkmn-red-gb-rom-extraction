/**
 * FPSCounter.js
 * 
 * Tracks and displays frames per second for performance monitoring.
 */

export const MODULE_VERSION = '1.0.0';

export class FPSCounter {
    constructor() {
        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.updateInterval = 500; // Update display every 500ms
        this.displayElement = null;
    }
    
    /**
     * Set the DOM element to display FPS
     * @param {HTMLElement} element - Element to update with FPS value
     */
    setDisplayElement(element) {
        this.displayElement = element;
    }
    
    /**
     * Call this at the end of each frame render
     */
    tick() {
        this.frameCount++;
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        
        // Update FPS display every updateInterval ms
        if (deltaTime >= this.updateInterval) {
            this.fps = Math.round((this.frameCount * 1000) / deltaTime);
            
            if (this.displayElement) {
                this.displayElement.textContent = this.fps;
                
                // Color code FPS: green (60+), yellow (30-59), red (<30)
                if (this.fps >= 60) {
                    this.displayElement.style.color = '#3fb950';
                } else if (this.fps >= 30) {
                    this.displayElement.style.color = '#d29922';
                } else {
                    this.displayElement.style.color = '#f85149';
                }
            }
            
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }
    
    /**
     * Get current FPS value
     * @returns {number} Current FPS
     */
    getFPS() {
        return this.fps;
    }
    
    /**
     * Reset the counter
     */
    reset() {
        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
    }
}
