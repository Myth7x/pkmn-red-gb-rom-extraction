// Low-level canvas rendering operations

export const MODULE_VERSION = '1.0.0';

export class CanvasRenderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.ctx.imageSmoothingEnabled = false; // Pixel-perfect rendering
    }
    
    clear(color = '#000') {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
        this.ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    
    drawRect(x, y, w, h, color, fill = true) {
        if (fill) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x, y, w, h);
        } else {
            this.ctx.strokeStyle = color;
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
    
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.imageSmoothingEnabled = false;
    }
    
    getWidth() {
        return this.canvas.width;
    }
    
    getHeight() {
        return this.canvas.height;
    }
}
