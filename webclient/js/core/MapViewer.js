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
        
        // State management
        this.viewportState = new ViewportState();
        this.mapState = new MapState();
        this.preferences = new PreferencesManager();
        
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
            
        } catch (error) {
            this.errorHandler.handle(error, 'Initialization');
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.classList.add('hidden');
            }
        }
    }
    
    restorePreferences() {
        // Restore zoom
        const savedZoom = this.preferences.loadZoom(this.config.defaults.zoom);
        if (savedZoom >= 1 && savedZoom <= 8) {
            this.viewportState.setScale(savedZoom);
            Logger.log(`Restored zoom level: ${savedZoom}x`);
        }
        
        // Restore overlay settings
        const overlaySettings = this.preferences.loadOverlaySettings();
        this.showOverlays = overlaySettings.showOverlays;
        this.showGrid = overlaySettings.showGrid;
        this.showCoordLabels = overlaySettings.showCoordLabels;
        this.showTooltip = overlaySettings.showTooltip !== false; // Default to true
        
        Logger.log(`Restored overlays: ${this.showOverlays ? 'ON' : 'OFF'}`);
        Logger.log(`Restored grid: ${this.showGrid ? 'ON' : 'OFF'}`);
        Logger.log(`Restored coordinates: ${this.showCoordLabels ? 'ON' : 'OFF'}`);
        Logger.log(`Restored tooltip: ${this.showTooltip ? 'ON' : 'OFF'}`);
        
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
            Logger.warn('Cannot render: missing map or tileset');
            return;
        }
        
        Logger.log('Rendering map...');
        
        // Clear canvas
        this.renderer.clear('#000');
        
        const tilesetImg = this.tilesetManager.getTilesetImage(currentMap.tileset);
        const blockDefs = this.tilesetManager.getBlockDefinition(currentMap.tileset, 0); // We'll need all blocks
        
        const scale = this.viewportState.getScale();
        const offset = this.viewportState.getOffset();
        
        const mapWidthPixels = currentMap.width * BLOCK_SIZE * TILE_SIZE;
        const mapHeightPixels = currentMap.height * BLOCK_SIZE * TILE_SIZE;
        
        Logger.info(`Map size: ${mapWidthPixels}x${mapHeightPixels} pixels`);
        Logger.info(`Canvas size: ${this.renderer.getWidth()}x${this.renderer.getHeight()} pixels`);
        Logger.info(`Scale: ${scale}x, Offset: (${offset.x}, ${offset.y})`);
        
        // Calculate visible area
        const startX = Math.max(0, Math.floor(-offset.x / (BLOCK_SIZE * TILE_SIZE * scale)));
        const startY = Math.max(0, Math.floor(-offset.y / (BLOCK_SIZE * TILE_SIZE * scale)));
        const endX = Math.min(currentMap.width - 1, Math.ceil((this.renderer.getWidth() - offset.x) / (BLOCK_SIZE * TILE_SIZE * scale)));
        const endY = Math.min(currentMap.height - 1, Math.ceil((this.renderer.getHeight() - offset.y) / (BLOCK_SIZE * TILE_SIZE * scale)));
        
        // Render map blocks with actual tiles
        const allBlockDefs = this.tilesetManager.tilesetBlockDefinitions[currentMap.tileset];
        
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
                        const tileIndex = tileY * BLOCK_SIZE + tileX;
                        const tileId = blockDef[tileIndex];
                        
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
        
        Logger.success('Render complete');
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
    getSpriteFrame(sprite) {
        // Default to facing down for most cases
        // Movement types: 0=static, 1=random, 2=up/down, 3=left/right, 254=look around, 255=stand still
        
        // For now, default all sprites to facing down
        // In future, could parse movement patterns or add facing to map data
        return {
            facing: 'down',
            frameX: 0,  // Frame 0 = down (x offset in sprite sheet)
            mirror: false
        };
        
        // Future enhancement: movement-based facing
        // if (sprite.movement === 2) return { facing: 'up', frameX: 16, mirror: false };
        // if (sprite.movement === 3) return { facing: 'left', frameX: 32, mirror: false };
    }
    
    renderSprites(currentMap, offset, scale) {
        // Render NPCs/Sprites - ALWAYS shown (not controlled by overlay toggle)
        if (currentMap.objects && currentMap.objects.sprites && currentMap.objects.sprites.data && currentMap.objects.sprites.data.length > 0) {
            currentMap.objects.sprites.data.forEach((sprite, index) => {
                const x = offset.x + sprite.x * 2 * TILE_SIZE * scale;
                const y = offset.y + sprite.y * 2 * TILE_SIZE * scale;
                const size = 2 * TILE_SIZE * scale;
                
                // ROM uses 1-based sprite IDs (1-72), our files use 0-based (0-71)
                const spriteFileId = sprite.pictureId - 1;
                
                // Skip invalid sprite IDs (like 255 = unused/disabled sprites)
                if (spriteFileId > 71 || spriteFileId < 0) {
                    Logger.warn(`Skipping invalid sprite pictureId ${sprite.pictureId} at (${sprite.x}, ${sprite.y})`);
                    return;
                }
                
                // Try to get the actual sprite image
                const spriteImg = this.spriteManager.getSpriteImage(spriteFileId);
                
                if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
                    // Get facing direction and frame info
                    const frameInfo = this.getSpriteFrame(sprite);
                    
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
    
    handleCanvasClick(e) {
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
                    // Return to last overworld map
                    const lastOverworld = this.mapState.getLastOverworldMap();
                    if (lastOverworld !== null) {
                        this.loadMap(lastOverworld);
                    } else {
                        this.loadMap(0); // Fallback to Pallet Town
                    }
                } else if (clickedWarp.mapId > 0) {
                    this.loadMap(clickedWarp.mapId);
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
        const movementInfo = getMovementInfo(sprite.movement);
        const frameInfo = this.getSpriteFrame(sprite);
        
        const modalContent = document.getElementById('npcModalContent');
        const modalTitle = document.getElementById('npcModalLabel');
        
        if (!modalContent || !modalTitle) return;
        
        // Update modal title
        modalTitle.innerHTML = '<i class="bi bi-person-circle"></i> NPC Information';
        
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
                <span class="npc-info-value">${movementInfo.name} <span class="badge bg-info">${sprite.movement} / 0x${sprite.movement.toString(16).toUpperCase()}</span></span>
            </div>
            <div class="alert alert-secondary mb-2 py-2" role="alert">
                <small><i class="bi bi-info-circle"></i> <strong>Movement Pattern:</strong> ${movementInfo.description}</small>
            </div>
            <div class="npc-info-item">
                <span class="npc-info-label"><i class="bi bi-chat-left-text"></i> Text/Script ID:</span>
                <span class="npc-info-value badge bg-success">${sprite.textId}</span>
            </div>
            <div class="alert alert-info mt-2 mb-0" role="alert">
                <i class="bi bi-lightbulb"></i> <small>Script text extraction requires parsing text banks from ROM. Future feature.</small>
            </div>
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
            <div class="alert alert-info mt-3 mb-0" role="alert">
                <i class="bi bi-info-circle"></i> <small>Text content not yet available.</small>
            </div>
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
        
        // Get tile ID from block definition
        const blockDefinitions = this.tilesetManager.tilesetBlockDefinitions[currentMap.tileset];
        let tileId = '?';
        if (blockDefinitions && blockId < blockDefinitions.length) {
            const blockDef = blockDefinitions[blockId];
            tileId = blockDef[tileIndex];
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
                objectsInfo += `🚪 Warp → Map ${warp.mapId} (ROM: ${warp.x},${warp.y})<br>`;
            }
            
            const sign = currentMap.objects.signs?.data?.find(s => s.x === romX && s.y === romY);
            if (sign) {
                hasObjects = true;
                objectsInfo += `📋 Sign (Text ${sign.textId}) (ROM: ${sign.x},${sign.y})<br>`;
            }
            
            const sprite = currentMap.objects.sprites?.data?.find(s => s.x === romX && s.y === romY);
            if (sprite) {
                hasObjects = true;
                const frameInfo = this.getSpriteFrame(sprite);
                const movementInfo = getMovementInfo(sprite.movement);
                objectsInfo += `👤 ${sprite.type.toUpperCase()} (Pic ${sprite.pictureId})<br>`;
                objectsInfo += `<span style="color: #ffa500;">   Facing: ${frameInfo.facing}</span><br>`;
                objectsInfo += `<span style="color: #88ff88;">   Movement: ${movementInfo.name}</span><br>`;
                objectsInfo += `<span style="color: #aaaaaa; font-size: 0.9em;">   ${movementInfo.description}</span><br>`;
                objectsInfo += `<span style="color: #cccccc;">   Text ID: ${sprite.textId}</span><br>`;
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
        
        // Overlay toggles
        const overlaysCheckbox = document.getElementById('showOverlaysCheckbox');
        const gridCheckbox = document.getElementById('showGridCheckbox');
        const coordsCheckbox = document.getElementById('showCoordsCheckbox');
        const tooltipCheckbox = document.getElementById('showTooltipCheckbox');
        
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
    
    async loadMap(mapId) {
        try {
            const mapData = await this.mapDataManager.loadMap(mapId);
            
            // Load tileset if needed
            if (!this.tilesetManager.hasTileset(mapData.tileset)) {
                Logger.log(`Loading tileset ${mapData.tileset}...`);
                await this.tilesetManager.loadTileset(mapData.tileset, mapData.tilesetName);
            }
            
            // Load tileset block definitions if needed
            if (!this.tilesetManager.hasBlockDefinitions(mapData.tileset)) {
                Logger.log(`Loading block definitions for tileset ${mapData.tileset}...`);
                await this.tilesetManager.loadTilesetBlocks(mapData.tileset);
            }
            
            // Load sprite metadata if needed
            if (mapData.objects?.sprites?.data && mapData.objects.sprites.data.length > 0) {
                Logger.log(`Preloading ${mapData.objects.sprites.data.length} sprites...`);
                const spriteIds = mapData.objects.sprites.data.map(s => s.pictureId);
                await this.spriteManager.preloadSprites(spriteIds);
            }
            
            // Set current map
            this.mapState.setCurrentMap(mapData);
            this.preferences.saveCurrentMap(mapId);
            
            // Track last overworld map (maps with connections are overworld maps)
            const hasConnections = mapData.connections && (
                mapData.connections.north || 
                mapData.connections.south || 
                mapData.connections.east || 
                mapData.connections.west
            );
            
            if (hasConnections) {
                this.mapState.setLastOverworldMap(mapData.mapId);
                Logger.log(`Overworld map detected: ${mapData.mapId} (${mapData.name})`);
            } else {
                Logger.log(`Indoor/interior map: ${mapData.mapId} (${mapData.name})`);
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
            this.errorHandler.handle(error, `Loading map ${mapId}`);
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
