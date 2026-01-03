/**
 * TileAnimationDebugPanel.js
 * 
 * Debug panel for viewing and analyzing animated tiles in the Pokemon Red map viewer.
 * Displays frame counters, current frames, and visual previews of animated tiles.
 */

export class TileAnimationDebugPanel {
    constructor(tileAnimator) {
        this.tileAnimator = tileAnimator;
        this.panel = null;
        this.isVisible = false;
        this.updateInterval = null;
        
        this.createPanel();
    }
    
    createPanel() {
        // Create main panel container
        this.panel = document.createElement('div');
        this.panel.id = 'tile-animation-debug-panel';
        this.panel.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 320px;
            background: rgba(30, 30, 40, 0.95);
            border: 2px solid #4a90e2;
            border-radius: 8px;
            padding: 15px;
            color: #fff;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            z-index: 10000;
            display: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;
        
        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #4a90e2;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <span>🔍 Tile Animation Debug</span>
            <button id="close-debug-panel" style="
                background: #e74c3c;
                border: none;
                color: white;
                padding: 2px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
            ">✕</button>
        `;
        
        // Create content container
        const content = document.createElement('div');
        content.id = 'debug-panel-content';
        
        // Water animation section
        const waterSection = document.createElement('div');
        waterSection.style.cssText = `
            margin-bottom: 15px;
            padding: 10px;
            background: rgba(0, 119, 190, 0.15);
            border-radius: 4px;
        `;
        waterSection.innerHTML = `
            <div style="font-weight: bold; color: #4fc3f7; margin-bottom: 5px;">💧 Water Tile ($14)</div>
            <div id="water-counter" style="margin: 3px 0;">Counter: <span style="color: #4fc3f7;">0</span></div>
            <div id="water-direction" style="margin: 3px 0;">Direction: <span style="color: #4fc3f7;">-</span></div>
            <div id="water-frame" style="margin: 3px 0;">Frame: <span style="color: #4fc3f7;">0/7</span></div>
            <div style="margin-top: 8px;">
                <div style="font-size: 11px; margin-bottom: 4px;">Current Frame:</div>
                <div id="water-frame-preview" style="text-align: center;"></div>
            </div>
        `;
        
        // Flower animation section
        const flowerSection = document.createElement('div');
        flowerSection.style.cssText = `
            margin-bottom: 15px;
            padding: 10px;
            background: rgba(233, 30, 99, 0.15);
            border-radius: 4px;
        `;
        flowerSection.innerHTML = `
            <div style="font-weight: bold; color: #f48fb1; margin-bottom: 5px;">🌸 Flower Tile ($03)</div>
            <div id="flower-counter" style="margin: 3px 0;">Counter: <span style="color: #f48fb1;">0</span></div>
            <div id="flower-frame" style="margin: 3px 0;">Frame: <span style="color: #f48fb1;">1/3</span></div>
            <div style="margin-top: 8px;">
                <div style="font-size: 11px; margin-bottom: 4px;">Frame Preview:</div>
                <div id="flower-frame-preview" style="
                    display: flex;
                    gap: 8px;
                    justify-content: space-around;
                    margin-top: 5px;
                "></div>
            </div>
        `;
        
        // Global frame counter section
        const globalSection = document.createElement('div');
        globalSection.style.cssText = `
            padding: 10px;
            background: rgba(156, 39, 176, 0.15);
            border-radius: 4px;
        `;
        globalSection.innerHTML = `
            <div style="font-weight: bold; color: #ba68c8; margin-bottom: 5px;">⏱️ Global Counters</div>
            <div id="frame-counter1" style="margin: 3px 0;">Frame Counter 1: <span style="color: #ba68c8;">0</span></div>
            <div id="frame-counter2" style="margin: 3px 0;">Frame Counter 2: <span style="color: #ba68c8;">0</span></div>
            <div id="fps" style="margin: 3px 0;">FPS: <span style="color: #ba68c8;">60</span></div>
        `;
        
        content.appendChild(waterSection);
        content.appendChild(flowerSection);
        content.appendChild(globalSection);
        
        this.panel.appendChild(header);
        this.panel.appendChild(content);
        
        document.body.appendChild(this.panel);
        
        // Add close button event
        document.getElementById('close-debug-panel').addEventListener('click', () => {
            this.hide();
        });
        
        // Create water frame preview canvas
        this.createWaterFramePreview();
        
        // Create flower frame preview canvases
        this.createFlowerFramePreviews();
    }
    
    createWaterFramePreview() {
        const previewContainer = document.getElementById('water-frame-preview');
        if (!previewContainer) return;
        
        const canvas = document.createElement('canvas');
        canvas.id = 'water-current-frame-canvas';
        canvas.width = 16;
        canvas.height = 16;
        canvas.style.cssText = `
            image-rendering: pixelated;
            image-rendering: crisp-edges;
            width: 64px;
            height: 64px;
            border: 2px solid #555;
            background: #2a2a2a;
            display: block;
            margin: 0 auto;
        `;
        
        previewContainer.appendChild(canvas);
    }
    
    createFlowerFramePreviews() {
        const previewContainer = document.getElementById('flower-frame-preview');
        if (!previewContainer) return;
        
        for (let i = 1; i <= 3; i++) {
            const frameDiv = document.createElement('div');
            frameDiv.style.cssText = `
                text-align: center;
            `;
            
            const canvas = document.createElement('canvas');
            canvas.id = `flower-frame-${i}-canvas`;
            canvas.width = 16;
            canvas.height = 16;
            canvas.style.cssText = `
                image-rendering: pixelated;
                image-rendering: crisp-edges;
                width: 64px;
                height: 64px;
                border: 2px solid #555;
                background: #2a2a2a;
                display: block;
                margin: 0 auto;
            `;
            
            const label = document.createElement('div');
            label.textContent = `Frame ${i}`;
            label.style.cssText = `
                font-size: 10px;
                margin-top: 4px;
                color: #999;
            `;
            
            frameDiv.appendChild(canvas);
            frameDiv.appendChild(label);
            previewContainer.appendChild(frameDiv);
        }
    }
    
    show() {
        this.isVisible = true;
        this.panel.style.display = 'block';
        
        // Start updating
        if (!this.updateInterval) {
            this.updateInterval = setInterval(() => this.update(), 100); // Update 10 times per second
        }
        
        this.update();
    }
    
    hide() {
        this.isVisible = false;
        this.panel.style.display = 'none';
        
        // Stop updating
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    update() {
        if (!this.isVisible || !this.tileAnimator) return;
        
        // Update water animation info
        const waterCounterEl = document.getElementById('water-counter');
        if (waterCounterEl) {
            const span = waterCounterEl.querySelector('span');
            span.textContent = this.tileAnimator.waterCounter || 0;
        }
        
        const waterDirectionEl = document.getElementById('water-direction');
        if (waterDirectionEl && this.tileAnimator.waterCounter !== undefined) {
            const span = waterDirectionEl.querySelector('span');
            const direction = ((this.tileAnimator.waterCounter & 7) & 4) ? 'Left ⬅' : 'Right ➡';
            span.textContent = direction;
        }
        
        const waterFrameEl = document.getElementById('water-frame');
        if (waterFrameEl && this.tileAnimator.waterCounter !== undefined) {
            const span = waterFrameEl.querySelector('span');
            const frame = this.tileAnimator.waterCounter & 7;
            span.textContent = `${frame}/7`;
        }
        
        // Update flower animation info
        const flowerCounterEl = document.getElementById('flower-counter');
        if (flowerCounterEl) {
            const span = flowerCounterEl.querySelector('span');
            span.textContent = this.tileAnimator.flowerCounter || 0;
        }
        
        const flowerFrameEl = document.getElementById('flower-frame');
        if (flowerFrameEl && this.tileAnimator.flowerCounter !== undefined) {
            const span = flowerFrameEl.querySelector('span');
            const frameIndex = this.getFlowerFrameIndex();
            span.textContent = `${frameIndex}/3`;
            
            // Highlight active frame
            this.highlightActiveFrame(frameIndex);
        }
        
        // Update global counters
        const frameCounter1El = document.getElementById('frame-counter1');
        if (frameCounter1El) {
            const span = frameCounter1El.querySelector('span');
            span.textContent = this.tileAnimator.frameCounter1 || 0;
        }
        
        const frameCounter2El = document.getElementById('frame-counter2');
        if (frameCounter2El) {
            const span = frameCounter2El.querySelector('span');
            span.textContent = this.tileAnimator.frameCounter2 || 0;
        }
    }
    
    getFlowerFrameIndex() {
        if (!this.tileAnimator || this.tileAnimator.flowerCounter === undefined) return 1;
        
        const counter = this.tileAnimator.flowerCounter & 3;
        
        // Match pokered logic:
        // and 3
        // cp 2
        // jr c, .copy  ; if counter < 2, use frame 1
        // jr z, .copy  ; if counter == 2, use frame 2
        // ; otherwise use frame 3
        
        if (counter < 2) return 1;
        if (counter === 2) return 2;
        return 3;
    }
    
    highlightActiveFrame(activeFrame) {
        for (let i = 1; i <= 3; i++) {
            const canvas = document.getElementById(`flower-frame-${i}-canvas`);
            if (canvas) {
                if (i === activeFrame) {
                    canvas.style.border = '3px solid #4fc3f7';
                    canvas.style.boxShadow = '0 0 12px rgba(79, 195, 247, 0.6)';
                } else {
                    canvas.style.border = '2px solid #555';
                    canvas.style.boxShadow = 'none';
                }
            }
        }
    }
    
    /**
     * Update flower frame preview canvases with the actual tile graphics
     */
    updateFlowerFramePreviews(flowerFrames) {
        if (!flowerFrames || flowerFrames.length !== 3) return;
        
        for (let i = 0; i < 3; i++) {
            const canvas = document.getElementById(`flower-frame-${i + 1}-canvas`);
            if (canvas && flowerFrames[i]) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, 16, 16);
                
                // Draw the tile image
                if (flowerFrames[i].complete) {
                    ctx.drawImage(flowerFrames[i], 0, 0);
                }
            }
        }
    }
    
    /**
     * Update water frame preview canvas with the current animated frame
     * @param {HTMLCanvasElement} animatedTileCanvas - The current water animation frame
     */
    updateWaterFramePreview(animatedTileCanvas) {
        const canvas = document.getElementById('water-current-frame-canvas');
        if (!canvas || !animatedTileCanvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 16, 16);
        
        // Scale the 8x8 tile to 16x16 for preview
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(animatedTileCanvas, 0, 0, 8, 8, 0, 0, 16, 16);
        
        // Add border highlight when drawing
        canvas.style.border = '3px solid #4fc3f7';
        canvas.style.boxShadow = '0 0 12px rgba(79, 195, 247, 0.6)';
        
        // Remove highlight after a short delay
        setTimeout(() => {
            canvas.style.border = '2px solid #555';
            canvas.style.boxShadow = 'none';
        }, 200);
    }
    
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
    }
}
