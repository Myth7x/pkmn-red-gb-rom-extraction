// Main Map Viewer Application Controller
import { MAP_VIEWER_VERSION, MAP_VIEWER_BUILD_DATE, TILE_SIZE, BLOCK_SIZE, MODULE_VERSIONS, getMovementInfo } from './Constants.js';
import { Config } from './Config.js';
import { Logger } from '../utils/Logger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { ViewportState } from '../state/ViewportState.js';
import { MapState } from '../state/MapState.js';
import { PreferencesManager } from '../state/PreferencesManager.js';
import { MapDataManager } from '../data/MapDataManager.js';
import { TilesetManager } from '../data/TilesetManager.js';
import { SpriteManager } from '../data/SpriteManager.js';
import { CanvasRenderer } from '../rendering/CanvasRenderer.js';
import { NPCMovementEngine } from '../movement/NPCMovement.js';

// Import module versions
import { MODULE_VERSION as CONFIG_VERSION } from './Config.js';
import { MODULE_VERSION as LOGGER_VERSION } from '../utils/Logger.js';
import { MODULE_VERSION as ERROR_HANDLER_VERSION } from '../utils/ErrorHandler.js';
import { MODULE_VERSION as VIEWPORT_STATE_VERSION } from '../state/ViewportState.js';
import { MODULE_VERSION as MAP_STATE_VERSION } from '../state/MapState.js';
import { MODULE_VERSION as PREFERENCES_VERSION } from '../state/PreferencesManager.js';
import { MODULE_VERSION as CACHE_MANAGER_VERSION } from '../data/CacheManager.js';
import { MODULE_VERSION as MAP_DATA_VERSION } from '../data/MapDataManager.js';
import { MODULE_VERSION as TILESET_VERSION } from '../data/TilesetManager.js';
import { MODULE_VERSION as SPRITE_VERSION } from '../data/SpriteManager.js';
import { MODULE_VERSION as RENDERER_VERSION } from '../rendering/CanvasRenderer.js';

export const MODULE_VERSION = '1.0.4';

export class MapViewer {
    constructor(canvasId) {
        Logger.log('Pokemon Red Map Viewer - Starting initialization...');
        Logger.log(`Version ${MAP_VIEWER_VERSION} (Build: ${MAP_VIEWER_BUILD_DATE})`);
        
        // Core configuration
        this.config = new Config();
        
        // Canvas setup
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error('Canvas element not found!');
        }
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            throw new Error('Failed to get 2D context!');
        }
        
        // Renderer
        this.renderer = new CanvasRenderer(this.canvas, this.ctx);
        
        // Data managers
        this.mapDataManager = new MapDataManager(this.config);
        this.tilesetManager = new TilesetManager(this.config);
        this.spriteManager = new SpriteManager(this.config);
        
        // Movement engine
        this.movementEngine = new NPCMovementEngine();
        this.movementEnabled = true; // Toggle for NPC movement
        
        // State management
        this.preferences = new PreferencesManager();
        this.viewportState = new ViewportState();
        this.mapState = new MapState(); // No longer needs preferences
        
        // UI state
        this.showOverlays = true;
        this.showGrid = false;
        this.showCoordLabels = false;
        this.showTooltip = true;
        this.hoveredTile = null;
        
        // Input state
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        
        // Error handler
        this.errorHandler = new ErrorHandler();
        
        // Prevent double init
        if (window.mapViewerInitialized) {
            Logger.warn('Already initialized, skipping');
            return;
        }
        window.mapViewerInitialized = true;
    }
    
    async init() {
        try {
            Logger.log('Initializing Map Viewer...');
            
            // Initialize error handler
            this.errorHandler.init();
            
            // Restore preferences
            this.restorePreferences();
            
            // Setup canvas
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            
            // Setup controls
            this.setupMouseControls();
            this.setupKeyboardControls();
            this.setupUIControls();
            
            // Update UI with restored values
            this.updateZoomDisplay();
            this.updateVersionFooter();
            
            // Load map list and initial map
            await this.loadMapList();
            
            // Hide loading screen
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.classList.add('hidden');
            }
            
            Logger.success('Initialization complete!');
            
            // Start continuous render loop for animations
            this.startRenderLoop();
            
        } catch (error) {
            this.errorHandler.handle(error, 'Initialization');
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.classList.add('hidden');
            }
        }
    }
    
    /**
     * Continuous render loop for animations
     */
    startRenderLoop() {
        let lastFrameTime = Date.now();
        
        const loop = () => {
            const now = Date.now();
            const delta = now - lastFrameTime;
            
            // Render at ~60 FPS (16.67ms per frame)
            if (delta >= 16) {
                if (this.movementEnabled && this.movementEngine.isRunning) {
                    this.render();
                }
                lastFrameTime = now;
            }
            
            requestAnimationFrame(loop);
        };
        
        loop();
    }
    
    restorePreferences() {
        // Restore zoom
        const savedZoom = this.preferences.loadZoom(this.config.defaults.zoom);
        if (savedZoom >= 1 && savedZoom <= 8) {
            this.viewportState.setScale(savedZoom);
        }
        
        // Restore overlay settings
        const overlaySettings = this.preferences.loadOverlaySettings();
        this.showOverlays = overlaySettings.showOverlays;
        this.showGrid = overlaySettings.showGrid;
        this.showCoordLabels = overlaySettings.showCoordLabels;
        this.showTooltip = overlaySettings.showTooltip !== false; // Default to true
        
        // Restore sidebar state
        const sidebarHidden = this.preferences.loadSidebarState();
        if (sidebarHidden) {
            const sidebar = document.getElementById('sidebar');
            const toggleBtn = document.getElementById('toggleSidebarBtn');
            if (sidebar && toggleBtn) {
                sidebar.classList.add('hidden');
                toggleBtn.classList.remove('sidebar-visible');
                toggleBtn.textContent = '☰';
                Logger.log('Restored sidebar state: HIDDEN');
            }
        }
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.renderer.resize(container.clientWidth, container.clientHeight);
        if (this.mapState.getCurrentMap()) {
            this.render();
        }
    }
    
    // This will be continued in the next part...
    render() {
        const currentMap = this.mapState.getCurrentMap();
        if (!currentMap || !this.tilesetManager.hasTileset(currentMap.tileset)) {
            return;
        }
        
        // Clear canvas
        this.renderer.clear('#000');
        
        const tilesetImg = this.tilesetManager.getTilesetImage(currentMap.tileset);
        const blockDefs = this.tilesetManager.getBlockDefinition(currentMap.tileset, 0); // We'll need all blocks
        
        const scale = this.viewportState.getScale();
        const offset = this.viewportState.getOffset();
        
        const mapWidthPixels = currentMap.width * BLOCK_SIZE * TILE_SIZE;
        const mapHeightPixels = currentMap.height * BLOCK_SIZE * TILE_SIZE;
        
        // Calculate visible area
        const startX = Math.max(0, Math.floor(-offset.x / (BLOCK_SIZE * TILE_SIZE * scale)));
        const startY = Math.max(0, Math.floor(-offset.y / (BLOCK_SIZE * TILE_SIZE * scale)));
        const endX = Math.min(currentMap.width - 1, Math.ceil((this.renderer.getWidth() - offset.x) / (BLOCK_SIZE * TILE_SIZE * scale)));
        const endY = Math.min(currentMap.height - 1, Math.ceil((this.renderer.getHeight() - offset.y) / (BLOCK_SIZE * TILE_SIZE * scale)));
        
        // Render map blocks with actual tiles
        const allBlockDefs = this.tilesetManager.tilesetBlockDefinitions[currentMap.tileset];
        
        // Debug: Log unique block IDs being rendered (once per map load)
        if (!this._loggedBlockIds) {
            const uniqueBlocks = new Set();
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const idx = y * currentMap.width + x;
                    if (currentMap.blockData[idx] !== undefined) {
                        uniqueBlocks.add(currentMap.blockData[idx]);
                    }
                }
            }
            console.log(`[MapViewer] Rendering ${uniqueBlocks.size} unique blocks:`, Array.from(uniqueBlocks).sort((a,b) => a-b));
            this._loggedBlockIds = true;
        }
        
        for (let blockY = startY; blockY <= endY; blockY++) {
            for (let blockX = startX; blockX <= endX; blockX++) {
                const blockIndex = blockY * currentMap.width + blockX;
                const blockId = currentMap.blockData[blockIndex];
                
                if (blockId === undefined || !allBlockDefs || !allBlockDefs[blockId]) continue;
                
                const blockDef = allBlockDefs[blockId];
                const screenBlockX = offset.x + blockX * BLOCK_SIZE * TILE_SIZE * scale;
                const screenBlockY = offset.y + blockY * BLOCK_SIZE * TILE_SIZE * scale;
                
                // Each block is 4x4 tiles
                for (let tileY = 0; tileY < BLOCK_SIZE; tileY++) {
                    for (let tileX = 0; tileX < BLOCK_SIZE; tileX++) {
                        // Get tile ID from block's 4x4 structure
                        const tileId = blockDef.tiles[tileY][tileX];
                        
                        if (tileId === undefined) continue;
                        
                        // Calculate tile position in tileset (16 tiles per row)
                        const srcX = (tileId % 16) * TILE_SIZE;
                        const srcY = Math.floor(tileId / 16) * TILE_SIZE;
                        
                        // Calculate screen position
                        const destX = screenBlockX + tileX * TILE_SIZE * scale;
                        const destY = screenBlockY + tileY * TILE_SIZE * scale;
                        const destSize = TILE_SIZE * scale;
                        
                        // Draw tile from tileset
                        this.renderer.drawImage(
                            tilesetImg,
                            srcX, srcY, TILE_SIZE, TILE_SIZE,
                            destX, destY, destSize, destSize
                        );
                    }
                }
                
                // Draw collision overlay using NEW tile-based collision system
                if (this.showOverlays) {
                    const blockDef = this.tilesetManager.getBlockDefinition(currentMap.tileset, blockId);
                    
                    if (blockDef && blockDef.tiles) {
                        const tileSize = TILE_SIZE * scale;
                        const borderWidth = Math.max(1, Math.floor(scale * 0.5));
                        
                        // Check each tile in the 4x4 block
                        for (let tileRow = 0; tileRow < 4; tileRow++) {
                            for (let tileCol = 0; tileCol < 4; tileCol++) {
                                const tileId = blockDef.tiles[tileRow][tileCol];
                                
                                // Determine overlay color based on tile properties
                                let overlayColor = null;
                                let alpha = 0.3;
                                
                                // Check tile passability
                                const isPassable = this.tilesetManager.isTilePassable(currentMap.tileset, tileId);
                                
                                // Check tile type (priority: GRASS > FLOWER > WATER > LEDGE > WALL > VOID)
                                if (this.tilesetManager.isGrassTile(currentMap.tileset, tileId)) {
                                    // Green for grass tiles (walkable, encounter tiles)
                                    overlayColor = '#00ff00';
                                    alpha = 0.25;
                                } else if (this.tilesetManager.isFlowerTile(currentMap.tileset, tileId)) {
                                    // Yellow for animated flower tiles (decorative, walkable)
                                    overlayColor = '#ffff00';
                                    alpha = 0.3;
                                } else if (this.tilesetManager.isWaterTile(tileId)) {
                                    // Blue for water tiles
                                    overlayColor = '#0044cc';
                                    alpha = 0.4;
                                } else if (this.tilesetManager.isLedgeTile(tileId)) {
                                    // Orange for ledge tiles (jumpable down)
                                    overlayColor = '#ff8800';
                                    alpha = 0.4;
                                } else if (!isPassable) {
                                    // Red for impassable tiles (walls, void, obstacles)
                                    overlayColor = '#ff0000';
                                    alpha = 0.3;
                                }
                                
                                // Draw overlay border if there's a color
                                if (overlayColor) {
                                    const tileX = screenBlockX + tileCol * tileSize;
                                    const tileY = screenBlockY + tileRow * tileSize;
                                    this.renderer.setAlpha(alpha * 1.5);
                                    this.renderer.drawRect(tileX, tileY, tileSize, tileSize, overlayColor, false, borderWidth);
                                    this.renderer.resetAlpha();
                                }
                            }
                        }
                    }
                }
                
                // Draw block coordinates for debugging (when zoomed in enough and if enabled)
                if (scale >= 2 && this.showCoordLabels) {
                    const blockSize = BLOCK_SIZE * TILE_SIZE * scale;
                    const coordFontSize = Math.max(7, Math.min(10, blockSize * 0.2));
                    const coordText = `${blockX},${blockY}`;
                    
                    // Draw with outline for visibility
                    this.renderer.drawText(coordText, screenBlockX + 2, screenBlockY + 2, {
                        font: `${coordFontSize}px "Courier New"`,
                        color: '#ffff00',
                        align: 'left',
                        baseline: 'top',
                        shadow: true
                    });
                }
            }
        }
        
        // Render overlays (warps, signs, NPCs)
        if (this.showOverlays) {
            this.renderOverlays(currentMap, offset, scale);
            this.renderBoundaryConnections(currentMap, offset, scale);
        }
        
        // ALWAYS render sprites (not controlled by overlay toggle)
        this.renderSprites(currentMap, offset, scale);
        
        // Draw grid if enabled
        if (this.showGrid && scale >= 2) {
            this.renderer.setAlpha(0.15);
            for (let x = startX; x <= endX; x++) {
                const screenX = offset.x + x * BLOCK_SIZE * TILE_SIZE * scale;
                this.renderer.drawLine(screenX, 0, screenX, this.renderer.getHeight(), '#fff', 1);
            }
            for (let y = startY; y <= endY; y++) {
                const screenY = offset.y + y * BLOCK_SIZE * TILE_SIZE * scale;
                this.renderer.drawLine(0, screenY, this.renderer.getWidth(), screenY, '#fff', 1);
            }
            this.renderer.resetAlpha();
        }
        
        // Draw map boundaries
        const mapBoundaryX = offset.x;
        const mapBoundaryY = offset.y;
        const mapBoundaryWidth = currentMap.width * BLOCK_SIZE * TILE_SIZE * scale;
        const mapBoundaryHeight = currentMap.height * BLOCK_SIZE * TILE_SIZE * scale;
        
        this.renderer.setAlpha(1.0);
        this.renderer.drawRect(mapBoundaryX, mapBoundaryY, mapBoundaryWidth, mapBoundaryHeight, '#ff0', false);
        this.renderer.drawRect(mapBoundaryX - 1, mapBoundaryY - 1, mapBoundaryWidth + 2, mapBoundaryHeight + 2, '#f00', false);
        this.renderer.resetAlpha();
    }
    
    renderOverlays(currentMap, offset, scale) {
        // Render warps
        if (currentMap.objects && currentMap.objects.warps && currentMap.objects.warps.data && currentMap.objects.warps.data.length > 0) {
            currentMap.objects.warps.data.forEach((warp, index) => {
                const x = offset.x + warp.x * 2 * TILE_SIZE * scale;
                const y = offset.y + warp.y * 2 * TILE_SIZE * scale;
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
        
        // Render signs
        if (currentMap.objects && currentMap.objects.signs && currentMap.objects.signs.data && currentMap.objects.signs.data.length > 0) {
            currentMap.objects.signs.data.forEach((sign, index) => {
                const x = offset.x + sign.x * 2 * TILE_SIZE * scale;
                const y = offset.y + sign.y * 2 * TILE_SIZE * scale;
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
    }
    
    /**
     * Get sprite facing direction and frame info
     * Sprite sheet layout: 48x16 with 3 frames (down=0, up=16, left=32)
     * Right is mirrored from left frame
     * @param {Object} sprite - Sprite data from map
     * @returns {Object} - {facing: 'down'|'up'|'left'|'right', frameX: number, mirror: boolean}
     */
    getSpriteFrame(sprite, facingDirection = 0, animFrame = 0, isWalking = false) {
        // If movement engine provides facing direction, use it
        if (facingDirection !== undefined) {
            // Pokemon Red sprite facing directions:
            // 0 = DOWN, 4 = UP, 8 = LEFT, 12 = RIGHT
            let frameX = 0;
            let mirror = false;
            
            if (facingDirection === 0) { // DOWN
                frameX = 0;
            } else if (facingDirection === 4) { // UP
                frameX = 16;
            } else if (facingDirection === 8) { // LEFT
                frameX = 32;
            } else if (facingDirection === 12) { // RIGHT
                frameX = 32;
                mirror = true;
            }
            
            // Apply walking animation if sprite is walking
            // Pokemon Red has 4 animation frames per direction
            if (isWalking && animFrame > 0) {
                // Slight frame offset for walking animation
                // This would need actual sprite sheet layout info
                // For now, just use the base frame
            }
            
            return {
                facing: facingDirection === 0 ? 'down' : facingDirection === 4 ? 'up' : facingDirection === 8 ? 'left' : 'right',
                frameX: frameX,
                mirror: mirror
            };
        }
        
        // Fallback: Check if sprite has movement data with direction
        if (sprite.movement && sprite.movement.direction) {
            const dir = sprite.movement.direction;
            switch (dir) {
                case 'UP':
                    return { facing: 'up', frameX: 16, mirror: false };
                case 'DOWN':
                    return { facing: 'down', frameX: 0, mirror: false };
                case 'LEFT':
                    return { facing: 'left', frameX: 32, mirror: false };
                case 'RIGHT':
                    return { facing: 'right', frameX: 32, mirror: true };
                default:
                    return { facing: 'down', frameX: 0, mirror: false };
            }
        }
        
        // Default to facing down
        return {
            facing: 'down',
            frameX: 0,
            mirror: false
        };
    }
    
    /**
     * Render movement path visualization for an NPC
     * Shows the area where the NPC can walk based on movement type and range
     * @param {Object} sprite - Sprite data
     * @param {Object} offset - Map render offset
     * @param {number} scale - Current zoom scale
     */
    renderMovementPath(sprite, offset, scale) {
        if (!sprite.movement) return;
        
        const movement = sprite.movement;
        const centerX = offset.x + sprite.x * 2 * TILE_SIZE * scale;
        const centerY = offset.y + sprite.y * 2 * TILE_SIZE * scale;
        const tileSize = 2 * TILE_SIZE * scale;
        
        // Skip if NPC doesn't move (STAY type)
        if (movement.type === 'STAY') {
            // Draw facing indicator arrow for stationary NPCs
            if (movement.direction && movement.direction !== 'NONE') {
                this.drawFacingArrow(centerX, centerY, tileSize, movement.direction);
            }
            return;
        }
        
        // Get range (defaults from constants.asm)
        const range = sprite.range || 0;
        if (range === 0) return; // No movement area
        
        // Draw movement area based on movement type
        this.renderer.save();
        this.renderer.setAlpha(0.15);
        
        switch (movement.type) {
            case 'WALK':
                // Walking NPCs can move within their range
                switch (movement.direction) {
                    case 'ANY_DIR':
                        // Can walk in all directions - draw a square area
                        const areaSize = (range * 2 + 1) * tileSize;
                        const areaX = centerX - range * tileSize;
                        const areaY = centerY - range * tileSize;
                        this.renderer.drawRect(areaX, areaY, areaSize, areaSize, 'rgba(100, 200, 255, 0.8)', true);
                        this.renderer.setStrokeStyle('rgba(50, 150, 255, 0.8)', 2);
                        this.renderer.drawRect(areaX, areaY, areaSize, areaSize, 'rgba(50, 150, 255, 0.8)', false);
                        break;
                        
                    case 'UP_DOWN':
                        // Vertical movement only
                        const vHeight = (range * 2 + 1) * tileSize;
                        const vY = centerY - range * tileSize;
                        this.renderer.drawRect(centerX, vY, tileSize, vHeight, 'rgba(100, 255, 200, 0.8)', true);
                        this.renderer.setStrokeStyle('rgba(50, 255, 150, 0.8)', 2);
                        this.renderer.drawRect(centerX, vY, tileSize, vHeight, 'rgba(50, 255, 150, 0.8)', false);
                        break;
                        
                    case 'LEFT_RIGHT':
                        // Horizontal movement only
                        const hWidth = (range * 2 + 1) * tileSize;
                        const hX = centerX - range * tileSize;
                        this.renderer.drawRect(hX, centerY, hWidth, tileSize, 'rgba(255, 200, 100, 0.8)', true);
                        this.renderer.setStrokeStyle('rgba(255, 150, 50, 0.8)', 2);
                        this.renderer.drawRect(hX, centerY, hWidth, tileSize, 'rgba(255, 150, 50, 0.8)', false);
                        break;
                }
                break;
                
            case 'LOOK':
                // Looking around - draw rotation indicator
                const radius = tileSize * 0.8;
                this.renderer.drawCircle(
                    centerX + tileSize / 2,
                    centerY + tileSize / 2,
                    radius,
                    'rgba(255, 255, 100, 0.6)',
                    true
                );
                break;
        }
        
        this.renderer.resetAlpha();
        this.renderer.restore();
    }
    
    /**
     * Draw a facing direction arrow for stationary NPCs
     * @param {number} x - NPC x position
     * @param {number} y - NPC y position
     * @param {number} size - Tile size
     * @param {string} direction - Direction ('UP', 'DOWN', 'LEFT', 'RIGHT')
     */
    drawFacingArrow(x, y, size, direction) {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const arrowSize = size * 0.3;
        
        this.renderer.save();
        this.renderer.setAlpha(0.7);
        this.renderer.setStrokeStyle('rgba(255, 255, 0, 0.9)', 3);
        
        // Draw arrow based on direction
        switch (direction) {
            case 'UP':
                this.renderer.drawLine(centerX, centerY, centerX, centerY - arrowSize);
                this.renderer.drawLine(centerX, centerY - arrowSize, centerX - arrowSize / 3, centerY - arrowSize * 0.6);
                this.renderer.drawLine(centerX, centerY - arrowSize, centerX + arrowSize / 3, centerY - arrowSize * 0.6);
                break;
            case 'DOWN':
                this.renderer.drawLine(centerX, centerY, centerX, centerY + arrowSize);
                this.renderer.drawLine(centerX, centerY + arrowSize, centerX - arrowSize / 3, centerY + arrowSize * 0.6);
                this.renderer.drawLine(centerX, centerY + arrowSize, centerX + arrowSize / 3, centerY + arrowSize * 0.6);
                break;
            case 'LEFT':
                this.renderer.drawLine(centerX, centerY, centerX - arrowSize, centerY);
                this.renderer.drawLine(centerX - arrowSize, centerY, centerX - arrowSize * 0.6, centerY - arrowSize / 3);
                this.renderer.drawLine(centerX - arrowSize, centerY, centerX - arrowSize * 0.6, centerY + arrowSize / 3);
                break;
            case 'RIGHT':
                this.renderer.drawLine(centerX, centerY, centerX + arrowSize, centerY);
                this.renderer.drawLine(centerX + arrowSize, centerY, centerX + arrowSize * 0.6, centerY - arrowSize / 3);
                this.renderer.drawLine(centerX + arrowSize, centerY, centerX + arrowSize * 0.6, centerY + arrowSize / 3);
                break;
        }
        
        this.renderer.resetAlpha();
        this.renderer.restore();
    }
    
    renderSprites(currentMap, offset, scale) {
        // Render NPCs/Sprites - ALWAYS shown (not controlled by overlay toggle)
        if (currentMap.objects && currentMap.objects.sprites && currentMap.objects.sprites.data && currentMap.objects.sprites.data.length > 0) {
            // Get animated sprite positions if movement is enabled
            const spritePositions = this.movementEnabled ? 
                this.movementEngine.getSpritePositions() : null;
            
            currentMap.objects.sprites.data.forEach((sprite, index) => {
                // Use movement engine position if available, otherwise use static position
                let spriteX = sprite.x;
                let spriteY = sprite.y;
                let facingDirection = 0; // Default facing down
                let animFrame = 0;
                let isWalking = false;
                
                if (spritePositions && spritePositions[index]) {
                    const pos = spritePositions[index];
                    spriteX = pos.pixelX / 16; // Convert pixels back to tiles
                    spriteY = pos.pixelY / 16;
                    facingDirection = pos.facingDirection;
                    animFrame = pos.animFrame;
                    isWalking = pos.isWalking;
                }
                
                const x = offset.x + spriteX * 2 * TILE_SIZE * scale;
                const y = offset.y + spriteY * 2 * TILE_SIZE * scale;
                const size = 2 * TILE_SIZE * scale;
                
                // Draw movement path visualization if overlays are enabled
                if (this.showOverlays && !this.movementEnabled) {
                    this.renderMovementPath(sprite, offset, scale);
                }
                
                // ROM uses 1-based sprite IDs (1-72), our files use 0-based (0-71)
                const spriteFileId = sprite.pictureId - 1;
                
                // Skip invalid sprite IDs (like 255 = unused/disabled sprites)
                if (spriteFileId > 71 || spriteFileId < 0) {
                    return;
                }
                
                // Try to get the actual sprite image
                const spriteImg = this.spriteManager.getSpriteImage(spriteFileId);
                
                if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
                    // Get facing direction and frame info
                    const frameInfo = this.getSpriteFrame(sprite, facingDirection, animFrame, isWalking);
                    
                    // Save context for potential mirroring
                    this.renderer.save();
                    
                    // Apply horizontal flip for right-facing sprites
                    if (frameInfo.mirror) {
                        this.renderer.translate(x + size, y);
                        this.renderer.scale(-1, 1);
                        this.renderer.drawImage(
                            spriteImg,
                            frameInfo.frameX, 0, 16, 16,  // Source frame
                            0, 0, size, size              // Draw at 0,0 due to transform
                        );
                    } else {
                        // Draw normally
                        this.renderer.drawImage(
                            spriteImg,
                            frameInfo.frameX, 0, 16, 16,  // Source frame
                            x, y, size, size
                        );
                    }
                    
                    this.renderer.restore();
                    
                    // Draw overlay indicator on top if overlays are enabled
                    if (this.showOverlays) {
                        this.renderer.setAlpha(0.36);
                        this.renderer.drawRect(x, y, size, size, 'rgba(50, 255, 50, 1.0)', true);
                        this.renderer.resetAlpha();
                        
                        // Draw N label
                        const fontSize = Math.max(12, Math.min(20, size * 0.4));
                        this.renderer.drawText('N', x + size / 2, y + size / 2, {
                            font: `bold ${fontSize}px "Courier New"`,
                            color: '#fff',
                            align: 'center',
                            baseline: 'middle',
                            shadow: true
                        });
                    }
                } else {
                    // Fallback to indicator if sprite not loaded
                    this.renderer.setAlpha(0.5);
                    this.renderer.drawRect(x, y, size, size, '#f0f', true);
                    this.renderer.resetAlpha();
                    
                    // Draw N label
                    const fontSize = Math.max(12, Math.min(20, size * 0.4));
                    this.renderer.drawText('N', x + size / 2, y + size / 2, {
                        font: `bold ${fontSize}px "Courier New"`,
                        color: '#fff',
                        align: 'center',
                        baseline: 'middle',
                        shadow: true
                    });
                    
                    // Try to load the sprite asynchronously
                    this.spriteManager.loadSprite(spriteFileId).then((img) => {
                        if (img) {
                            this.render();
                        }
                    });
                }
            });
        }
    }
    
    renderBoundaryConnections(currentMap, offset, scale) {
        if (!currentMap.connections) return;
        
        const connectionColor = 'rgba(255, 140, 0, 0.8)'; // Orange
        const connectionWidth = TILE_SIZE * scale; // One tile width
        const mapWidthScreen = currentMap.width * BLOCK_SIZE * TILE_SIZE * scale;
        const mapHeightScreen = currentMap.height * BLOCK_SIZE * TILE_SIZE * scale;
        
        // North connection (top edge)
        if (currentMap.connections.north) {
            this.renderer.setAlpha(0.8);
            this.renderer.drawRect(offset.x, offset.y, mapWidthScreen, connectionWidth, 'rgba(255, 140, 0, 1.0)', true);
            this.renderer.resetAlpha();
        }
        
        // South connection (bottom edge)
        if (currentMap.connections.south) {
            this.renderer.setAlpha(0.8);
            this.renderer.drawRect(offset.x, offset.y + mapHeightScreen - connectionWidth, mapWidthScreen, connectionWidth, 'rgba(255, 140, 0, 1.0)', true);
            this.renderer.resetAlpha();
        }
        
        // West connection (left edge)
        if (currentMap.connections.west) {
            this.renderer.setAlpha(0.8);
            this.renderer.drawRect(offset.x, offset.y, connectionWidth, mapHeightScreen, 'rgba(255, 140, 0, 1.0)', true);
            this.renderer.resetAlpha();
        }
        
        // East connection (right edge)
        if (currentMap.connections.east) {
            this.renderer.setAlpha(0.8);
            this.renderer.drawRect(offset.x + mapWidthScreen - connectionWidth, offset.y, connectionWidth, mapHeightScreen, 'rgba(255, 140, 0, 1.0)', true);
            this.renderer.resetAlpha();
        }
    }
    
    // Placeholder methods - will implement properly
    setupMouseControls() {
        let hasDragged = false;
        let mouseDownX = 0;
        let mouseDownY = 0;
        
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            hasDragged = false;
            mouseDownX = e.clientX;
            mouseDownY = e.clientY;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = Math.abs(e.clientX - mouseDownX);
                const dy = Math.abs(e.clientY - mouseDownY);
                if (dx > 5 || dy > 5) {
                    hasDragged = true;
                }
                
                const deltaX = e.clientX - this.dragStart.x;
                const deltaY = e.clientY - this.dragStart.y;
                this.viewportState.pan(deltaX, deltaY);
                this.dragStart = { x: e.clientX, y: e.clientY };
                this.render();
                this.hideTooltip();
            } else if (this.mapState.getCurrentMap()) {
                // Show tile tooltip and handle hover
                this.handleMouseHover(e);
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (!hasDragged && this.showOverlays) {
                // Handle click on objects
                this.handleCanvasClick(e);
            }
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            if (this.hoveredTile) {
                this.hoveredTile = null;
                this.render();
            }
            this.hideTooltip();
            this.canvas.style.cursor = 'default';
        });
        
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
        });
    }
    
    setupKeyboardControls() {
        // Basic keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.key === 'g') {
                this.toggleGrid();
            } else if (e.key === 'o') {
                this.toggleOverlays();
            } else if (e.key === 'c') {
                this.toggleCoordLabels();
            }
        });
    }
    
    handleMouseHover(e) {
        const currentMap = this.mapState.getCurrentMap();
        if (!currentMap) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        const offset = this.viewportState.getOffset();
        const scale = this.viewportState.getScale();
        
        // Convert to TILE coordinates
        const worldTileX = Math.floor((canvasX - offset.x) / (TILE_SIZE * scale));
        const worldTileY = Math.floor((canvasY - offset.y) / (TILE_SIZE * scale));
        
        // Convert tile coordinates to block coordinates
        const mapBlockX = Math.floor(worldTileX / BLOCK_SIZE);
        const mapBlockY = Math.floor(worldTileY / BLOCK_SIZE);
        
        // Calculate which tile within the block
        const tileXInBlock = worldTileX % BLOCK_SIZE;
        const tileYInBlock = worldTileY % BLOCK_SIZE;
        const tileIndexInBlock = tileYInBlock * BLOCK_SIZE + tileXInBlock;
        
        // Check if within map bounds
        if (mapBlockX >= 0 && mapBlockX < currentMap.width && 
            mapBlockY >= 0 && mapBlockY < currentMap.height) {
            
            // Update hovered tile
            const newHovered = {
                blockX: mapBlockX, 
                blockY: mapBlockY,
                tileX: tileXInBlock,
                tileY: tileYInBlock,
                tileIndex: tileIndexInBlock,
                worldTileX: worldTileX,
                worldTileY: worldTileY
            };
            
            if (!this.hoveredTile || 
                this.hoveredTile.worldTileX !== worldTileX || 
                this.hoveredTile.worldTileY !== worldTileY) {
                this.hoveredTile = newHovered;
            }
            
            // Show tooltip only if enabled
            if (this.showTooltip) {
                this.showTileTooltip(e.clientX, e.clientY, mapBlockX, mapBlockY, 
                                tileXInBlock, tileYInBlock, tileIndexInBlock);
            }
            
            // Check if hovering over clickable objects
            const romX = Math.floor(worldTileX / 2);
            const romY = Math.floor(worldTileY / 2);
            
            const isOverWarp = currentMap.objects?.warps?.data?.some(warp => 
                warp.x === romX && warp.y === romY
            );
            
            // Check if over boundary connection
            const mapWidthTiles = currentMap.width * BLOCK_SIZE;
            const mapHeightTiles = currentMap.height * BLOCK_SIZE;
            const isOverBoundary = currentMap.connections && (
                (currentMap.connections.north && worldTileY === 0) ||
                (currentMap.connections.south && worldTileY === mapHeightTiles - 1) ||
                (currentMap.connections.west && worldTileX === 0) ||
                (currentMap.connections.east && worldTileX === mapWidthTiles - 1)
            );
            
            this.canvas.style.cursor = (isOverWarp || isOverBoundary) ? 'pointer' : 'grab';
        } else {
            if (this.hoveredTile) {
                this.hoveredTile = null;
            }
            this.hideTooltip();
            this.canvas.style.cursor = 'default';
        }
    }
    
    async handleCanvasClick(e) {
        const currentMap = this.mapState.getCurrentMap();
        if (!currentMap || !currentMap.objects) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        const offset = this.viewportState.getOffset();
        const scale = this.viewportState.getScale();
        
        // Convert to TILE coordinates
        const tileX = Math.floor((canvasX - offset.x) / (TILE_SIZE * scale));
        const tileY = Math.floor((canvasY - offset.y) / (TILE_SIZE * scale));
        
        // ROM object coords are in 2-TILE units
        const romX = Math.floor(tileX / 2);
        const romY = Math.floor(tileY / 2);
        
        Logger.log(`Clicked at tile (${tileX}, ${tileY}) = ROM coords (${romX}, ${romY})`);
        
        // Check boundary connections first
        const mapWidthTiles = currentMap.width * BLOCK_SIZE;
        const mapHeightTiles = currentMap.height * BLOCK_SIZE;
        
        if (currentMap.connections && currentMap.connectionHeaders) {
            const boundaryThreshold = 1;
            
            if (currentMap.connections.north && tileY >= 0 && tileY < boundaryThreshold) {
                Logger.log('Clicked on NORTH boundary');
                this.loadMap(currentMap.connectionHeaders.north.connectedMap);
                return;
            }
            
            if (currentMap.connections.south && tileY >= mapHeightTiles - boundaryThreshold) {
                Logger.log('Clicked on SOUTH boundary');
                this.loadMap(currentMap.connectionHeaders.south.connectedMap);
                return;
            }
            
            if (currentMap.connections.west && tileX >= 0 && tileX < boundaryThreshold) {
                Logger.log('Clicked on WEST boundary');
                this.loadMap(currentMap.connectionHeaders.west.connectedMap);
                return;
            }
            
            if (currentMap.connections.east && tileX >= mapWidthTiles - boundaryThreshold) {
                Logger.log('Clicked on EAST boundary');
                this.loadMap(currentMap.connectionHeaders.east.connectedMap);
                return;
            }
        }
        
        // Check for warp click
        if (currentMap.objects.warps?.data) {
            const clickedWarp = currentMap.objects.warps.data.find(warp => 
                warp.x === romX && warp.y === romY
            );
            
            if (clickedWarp) {
                Logger.log(`Clicked on warp to map ${clickedWarp.mapId}`);
                
                if (clickedWarp.mapId === 255) {
                    // Return to source overworld map - find it dynamically
                    Logger.log('Warp 255 detected - finding source overworld map...');
                    const sourceMap = await this.mapDataManager.findSourceOverworldMap(currentMap.mapId);
                    if (sourceMap) {
                        Logger.log(`Returning to map ${sourceMap.mapId} at (${sourceMap.x}, ${sourceMap.y})`);
                        this.loadMap(sourceMap.mapId);
                    } else {
                        Logger.warn('No source overworld map found, defaulting to Pallet Town');
                        this.loadMap(0); // Fallback to Pallet Town
                    }
                } else if (clickedWarp.mapId > 0) {
                    // Try to load the target map, but if it fails, find and return to source map
                    try {
                        await this.loadMap(clickedWarp.mapId, { suppressErrorUI: true });
                    } catch (error) {
                        // Silently handle the error - this is expected for broken maps like elevators
                        Logger.log(`Map ${clickedWarp.mapId} unavailable, finding source map...`);
                        
                        // Get preferred source map from localStorage
                        const preferredMapId = this.preferences.loadPreviousMap();
                        
                        // Find which map(s) have warps to current map
                        const sourceMap = await this.mapDataManager.findSourceMapsWithWarp(
                            currentMap.mapId, 
                            preferredMapId
                        );
                        
                        if (sourceMap) {
                            Logger.log(`Returning to source map ${sourceMap.mapId} (${sourceMap.mapName})`);
                            this.loadMap(sourceMap.mapId);
                        } else {
                            Logger.warn('No source map found, defaulting to Pallet Town');
                            this.loadMap(0);
                        }
                    }
                }
                return;
            }
        }
        
        // Check for sprite click
        if (currentMap.objects.sprites?.data) {
            const clickedSprite = currentMap.objects.sprites.data.find(sprite => 
                sprite.x === romX && sprite.y === romY
            );
            
            if (clickedSprite) {
                Logger.log('Clicked on sprite:', clickedSprite);
                this.showSpriteModal(clickedSprite, romX, romY);
                return;
            }
        }
        
        // Check for sign click
        if (currentMap.objects.signs?.data) {
            const clickedSign = currentMap.objects.signs.data.find(sign => 
                sign.x === romX && sign.y === romY
            );
            
            if (clickedSign) {
                Logger.log('Clicked on sign:', clickedSign);
                this.showSignModal(clickedSign, romX, romY);
                return;
            }
        }
    }
    
    showSpriteModal(sprite, romX, romY) {
        const frameInfo = this.getSpriteFrame(sprite);
        
        const modalContent = document.getElementById('npcModalContent');
        const modalTitle = document.getElementById('npcModalLabel');
        
        if (!modalContent || !modalTitle) return;
        
        // Update modal title
        modalTitle.innerHTML = '<i class="bi bi-person-circle"></i> NPC Information';
        
        // Build script text display
        let scriptTextHTML = '';
        if (sprite.scriptText) {
            if (sprite.scriptText.error) {
                scriptTextHTML = `
                    <div class="alert alert-warning mt-3 mb-0" role="alert">
                        <i class="bi bi-exclamation-triangle"></i> <strong>Script Error:</strong> ${sprite.scriptText.error}
                    </div>
                `;
            } else {
                // Determine alert style based on content type
                let bgStyle = '#1e4620';
                let headerColor = '#a3cfbb';
                let textBg = '#2d2d2d';
                let textColor = '#e0e0e0';
                let borderColor = '#3d7d4a';
                let iconClass = 'bi-chat-square-text';
                let title = 'Message Text:';
                
                if (sprite.scriptText.isSpecialScript) {
                    bgStyle = '#1a3a52';
                    headerColor = '#7db3d5';
                    borderColor = '#2d5f7f';
                    iconClass = 'bi-code-square';
                    title = 'Special Script:';
                } else if (sprite.scriptText.isTrainer) {
                    bgStyle = '#523a1a';
                    headerColor = '#d5b37d';
                    borderColor = '#7f5f2d';
                    iconClass = 'bi-person-badge';
                    title = 'Trainer Encounter:';
                } else if (sprite.scriptText.isInvalidPointer) {
                    bgStyle = '#2d2d2d';
                    headerColor = '#999999';
                    borderColor = '#4d4d4d';
                    iconClass = 'bi-x-circle';
                    title = 'Invalid Data:';
                }
                
                // Clean up the decoded text for display
                const cleanText = (text) => {
                    if (!text) return '';
                    return text
                        // Replace control codes with proper formatting
                        .replace(/\[CONT\]/g, '\n')           // Continue on next line
                        .replace(/▼\[NULL\]/g, '\n\n')         // Paragraph break
                        .replace(/▼/g, '\n')                   // Line break
                        .replace(/\[NULL\]/g, '')              // Remove NULL markers
                        .replace(/\[PLAYER\]/g, 'RED')         // Player name
                        .replace(/\[RIVAL\]/g, 'BLUE')         // Rival name
                        .replace(/\[TARGET\]/g, '')            // Target marker
                        .replace(/\[USER\]/g, '')              // User marker
                        .replace(/\[VAR\]/g, '[...]')          // Variable placeholder
                        .replace(/\[NUM\]/g, '[#]')            // Number placeholder
                        .replace(/\[BCD\]/g, '[#]')            // BCD number placeholder
                        .replace(/\[ASM\]/g, '[Code]')         // Assembly code
                        .trim();
                };
                
                const displayText = cleanText(sprite.scriptText.decodedText);
                
                // Display decoded text prominently at the top (always show if exists)
                const decodedTextHTML = displayText 
                    ? `
                        <div class="mt-3 mb-2 border rounded" role="alert" style="background-color: ${bgStyle}; border-color: ${borderColor} !important; border-width: 2px;">
                            <h6 class="mb-2 p-2" style="color: ${headerColor}; font-weight: bold;"><i class="bi ${iconClass}"></i> ${title}</h6>
                            <div class="p-3 mx-2 mb-2 border rounded" style="font-family: 'Courier New', monospace; font-size: 1.1em; white-space: pre-wrap; line-height: 1.6; background-color: ${textBg}; color: ${textColor}; border-color: ${borderColor} !important;">
${displayText}
                            </div>
                        </div>
                      `
                    : '';
                
                scriptTextHTML = `
                    ${decodedTextHTML}
                    <details class="mt-2">
                        <summary class="btn btn-sm btn-outline-secondary mb-2">
                            <i class="bi bi-code-square"></i> Show Raw Data & Metadata
                        </summary>
                        <div class="alert alert-dark mb-0" role="alert">
                            ${sprite.scriptText.hexString ? `
                                <div class="mb-2"><strong><i class="bi bi-file-binary"></i> Hex Bytes:</strong></div>
                                <div class="font-monospace bg-dark text-light p-2 rounded border" style="font-size: 0.75em; overflow-x: auto; white-space: pre;">
${sprite.scriptText.hexString}
                                </div>
                            ` : '<div class="text-muted"><i class="bi bi-info-circle"></i> No hex data (Special script or trainer)</div>'}
                            <div class="mt-3 p-2 bg-secondary rounded">
                                <small>
                                    <strong><i class="bi bi-info-circle"></i> Metadata:</strong><br>
                                    Text ID: <span class="badge bg-primary">${sprite.scriptText.textId}</span><br>
                                    ${sprite.scriptText.isSpecialScript ? `Script Type: <span class="badge bg-info">${sprite.scriptText.scriptType}</span><br>` : ''}
                                    ${sprite.scriptText.isTrainer ? `Type: <span class="badge bg-warning text-dark">Trainer/Event</span><br>` : ''}
                                    ${sprite.scriptText.isInvalidPointer ? `Pointer: <span class="badge bg-danger">${sprite.scriptText.textDataPtr}</span> (Invalid)<br>` : ''}
                                    ${sprite.scriptText.romOffset && sprite.scriptText.romOffset !== 'Unknown' ? `ROM Offset: <code>${sprite.scriptText.romOffset}</code><br>` : ''}
                                    ${sprite.scriptText.textDataPtr && sprite.scriptText.textDataPtr !== 'Unknown' && !sprite.scriptText.isInvalidPointer ? `Text Pointer: <code>${sprite.scriptText.textDataPtr}</code><br>` : ''}
                                    ${sprite.scriptText.textPtrTable ? `Text Table: <code>${sprite.scriptText.textPtrTable}</code><br>` : ''}
                                    Length: <span class="badge bg-secondary">${sprite.scriptText.length || 0} bytes</span>
                                </small>
                            </div>
                        </div>
                    </details>
                `;
            }
        } else {
            scriptTextHTML = `
                <div class="alert alert-secondary mt-3 mb-0" role="alert">
                    <i class="bi bi-info-circle"></i> <small>No script text available for this NPC.</small>
                </div>
            `;
        }
        
        modalContent.innerHTML = `
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-geo-alt"></i> Position (ROM):</span>
                <span class="npc-info-value">(${romX}, ${romY})</span>
            </div>
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-grid"></i> Position (Tile):</span>
                <span class="npc-info-value">(${romX * 2}, ${romY * 2})</span>
            </div>
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-image"></i> Picture ID:</span>
                <span class="npc-info-value badge bg-primary">${sprite.pictureId}</span>
            </div>
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-tag"></i> Type:</span>
                <span class="npc-info-value badge bg-secondary">${sprite.type}</span>
            </div>
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-compass"></i> Facing:</span>
                <span class="npc-info-value badge bg-warning text-dark">${frameInfo.facing.toUpperCase()}</span>
            </div>
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-arrows-move"></i> Movement Type:</span>
                <span class="npc-info-value">
                    ${sprite.movement && sprite.movement.type ? 
                        `<span class="badge bg-info">${sprite.movement.type}</span> 
                         ${sprite.movement.direction ? `<span class="badge bg-secondary">${sprite.movement.direction}</span>` : ''}` :
                        `<span class="badge bg-info">0x${(sprite.movement?.byte1 || 0).toString(16).toUpperCase()}</span>`
                    }
                </span>
            </div>
            ${sprite.movement && sprite.movement.description ? `
            <div class="alert alert-secondary mb-2 py-2" role="alert">
                <small><i class="bi bi-info-circle"></i> <strong>Movement Pattern:</strong> ${sprite.movement.description}</small>
            </div>
            ` : ''}
            ${sprite.range !== undefined ? `
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-bullseye"></i> Movement Range:</span>
                <span class="npc-info-value badge bg-primary">${sprite.range} tile(s)</span>
            </div>
            ` : ''}
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-chat-left-text"></i> Text/Script ID:</span>
                <span class="npc-info-value badge bg-success">${sprite.textId}</span>
            </div>
            ${scriptTextHTML}
        `;
        
        // Show the modal
        const modalElement = document.getElementById('npcModal');
        if (modalElement && typeof bootstrap !== 'undefined') {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }
    
    showSignModal(sign, romX, romY) {
        const modalContent = document.getElementById('npcModalContent');
        const modalTitle = document.getElementById('npcModalLabel');
        
        if (!modalContent || !modalTitle) return;
        
        // Update modal title
        modalTitle.innerHTML = '<i class="bi bi-sign-stop"></i> Sign Information';
        
        // Build script text display
        let scriptTextHTML = '';
        if (sign.scriptText) {
            if (sign.scriptText.error) {
                scriptTextHTML = `
                    <div class="alert alert-warning mt-3 mb-0" role="alert">
                        <i class="bi bi-exclamation-triangle"></i> <strong>Script Error:</strong> ${sign.scriptText.error}
                    </div>
                `;
            } else {
                // Determine alert style based on content type
                let bgStyle = '#1e4620';
                let headerColor = '#a3cfbb';
                let textBg = '#2d2d2d';
                let textColor = '#e0e0e0';
                let borderColor = '#3d7d4a';
                let iconClass = 'bi-chat-square-text';
                let title = 'Sign Text:';
                
                if (sign.scriptText.isSpecialScript) {
                    bgStyle = '#1a3a52';
                    headerColor = '#7db3d5';
                    borderColor = '#2d5f7f';
                    iconClass = 'bi-code-square';
                    title = 'Special Script:';
                } else if (sign.scriptText.isInvalidPointer) {
                    bgStyle = '#2d2d2d';
                    headerColor = '#999999';
                    borderColor = '#4d4d4d';
                    iconClass = 'bi-x-circle';
                    title = 'Invalid Data:';
                }
                
                // Clean up the decoded text for display
                const cleanText = (text) => {
                    if (!text) return '';
                    return text
                        // Replace control codes with proper formatting
                        .replace(/\[CONT\]/g, '\n')           // Continue on next line
                        .replace(/▼\[NULL\]/g, '\n\n')         // Paragraph break
                        .replace(/▼/g, '\n')                   // Line break
                        .replace(/\[NULL\]/g, '')              // Remove NULL markers
                        .replace(/\[PLAYER\]/g, 'RED')         // Player name
                        .replace(/\[RIVAL\]/g, 'BLUE')         // Rival name
                        .replace(/\[TARGET\]/g, '')            // Target marker
                        .replace(/\[USER\]/g, '')              // User marker
                        .replace(/\[VAR\]/g, '[...]')          // Variable placeholder
                        .replace(/\[NUM\]/g, '[#]')            // Number placeholder
                        .replace(/\[BCD\]/g, '[#]')            // BCD number placeholder
                        .replace(/\[ASM\]/g, '[Code]')         // Assembly code
                        .trim();
                };
                
                const displayText = cleanText(sign.scriptText.decodedText);
                
                // Display decoded text prominently at the top (always show if exists)
                const decodedTextHTML = displayText 
                    ? `
                        <div class="mt-3 mb-2 border rounded" role="alert" style="background-color: ${bgStyle}; border-color: ${borderColor} !important; border-width: 2px;">
                            <h6 class="mb-2 p-2" style="color: ${headerColor}; font-weight: bold;"><i class="bi ${iconClass}"></i> ${title}</h6>
                            <div class="p-3 mx-2 mb-2 border rounded" style="font-family: 'Courier New', monospace; font-size: 1.1em; white-space: pre-wrap; line-height: 1.6; background-color: ${textBg}; color: ${textColor}; border-color: ${borderColor} !important;">
${displayText}
                            </div>
                        </div>
                      `
                    : '';
                
                scriptTextHTML = `
                    ${decodedTextHTML}
                    <details class="mt-2">
                        <summary class="btn btn-sm btn-outline-secondary mb-2">
                            <i class="bi bi-code-square"></i> Show Raw Data & Metadata
                        </summary>
                        <div class="alert alert-dark mb-0" role="alert">
                            ${sign.scriptText.hexString ? `
                                <div class="mb-2"><strong><i class="bi bi-file-binary"></i> Hex Bytes:</strong></div>
                                <div class="font-monospace bg-dark text-light p-2 rounded border" style="font-size: 0.75em; overflow-x: auto; white-space: pre;">
${sign.scriptText.hexString}
                                </div>
                            ` : '<div class="text-muted"><i class="bi bi-info-circle"></i> No hex data (Special script)</div>'}
                            <div class="mt-3 p-2 bg-secondary rounded">
                                <small>
                                    <strong><i class="bi bi-info-circle"></i> Metadata:</strong><br>
                                    Text ID: <span class="badge bg-primary">${sign.scriptText.textId}</span><br>
                                    ${sign.scriptText.isSpecialScript ? `Script Type: <span class="badge bg-info">${sign.scriptText.scriptType}</span><br>` : ''}
                                    ${sign.scriptText.isInvalidPointer ? `Pointer: <span class="badge bg-danger">${sign.scriptText.textDataPtr}</span> (Invalid)<br>` : ''}
                                    ${sign.scriptText.romOffset && sign.scriptText.romOffset !== 'Unknown' ? `ROM Offset: <code>${sign.scriptText.romOffset}</code><br>` : ''}
                                    ${sign.scriptText.textDataPtr && sign.scriptText.textDataPtr !== 'Unknown' && !sign.scriptText.isInvalidPointer ? `Text Pointer: <code>${sign.scriptText.textDataPtr}</code><br>` : ''}
                                    ${sign.scriptText.textPtrTable ? `Text Table: <code>${sign.scriptText.textPtrTable}</code><br>` : ''}
                                    Length: <span class="badge bg-secondary">${sign.scriptText.length || 0} bytes</span>
                                </small>
                            </div>
                        </div>
                    </details>
                `;
            }
        } else {
            scriptTextHTML = `
                <div class="alert alert-secondary mt-3 mb-0" role="alert">
                    <i class="bi bi-info-circle"></i> <small>No script text available for this sign.</small>
                </div>
            `;
        }
        
        modalContent.innerHTML = `
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-geo-alt"></i> Position (ROM):</span>
                <span class="npc-info-value">(${romX}, ${romY})</span>
            </div>
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-grid"></i> Position (Tile):</span>
                <span class="npc-info-value">(${romX * 2}, ${romY * 2})</span>
            </div>
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-chat-left-text"></i> Text ID:</span>
                <span class="npc-info-value badge bg-success">${sign.textId}</span>
            </div>
            ${scriptTextHTML}
        `;
        
        // Show the modal
        const modalElement = document.getElementById('npcModal');
        if (modalElement && typeof bootstrap !== 'undefined') {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
            
            // Reset title when modal is hidden
            modalElement.addEventListener('hidden.bs.modal', function () {
                modalTitle.innerHTML = '<i class="bi bi-person-circle"></i> NPC Information';
            }, { once: true });
        }
    }
    
    showTileTooltip(mouseX, mouseY, blockX, blockY, tileX, tileY, tileIndex) {
        const tooltip = document.getElementById('tileTooltip');
        const currentMap = this.mapState.getCurrentMap();
        if (!tooltip || !currentMap) return;
        
        // Get block data
        const blockIndex = blockY * currentMap.width + blockX;
        const blockId = currentMap.blockData[blockIndex];
        
        // Get tile ID from block definition (NEW: tile-based system)
        const tileId = this.tilesetManager.getTileInBlock(currentMap.tileset, blockId, tileY, tileX);
        
        // Get collision info for this specific TILE (not block)
        let collisionColor = '#999';
        let collisionIcon = '⬜';
        let collisionInfo = null;
        
        if (tileId !== null) {
            const isPassable = this.tilesetManager.isTilePassable(currentMap.tileset, tileId);
            const isGrass = this.tilesetManager.isGrassTile(currentMap.tileset, tileId);
            const isWater = this.tilesetManager.isWaterTile(tileId);
            const isLedge = this.tilesetManager.isLedgeTile(tileId);
            
            // Build collision info object for display
            collisionInfo = {
                tileId: tileId,
                walkable: isPassable,
                surfable: isWater,
                type: 'PASSABLE'
            };
            
            if (isGrass) {
                collisionInfo.type = 'GRASS';
                collisionColor = '#00ff00';
                collisionIcon = '🌿';
            } else if (isWater) {
                collisionInfo.type = 'WATER';
                collisionColor = '#0066ff';
                collisionIcon = '🌊';
            } else if (isLedge) {
                collisionInfo.type = 'LEDGE';
                collisionColor = '#ff8800';
                collisionIcon = '⬇️';
            } else if (!isPassable) {
                collisionInfo.type = 'WALL';
                collisionColor = '#ff0000';
                collisionIcon = '🧱';
            } else {
                collisionColor = '#00ff88';
                collisionIcon = '✅';
            }
        }
        
        // Build tooltip content
        let content = `<div style="font-weight: bold; margin-bottom: 4px; color: #ffff00;">Tile Info</div>`;
        content += `<div style="color: #00ff00;">Tile in Block: (${tileX}, ${tileY}) [${tileIndex}/15]</div>`;
        content += `Tile ID: ${tileId} (0x${typeof tileId === 'number' ? tileId.toString(16).toUpperCase().padStart(2, '0') : '??'})<br>`;
        content += `<div style="border-top: 1px solid #666; margin: 4px 0;"></div>`;
        content += `<div style="font-weight: bold; color: #4ecdc4;">Block Info</div>`;
        content += `Block Position: (${blockX}, ${blockY})<br>`;
        content += `Block ID: ${blockId} (0x${blockId.toString(16).toUpperCase().padStart(2, '0')})<br>`;
        content += `Block Index: ${blockIndex}<br>`;
        
        // Add collision info
        if (collisionInfo) {
            content += `<div style="border-top: 1px solid #666; margin: 4px 0;"></div>`;
            content += `<div style="font-weight: bold; color: ${collisionColor};">${collisionIcon} Collision Type</div>`;
            content += `Type: <span style="color: ${collisionColor};">${collisionInfo.type}</span><br>`;
            content += `Walkable: <span style="color: ${collisionInfo.walkable ? '#00ff00' : '#ff0000'};">${collisionInfo.walkable ? 'Yes ✓' : 'No ✗'}</span><br>`;
            if (collisionInfo.surfable) {
                content += `Surfable: <span style="color: #0088ff;">Yes 🏄</span><br>`;
            }
            if (collisionInfo.description) {
                content += `<span style="color: #aaa; font-size: 0.9em;">${collisionInfo.description}</span><br>`;
            }
        }
        
        // Check for objects at this position
        if (currentMap.objects) {
            let hasObjects = false;
            let objectsInfo = `<div style="border-top: 1px solid #4ecdc4; margin-top: 4px; padding-top: 4px;">`;
            objectsInfo += `<span style="color: #4ecdc4;">Objects:</span><br>`;
            
            const mapTileX = blockX * BLOCK_SIZE;
            const mapTileY = blockY * BLOCK_SIZE;
            const romX = Math.floor(mapTileX / 2);
            const romY = Math.floor(mapTileY / 2);
            
            const warp = currentMap.objects.warps?.data?.find(w => w.x === romX && w.y === romY);
            if (warp) {
                hasObjects = true;
                objectsInfo += `🚪 <span style="color: #ffff00; font-weight: bold;">Warp</span><br>`;
                objectsInfo += `   Destination: <span style="color: #00ffff;">Map ${warp.mapId}</span><br>`;
                if (warp.destWarpId !== undefined) {
                    objectsInfo += `   Warp ID: <span style="color: #ffaa00;">${warp.destWarpId}</span><br>`;
                }
                objectsInfo += `   <span style="color: #888;">Position: (${warp.x}, ${warp.y})</span><br>`;
            }
            
            const sign = currentMap.objects.signs?.data?.find(s => s.x === romX && s.y === romY);
            if (sign) {
                hasObjects = true;
                objectsInfo += `📋 <span style="color: #88ff88; font-weight: bold;">Sign/Script</span><br>`;
                objectsInfo += `   Text ID: <span style="color: #ffff00;">${sign.textId}</span><br>`;
                objectsInfo += `   <span style="color: #888;">Position: (${sign.x}, ${sign.y})</span><br>`;
            }
            
            const sprite = currentMap.objects.sprites?.data?.find(s => s.x === romX && s.y === romY);
            if (sprite) {
                hasObjects = true;
                const frameInfo = this.getSpriteFrame(sprite);
                const movementInfo = getMovementInfo(sprite.movement);
                objectsInfo += `👤 <span style="color: #ff88ff; font-weight: bold;">${sprite.type.toUpperCase()}</span><br>`;
                objectsInfo += `   <span style="color: #ffa500;">Picture ID: ${sprite.pictureId}</span><br>`;
                objectsInfo += `   <span style="color: #ffff00;">Text/Script ID: ${sprite.textId}</span><br>`;
                objectsInfo += `   <span style="color: #00ff88;">Facing: ${frameInfo.facing}</span><br>`;
                objectsInfo += `   <span style="color: #88ff88;">Movement: ${movementInfo.name}</span><br>`;
                objectsInfo += `   <span style="color: #aaa; font-size: 0.85em;">${movementInfo.description}</span><br>`;
            }
            
            if (hasObjects) {
                objectsInfo += `</div>`;
                content += objectsInfo;
            }
        }
        
        tooltip.innerHTML = content;
        tooltip.style.display = 'block';
        
        // Position tooltip
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        let left = mouseX + 10;
        let top = mouseY + 10;
        
        // Keep tooltip within window bounds
        if (left + tooltipWidth > window.innerWidth) {
            left = mouseX - tooltipWidth - 10;
        }
        if (top + tooltipHeight > window.innerHeight) {
            top = mouseY - tooltipHeight - 10;
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }
    
    hideTooltip() {
        const tooltip = document.getElementById('tileTooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    setupUIControls() {
        // Sidebar toggle
        const toggleBtn = document.getElementById('toggleSidebarBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleSidebar());
        }
        
        // Zoom controls
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const resetZoomBtn = document.getElementById('resetZoomBtn');
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (resetZoomBtn) resetZoomBtn.addEventListener('click', () => this.resetView());
        
        // Debug controls
        const printCollisionBtn = document.getElementById('printCollisionBtn');
        if (printCollisionBtn) printCollisionBtn.addEventListener('click', () => this.printCollisionData());
        
        // Overlay toggles
        const overlaysCheckbox = document.getElementById('showOverlaysCheckbox');
        const gridCheckbox = document.getElementById('showGridCheckbox');
        const coordsCheckbox = document.getElementById('showCoordsCheckbox');
        const tooltipCheckbox = document.getElementById('showTooltipCheckbox');
        const npcMovementCheckbox = document.getElementById('npcMovementCheckbox');
        
        if (overlaysCheckbox) {
            overlaysCheckbox.checked = this.showOverlays;
            overlaysCheckbox.addEventListener('change', (e) => {
                this.showOverlays = e.target.checked;
                this.preferences.saveShowOverlays(this.showOverlays);
                this.render();
            });
        }
        
        if (gridCheckbox) {
            gridCheckbox.checked = this.showGrid;
            gridCheckbox.addEventListener('change', (e) => {
                this.showGrid = e.target.checked;
                this.preferences.saveShowGrid(this.showGrid);
                this.render();
            });
        }
        
        if (coordsCheckbox) {
            coordsCheckbox.checked = this.showCoordLabels;
            coordsCheckbox.addEventListener('change', (e) => {
                this.showCoordLabels = e.target.checked;
                this.preferences.saveShowCoordLabels(this.showCoordLabels);
                this.render();
            });
        }
        
        if (tooltipCheckbox) {
            tooltipCheckbox.checked = this.showTooltip;
            tooltipCheckbox.addEventListener('change', (e) => {
                this.showTooltip = e.target.checked;
                this.preferences.saveShowTooltip(this.showTooltip);
                if (!this.showTooltip) {
                    this.hideTooltip();
                }
            });
        }
        
        if (npcMovementCheckbox) {
            npcMovementCheckbox.checked = this.movementEnabled;
            npcMovementCheckbox.addEventListener('change', (e) => {
                this.movementEnabled = e.target.checked;
                if (this.movementEnabled) {
                    Logger.log('NPC movement enabled');
                    this.movementEngine.start();
                } else {
                    Logger.log('NPC movement disabled');
                    this.movementEngine.stop();
                    this.movementEngine.resetAllSprites();
                    this.render(); // Re-render with static positions
                }
            });
        }
    }
    
    // Control methods
    zoomIn() {
        if (this.viewportState.zoomIn(this.renderer.getWidth(), this.renderer.getHeight())) {
            this.preferences.saveZoom(this.viewportState.getScale());
            this.updateZoomDisplay();
            this.render();
        }
    }
    
    zoomOut() {
        if (this.viewportState.zoomOut(this.renderer.getWidth(), this.renderer.getHeight())) {
            this.preferences.saveZoom(this.viewportState.getScale());
            this.updateZoomDisplay();
            this.render();
        }
    }
    
    resetView() {
        this.viewportState.resetView();
        this.preferences.saveZoom(this.viewportState.getScale());
        this.updateZoomDisplay();
        this.render();
    }
    
    toggleOverlays() {
        this.showOverlays = !this.showOverlays;
        this.preferences.saveShowOverlays(this.showOverlays);
        Logger.log(`Overlays: ${this.showOverlays ? 'ON' : 'OFF'}`);
        this.render();
    }
    
    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.preferences.saveShowGrid(this.showGrid);
        Logger.log(`Grid: ${this.showGrid ? 'ON' : 'OFF'}`);
        this.render();
    }
    
    toggleCoordLabels() {
        this.showCoordLabels = !this.showCoordLabels;
        this.preferences.saveShowCoordLabels(this.showCoordLabels);
        Logger.log(`Coordinates: ${this.showCoordLabels ? 'ON' : 'OFF'}`);
        this.render();
    }
    
    printCollisionData() {
        console.clear();
        console.log('═══════════════════════════════════════════════════════');
        console.log('🗺️  COLLISION DATA DEBUG');
        console.log('═══════════════════════════════════════════════════════');
        
        if (!this.currentMap) {
            console.log('\nNo map currently loaded - will show data from first available tileset');
        } else {
            console.log(`\nCurrent Map: ${this.currentMap.name} (ID: ${this.currentMap.id})`);
        }
        
        // Get tileset ID
        let tilesetId = this.currentMap ? this.currentMap.tileset : null;
        
        // If no map loaded, use first available tileset
        if (tilesetId === null) {
            const availableTilesets = Object.keys(this.tilesetManager.tilesetCollisionData || {});
            console.log('Available tilesets:', availableTilesets);
            if (availableTilesets.length > 0) {
                tilesetId = parseInt(availableTilesets[0]);
                console.log(`Using first available tileset: ${tilesetId}`);
            } else {
                console.error('No tileset data available!');
                console.log('Full tilesetCollisionData:', this.tilesetManager.tilesetCollisionData);
                return;
            }
        }
        
        console.log(`\nTileset ID: ${tilesetId}`);
        
        const collisionData = this.tilesetManager.tilesetCollisionData[tilesetId];
        
        if (!collisionData) {
            console.warn(`⚠️  No collision data found for tileset ${tilesetId}`);
            console.log('\n� Available tilesets:', Object.keys(this.tilesetManager.tilesetCollisionData));
            return;
        }
        
        console.log(`📦 Total Collision Entries: ${Object.values(collisionData).length}`);
        
        // Calculate statistics
        const stats = {
            walkable: 0,
            blocked: 0,
            types: {}
        };
        
        Object.values(collisionData).forEach(entry => {
            if (entry.walkable) {
                stats.walkable++;
            } else {
                stats.blocked++;
            }
            
            const type = entry.type || 'UNKNOWN';
            stats.types[type] = (stats.types[type] || 0) + 1;
        });
        
        console.log(`\n🚶 Walkable Tiles: ${stats.walkable} (${(stats.walkable/Object.values(collisionData).length*100).toFixed(1)}%)`);
        console.log(`🚫 Blocked Tiles: ${stats.blocked} (${(stats.blocked/Object.values(collisionData).length*100).toFixed(1)}%)`);
        
        console.log('\n📋 Collision Types Distribution:');
        Object.entries(stats.types)
            .sort((a, b) => b[1] - a[1])
            .forEach(([type, count]) => {
                const pct = (count/Object.values(collisionData).length*100).toFixed(1);
                console.log(`   ${type.padEnd(20)} ${count.toString().padStart(3)} (${pct}%)`);
            });
        
        // Sample tiles
        console.log('\n🔍 Sample Collision Values (first 20):');
        console.table(
            Object.values(collisionData).slice(0, 20).map(entry => ({
                'Tile ID': entry.tileId,
                'Value (hex)': '0x' + entry.value.toString(16).toUpperCase().padStart(2, '0'),
                'Value (dec)': entry.value,
                'Type': entry.type,
                'Walkable': entry.walkable ? '✓' : '✗',
                'Description': entry.description || '-'
            }))
        );
        
        // Full data
        console.log('\n📦 Full Collision Data Array:');
        console.log(collisionData);
        
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('✅ Collision data printed to console');
        console.log('═══════════════════════════════════════════════════════\n');
    }
    
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('toggleSidebarBtn');
        
        if (!sidebar || !toggleBtn) return;
        
        sidebar.classList.toggle('hidden');
        const isHidden = sidebar.classList.contains('hidden');
        
        if (isHidden) {
            toggleBtn.classList.remove('sidebar-visible');
            toggleBtn.textContent = '☰';
        } else {
            toggleBtn.classList.add('sidebar-visible');
            toggleBtn.textContent = '✕';
        }
        
        this.preferences.saveSidebarState(isHidden);
        
        setTimeout(() => {
            this.resizeCanvas();
        }, 300);
    }
    
    updateZoomDisplay() {
        const zoomEl = document.getElementById('zoomLevel');
        if (zoomEl) {
            zoomEl.textContent = `${this.viewportState.getScale()}x`;
        }
    }
    
    getModuleVersions() {
        return {
            'MapViewer': MODULE_VERSION,
            'Config': CONFIG_VERSION,
            'Logger': LOGGER_VERSION,
            'ErrorHandler': ERROR_HANDLER_VERSION,
            'ViewportState': VIEWPORT_STATE_VERSION,
            'MapState': MAP_STATE_VERSION,
            'PreferencesManager': PREFERENCES_VERSION,
            'CacheManager': CACHE_MANAGER_VERSION,
            'MapDataManager': MAP_DATA_VERSION,
            'TilesetManager': TILESET_VERSION,
            'SpriteManager': SPRITE_VERSION,
            'CanvasRenderer': RENDERER_VERSION
        };
    }
    
    updateVersionFooter(mapCount = null) {
        const footer = document.getElementById('versionFooter');
        if (footer) {
            const moduleVersions = this.getModuleVersions();
            const versionList = Object.entries(moduleVersions)
                .map(([name, version]) => `${name}:${version}`)
                .join(' | ');
            
            const mainInfo = mapCount !== null 
                ? `Map Viewer v${MAP_VIEWER_VERSION} | Build: ${MAP_VIEWER_BUILD_DATE} | Maps: ${mapCount}`
                : `Map Viewer v${MAP_VIEWER_VERSION} | Build: ${MAP_VIEWER_BUILD_DATE}`;
            
            footer.innerHTML = `
                <div class="main-version">${mainInfo}</div>
                <div class="modules">Modules: ${versionList}</div>
            `;
        }
    }
    
    async loadMapList() {
        try {
            Logger.log('Loading map list...');
            const data = await this.mapDataManager.loadMapIndex();
            
            const mapList = document.getElementById('mapList');
            if (!mapList) return;
            
            mapList.innerHTML = '';
            
            // Sort maps by ID
            const sortedMaps = data.maps.sort((a, b) => a.mapId - b.mapId);
            
            // Group maps
            const towns = sortedMaps.filter(m => 
                m.name.includes('Town') || m.name.includes('City') || 
                m.name.includes('Island') || m.name.includes('Plateau')
            );
            const routes = sortedMaps.filter(m => m.name.includes('Route'));
            const indoors = sortedMaps.filter(m => !towns.includes(m) && !routes.includes(m));
            
            Logger.log(`Grouped: ${towns.length} towns, ${routes.length} routes, ${indoors.length} indoor maps`);
            
            // Create sections
            this.createMapSection(mapList, 'Towns & Cities', towns);
            this.createMapSection(mapList, 'Routes', routes);
            this.createMapSection(mapList, 'Indoor Maps', indoors);
            
            // Update version footer
            this.updateVersionFooter(data.maps.length);
            
            // Load saved or first map
            const savedMapId = this.preferences.loadCurrentMap();
            let mapToLoad = null;
            
            if (savedMapId) {
                const savedMap = sortedMaps.find(m => m.mapId === savedMapId);
                if (savedMap) {
                    Logger.log(`Restoring saved map: ${savedMap.name} (ID: ${savedMap.mapId})`);
                    mapToLoad = savedMap.mapId;
                }
            }
            
            if (mapToLoad === null && towns.length > 0) {
                Logger.log(`Loading default map: ${towns[0].name} (ID: ${towns[0].mapId})`);
                mapToLoad = towns[0].mapId;
            }
            
            if (mapToLoad !== null) {
                await this.loadMap(mapToLoad);
            }
            
        } catch (error) {
            this.errorHandler.handle(error, 'Loading map list');
        }
    }
    
    createMapSection(container, title, maps) {
        if (maps.length === 0) return;
        
        const section = document.createElement('div');
        section.style.marginBottom = '15px';
        
        const header = document.createElement('h3');
        header.textContent = title;
        header.style.fontSize = '14px';
        header.style.marginBottom = '5px';
        header.style.color = '#888';
        section.appendChild(header);
        
        maps.forEach(map => {
            const item = document.createElement('div');
            item.className = 'map-item';
            item.textContent = `${String(map.mapId).padStart(3, '0')} - ${map.name}`;
            item.onclick = () => this.loadMap(map.mapId);
            section.appendChild(item);
        });
        
        container.appendChild(section);
    }
    
    async loadMap(mapId, options = {}) {
        const { suppressErrorUI = false } = options;
        
        // Reset debug flags when loading a new map
        this._loggedBlockIds = false;
        
        try {
            const mapData = await this.mapDataManager.loadMap(mapId);
            
            console.log(`[MapViewer] Loading map ${mapId}: ${mapData.name}, tileset: ${mapData.tileset}, size: ${mapData.width}x${mapData.height} blocks`);
            console.log(`[MapViewer] First 10 blockIds:`, mapData.blockData.slice(0, 10));
            
            // Load tileset if needed
            if (!this.tilesetManager.hasTileset(mapData.tileset)) {
                Logger.log(`Loading tileset ${mapData.tileset}...`);
                await this.tilesetManager.loadTileset(mapData.tileset, mapData.tilesetName);
            }
            
            // Load tileset block definitions if needed
            if (!this.tilesetManager.hasBlockDefinitions(mapData.tileset)) {
                Logger.log(`Loading block definitions for tileset ${mapData.tileset}...`);
                await this.tilesetManager.loadTilesetBlocks(mapData.tileset);
                
                // Debug: Show first block definition and its collision
                const firstBlockDef = this.tilesetManager.getBlockDefinition(mapData.tileset, 0);
                console.log(`[MapViewer] First block (ID=0) definition:`, firstBlockDef);
                if (firstBlockDef && firstBlockDef.tiles) {
                    // Show collision info for first row of tiles (4 tiles)
                    console.log(`[MapViewer] First block tile collision info:`, 
                        firstBlockDef.tiles[0].map(tileId => ({
                            tileId,
                            walkable: this.tilesetManager.isTileWalkable(mapData.tileset, tileId),
                            collision: this.tilesetManager.getTileCollision(mapData.tileset, tileId)
                        }))
                    );
                }
            }
            
            // Load sprite metadata if needed
            if (mapData.objects?.sprites?.data && mapData.objects.sprites.data.length > 0) {
                Logger.log(`Preloading ${mapData.objects.sprites.data.length} sprites...`);
                const spriteIds = mapData.objects.sprites.data.map(s => s.pictureId);
                await this.spriteManager.preloadSprites(spriteIds);
                
                // Initialize movement engine with sprite data
                Logger.log(`Initializing NPC movement engine with ${mapData.objects.sprites.data.length} sprites...`);
                this.movementEngine.setTilesetManager(this.tilesetManager);
                this.movementEngine.setCurrentMap(mapData);
                this.movementEngine.initializeSprites(mapData.objects.sprites.data);
                if (this.movementEnabled) {
                    this.movementEngine.start();
                }
            }
            
            // Set current map
            this.mapState.setCurrentMap(mapData);
            this.preferences.saveCurrentMap(mapId);
            
            // Save previous map ID to localStorage
            if (this.mapState.previousMapId !== null) {
                this.preferences.savePreviousMap(this.mapState.previousMapId);
            }
            
            // Update UI
            this.updateMapInfo(mapData);
            this.updateActiveMapItem(mapId);
            
            // Center view without changing zoom
            this.viewportState.resetPosition();
            
            // Render
            this.render();
            
            Logger.success(`Map ${mapId} loaded and rendered successfully`);
            
        } catch (error) {
            // Only show error UI if not suppressed
            if (!suppressErrorUI) {
                this.errorHandler.handle(error, `Loading map ${mapId}`);
            } else {
                Logger.log(`Map ${mapId} failed to load: ${error.message}`);
            }
            throw error; // Rethrow so caller can handle it
        }
    }
    
    updateMapInfo(mapData) {
        const nameEl = document.getElementById('mapName');
        const idEl = document.getElementById('mapId');
        const sizeEl = document.getElementById('mapSize');
        const tilesetEl = document.getElementById('tilesetName');
        
        if (nameEl) nameEl.textContent = mapData.name;
        if (idEl) idEl.textContent = mapData.mapId;
        if (sizeEl) sizeEl.textContent = `${mapData.width}x${mapData.height}`;
        if (tilesetEl) tilesetEl.textContent = mapData.tilesetName;
    }
    
    updateActiveMapItem(mapId) {
        // Remove active class from all map items
        document.querySelectorAll('.map-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to current map
        document.querySelectorAll('.map-item').forEach(item => {
            const itemMapId = parseInt(item.textContent.split(' ')[0]);
            if (itemMapId === mapId) {
                item.classList.add('active');
            }
        });
    }
}

// Export for window access
window.MapViewer = MapViewer;
