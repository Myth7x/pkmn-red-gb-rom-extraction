// Main Map Viewer Application Controller
import { MAP_VIEWER_VERSION, MAP_VIEWER_BUILD_DATE, TILE_SIZE, BLOCK_SIZE, MODULE_VERSIONS, getMovementInfo, MIN_ZOOM, MAX_ZOOM, DEFAULT_OFFSET_X, DEFAULT_OFFSET_Y } from './Constants.js';
import { Config } from './Config.js';
import { Logger } from '../utils/Logger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { FPSCounter } from '../utils/FPSCounter.js';
import { ViewportState } from '../state/ViewportState.js';
import { MapState } from '../state/MapState.js';
import { PreferencesManager } from '../state/PreferencesManager.js';
import { MapDataManager } from '../data/MapDataManager.js';
import { TilesetManager } from '../data/TilesetManager.js';
import { SpriteManager } from '../data/SpriteManager.js';
import { CanvasRenderer } from '../rendering/CanvasRenderer.js';
import { NPCMovementEngine } from '../movement/NPCMovement.js';
import { TileAnimator } from '../animation/TileAnimator.js';
import { MapConnectionAligner } from '../utils/MapConnectionAligner.js';
import { TileAnimationDebugPanel } from '../ui/TileAnimationDebugPanel.js';
import { InteriorMapLayoutManager } from '../layout/InteriorMapLayoutManager.js';
import { InteriorMapRenderer } from '../rendering/InteriorMapRenderer.js';

// Import module versions
import { MODULE_VERSION as CONFIG_VERSION } from './Config.js';
import { MODULE_VERSION as LOGGER_VERSION } from '../utils/Logger.js';
import { MODULE_VERSION as ERROR_HANDLER_VERSION } from '../utils/ErrorHandler.js';
import { MODULE_VERSION as FPS_COUNTER_VERSION } from '../utils/FPSCounter.js';
import { MODULE_VERSION as VIEWPORT_STATE_VERSION } from '../state/ViewportState.js';
import { MODULE_VERSION as MAP_STATE_VERSION } from '../state/MapState.js';
import { MODULE_VERSION as PREFERENCES_VERSION } from '../state/PreferencesManager.js';
import { MODULE_VERSION as CACHE_MANAGER_VERSION } from '../data/CacheManager.js';
import { MODULE_VERSION as MAP_DATA_VERSION } from '../data/MapDataManager.js';
import { MODULE_VERSION as TILESET_VERSION } from '../data/TilesetManager.js';
import { MODULE_VERSION as SPRITE_VERSION } from '../data/SpriteManager.js';
import { MODULE_VERSION as RENDERER_VERSION } from '../rendering/CanvasRenderer.js';
import { MODULE_VERSION as NPC_MOVEMENT_VERSION } from '../movement/NPCMovement.js';
import { MODULE_VERSION as TILE_ANIMATOR_VERSION } from '../animation/TileAnimator.js';
import { MODULE_VERSION as INTERIOR_LAYOUT_VERSION } from '../layout/InteriorMapLayoutManager.js';
import { MODULE_VERSION as INTERIOR_RENDERER_VERSION } from '../rendering/InteriorMapRenderer.js';

// Always update version after changes
export const MODULE_VERSION = '1.5.0';

export class MapViewer {
    constructor(canvasId) {
        Logger.log('Pokemon Red Map Viewer - Starting initialization...');
        Logger.log(`Version ${MAP_VIEWER_VERSION} (Build: ${MAP_VIEWER_BUILD_DATE})`);
        
        // Core configuration
        this.config = new Config();
        
        // FPS Counter
        this.fpsCounter = new FPSCounter();
        
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
        
        // Animation system
        this.tileAnimator = new TileAnimator(this.config);
        
        // Tile animation debug panel
        this.tileAnimationDebugPanel = new TileAnimationDebugPanel(this.tileAnimator);
        
        // Interior map layout system
        this.interiorLayoutManager = null; // Will be initialized after mapDataManager
        this.interiorRenderer = null;
        this.showingInteriorLayout = false;
        
        // Connection alignment system
        this.connectionAligner = new MapConnectionAligner(this.tilesetManager);
        
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
        this.tileOptimizationEnabled = true; // Viewport culling for tile rendering
        
        // Rendering state
        this.isRendering = false; // Prevent concurrent render calls
        
        // Input state
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        
        // Room dragging state for interior layout mode
        this.isRoomDragging = false;
        this.draggedRoom = null;
        this.roomDragOffset = { x: 0, y: 0 };
        
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
            
            // Initialize collapsible panels
            this.initCollapsiblePanels();
            
            // Initialize interior layout system
            this.interiorLayoutManager = new InteriorMapLayoutManager(this.mapDataManager);
            this.interiorRenderer = new InteriorMapRenderer(
                this.canvas,
                this.ctx,
                this.tilesetManager,
                null, // collisionTileManager - not needed for now
                this.tileAnimator
            );
            
            // Sync collision overlay setting with interior renderer
            this.interiorRenderer.setShowCollisionOverlays(this.showOverlays);
            
            // Sync tile optimization setting with interior renderer (will be updated after preferences load)
            this.interiorRenderer.setTileOptimization(this.tileOptimizationEnabled);
            
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
        
        // Initialize FPS display
        const fpsElement = document.getElementById('fpsDisplay');
        if (fpsElement) {
            this.fpsCounter.setDisplayElement(fpsElement);
        }
        
        const loop = () => {
            const now = Date.now();
            const delta = now - lastFrameTime;
            
            // Render at ~60 FPS (16.67ms per frame)
            if (delta >= 16) {
                // Update tile animations
                this.tileAnimator.update();
                
                if (this.movementEnabled && this.movementEngine.isRunning) {
                    this.render();
                } else {
                    // Still render if animations are active (for water/flower tiles)
                    this.render();
                }
                
                // Track FPS
                this.fpsCounter.tick();
                
                lastFrameTime = now;
            }
            
            requestAnimationFrame(loop);
        };
        
        loop();
    }
    
    restorePreferences() {
        // Restore zoom
        const savedZoom = this.preferences.loadZoom(this.config.defaults.zoom);
        if (savedZoom >= MIN_ZOOM && savedZoom <= MAX_ZOOM) {
            this.viewportState.setScale(savedZoom);
        }
        
        // Restore overlay settings
        const overlaySettings = this.preferences.loadOverlaySettings();
        this.showOverlays = overlaySettings.showOverlays;
        this.showGrid = overlaySettings.showGrid;
        this.showCoordLabels = overlaySettings.showCoordLabels;
        this.showTooltip = overlaySettings.showTooltip !== false; // Default to true
        
        // Restore tile optimization preference
        this.tileOptimizationEnabled = this.preferences.loadTileOptimization();
        
        // Sync interior renderer overlay settings
        if (this.interiorRenderer) {
            this.interiorRenderer.setShowCollisionOverlays(this.showOverlays);
            this.interiorRenderer.setTileOptimization(this.tileOptimizationEnabled);
        }
        
        // Restore interior layout preference (will be applied when map loads)
        this.showingInteriorLayout = this.preferences.loadShowInteriorLayout();
        
        // Restore sidebar state
        const sidebarHidden = this.preferences.loadSidebarState();
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('toggleSidebarBtn');
        
        if (sidebar && toggleBtn) {
            if (sidebarHidden) {
                sidebar.classList.add('hidden');
                toggleBtn.classList.remove('sidebar-visible');
                toggleBtn.textContent = '☰';
            } else {
                sidebar.classList.remove('hidden');
                toggleBtn.classList.add('sidebar-visible');
                toggleBtn.textContent = '✕';
            }
            Logger.log(`Restored sidebar state: ${sidebarHidden ? 'HIDDEN' : 'VISIBLE'}`);
        }
    }
    
    /**
     * Initialize collapsible panel functionality
     */
    initCollapsiblePanels() {
        const headers = document.querySelectorAll('.collapsible-header');
        
        headers.forEach(header => {
            const panelName = header.dataset.panel;
            const content = document.getElementById(`panel-${panelName}`);
            
            if (!content) return;
            
            // Load saved state (default to collapsed)
            const isCollapsed = this.preferences.loadPanelState(panelName);
            
            if (isCollapsed) {
                header.classList.add('collapsed');
                content.classList.add('collapsed');
            }
            
            // Add click handler
            header.addEventListener('click', () => {
                const isCurrentlyCollapsed = header.classList.contains('collapsed');
                
                header.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
                
                // Save new state
                this.preferences.savePanelState(panelName, !isCurrentlyCollapsed);
                
                Logger.log(`Panel ${panelName}: ${!isCurrentlyCollapsed ? 'COLLAPSED' : 'EXPANDED'}`);
            });
        });
        
        Logger.log('Collapsible panels initialized');
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.renderer.resize(container.clientWidth, container.clientHeight);
        if (this.mapState.getCurrentMap()) {
            this.render();
        }
    }
    
    /**
     * Get all connected maps that should be rendered in the viewport
     * Returns array of {map, offsetX, offsetY} objects
     */
    async getVisibleConnectedMaps() {
        const currentMap = this.mapState.getCurrentMap();
        if (!currentMap) return [];
        
        // Return current map plus all connected maps
        const result = [{
            map: currentMap,
            offsetX: 0,
            offsetY: 0,
            isMainMap: true
        }];
        
        // Helper to calculate map position based on connection data
        const addConnectedMap = async (direction, baseOffsetX, baseOffsetY) => {
            if (!currentMap.connections[direction] || !currentMap.connectionHeaders[direction]) {
                return;
            }
            
            const header = currentMap.connectionHeaders[direction];
            const connectedMapId = header.connectedMap;
            
            // Load the connected map
            const connectedMap = await this.mapDataManager.loadMapByIndex(connectedMapId);
            if (!connectedMap) return;
            
            // Ensure tileset is loaded for connected map
            if (!this.tilesetManager.hasTileset(connectedMap.tileset)) {
                await this.tilesetManager.loadTileset(connectedMap.tileset, connectedMap.tilesetName);
            }
            
            // Ensure block definitions are loaded for alignment analysis
            if (!this.tilesetManager.hasBlockDefinitions(connectedMap.tileset)) {
                await this.tilesetManager.loadTilesetBlocks(connectedMap.tileset);
            }
            if (!this.tilesetManager.hasBlockDefinitions(currentMap.tileset)) {
                await this.tilesetManager.loadTilesetBlocks(currentMap.tileset);
            }
            
            // Calculate optimal alignment based on walkable tiles
            let alignmentOffset;
            if (direction === 'north' || direction === 'south') {
                alignmentOffset = await this.connectionAligner.calculateOptimalAlignment(
                    currentMap,
                    connectedMap,
                    direction,
                    header.xAlignment
                );
            } else {
                alignmentOffset = await this.connectionAligner.calculateOptimalAlignment(
                    currentMap,
                    connectedMap,
                    direction,
                    header.yAlignment
                );
            }
            
            // Calculate position in blocks (32x32 pixels per block)
            let offsetX = baseOffsetX;
            let offsetY = baseOffsetY;
            
            if (direction === 'north') {
                offsetY = -connectedMap.height; // Place above
                offsetX = alignmentOffset; // Use optimized alignment
            } else if (direction === 'south') {
                offsetY = currentMap.height; // Place below
                offsetX = alignmentOffset;
            } else if (direction === 'west') {
                offsetX = -connectedMap.width; // Place to left
                offsetY = alignmentOffset; // Use optimized alignment
            } else if (direction === 'east') {
                offsetX = currentMap.width; // Place to right
                offsetY = alignmentOffset;
            }
            
            result.push({
                map: connectedMap,
                offsetX: offsetX,
                offsetY: offsetY,
                direction: direction,
                isMainMap: false
            });
            
            // Recursively load connected maps from this map (1 level deep for now)
            // This allows seamless world exploration
            if (connectedMap.connections && connectedMap.connectionHeaders) {
                const directions = ['north', 'south', 'east', 'west'];
                for (const subDir of directions) {
                    if (connectedMap.connections[subDir] && connectedMap.connectionHeaders[subDir]) {
                        const subHeader = connectedMap.connectionHeaders[subDir];
                        const subConnectedMapId = subHeader.connectedMap;
                        
                        // Don't re-add the main map or already added maps
                        if (subConnectedMapId === currentMap.mapId) continue;
                        if (result.find(r => r.map.mapId === subConnectedMapId)) continue;
                        
                        const subMap = await this.mapDataManager.loadMapByIndex(subConnectedMapId);
                        if (!subMap) continue;
                        
                        if (!this.tilesetManager.hasTileset(subMap.tileset)) {
                            await this.tilesetManager.loadTileset(subMap.tileset, subMap.tilesetName);
                        }
                        
                        let subOffsetX = offsetX;
                        let subOffsetY = offsetY;
                        
                        if (subDir === 'north') {
                            subOffsetY = offsetY - subMap.height;
                            subOffsetX = offsetX + subHeader.xAlignment;
                        } else if (subDir === 'south') {
                            subOffsetY = offsetY + connectedMap.height;
                            subOffsetX = offsetX + subHeader.xAlignment;
                        } else if (subDir === 'west') {
                            subOffsetX = offsetX - subMap.width;
                            subOffsetY = offsetY + subHeader.yAlignment;
                        } else if (subDir === 'east') {
                            subOffsetX = offsetX + connectedMap.width;
                            subOffsetY = offsetY + subHeader.yAlignment;
                        }
                        
                        result.push({
                            map: subMap,
                            offsetX: subOffsetX,
                            offsetY: subOffsetY,
                            direction: `${direction}-${subDir}`,
                            isMainMap: false
                        });
                    }
                }
            }
        };
        
        // Load directly connected maps
        if (currentMap.connections && currentMap.connectionHeaders) {
            if (currentMap.connections.north) {
                await addConnectedMap('north', 0, 0);
            }
            if (currentMap.connections.south) {
                await addConnectedMap('south', 0, 0);
            }
            if (currentMap.connections.west) {
                await addConnectedMap('west', 0, 0);
            }
            if (currentMap.connections.east) {
                await addConnectedMap('east', 0, 0);
            }
        }
        
        return result;
    }
    
    /**
     * Render a single map at a specific offset
     */
    /**
     * Render a map at a specific offset (used for main map and connected maps)
     * 
     * Collision Indicator Colors (when overlays enabled):
     * - 🌿 Bright Green (0.4 alpha): GRASS - Wild Pokemon encounter zones
     * - 🌊 Blue (0.35 alpha): WATER - Requires Surf ability
     * - ⬇️ Orange (0.4 alpha): LEDGE - One-way jumpable ledges
     * - 🟪 Magenta (0.35 alpha): WARP_CARPET - Warp zones (Pokemon Center/Mart mats)
     * - 🚪 Purple (0.4 alpha): DOOR - Building entrances/exits
     * - 🟨 Yellow (0.35 alpha): COUNTER - Blocks movement but allows interaction
     * - 🌸 Cyan (0.25 alpha): FLOWER - Decorative walkable tiles
     * - ✅ Light Green (0.2 alpha): PASSABLE - Regular walkable ground
     * - 🧱 RED (0.3 alpha): IMPASSABLE - Walls, obstacles, tiles without collision data
     * 
     * @param {Object} mapData - Map data to render
     * @param {number} offsetXBlocks - X offset in blocks
     * @param {number} offsetYBlocks - Y offset in blocks
     * @param {number} scale - Rendering scale
     * @param {Object} viewportOffset - Viewport offset {x, y}
     * @param {boolean} isMainMap - Whether this is the main map (collision indicators only shown for main map)
     */
    renderMapAtOffset(mapData, offsetXBlocks, offsetYBlocks, scale, viewportOffset, isMainMap = false) {
        const tilesetImg = this.tilesetManager.getTilesetImage(mapData.tileset);
        const allBlockDefs = this.tilesetManager.tilesetBlockDefinitions[mapData.tileset];
        
        if (!allBlockDefs || !tilesetImg) {
            return;
        }
        
        // Calculate this map's position in pixels
        const mapOffsetX = offsetXBlocks * BLOCK_SIZE * TILE_SIZE * scale;
        const mapOffsetY = offsetYBlocks * BLOCK_SIZE * TILE_SIZE * scale;
        
        // Calculate visible area for this specific map (or render all if optimization disabled)
        let startX, startY, endX, endY;
        if (this.tileOptimizationEnabled) {
            startX = Math.max(0, Math.floor((-viewportOffset.x - mapOffsetX) / (BLOCK_SIZE * TILE_SIZE * scale)));
            startY = Math.max(0, Math.floor((-viewportOffset.y - mapOffsetY) / (BLOCK_SIZE * TILE_SIZE * scale)));
            endX = Math.min(mapData.width - 1, Math.ceil((this.renderer.getWidth() - viewportOffset.x - mapOffsetX) / (BLOCK_SIZE * TILE_SIZE * scale)));
            endY = Math.min(mapData.height - 1, Math.ceil((this.renderer.getHeight() - viewportOffset.y - mapOffsetY) / (BLOCK_SIZE * TILE_SIZE * scale)));
            
            // Only render if this map is visible in viewport
            if (startX > mapData.width || startY > mapData.height || endX < 0 || endY < 0) {
                return;
            }
        } else {
            // Render entire map without optimization
            startX = 0;
            startY = 0;
            endX = mapData.width - 1;
            endY = mapData.height - 1;
        }
        
        // Get animation type for this tileset
        const animationType = this.tilesetManager.getAnimationTypeValue(mapData.tileset);
        
        // Get or create optimized tileset for current scale (only if optimization enabled)
        const optimizedTileset = this.tileOptimizationEnabled 
            ? this.tilesetManager.getOptimizedTileset(mapData.tileset, scale)
            : null;
        
        // Render blocks
        for (let blockY = startY; blockY <= endY; blockY++) {
            for (let blockX = startX; blockX <= endX; blockX++) {
                const blockIndex = blockY * mapData.width + blockX;
                const blockId = mapData.blockData[blockIndex];
                
                if (blockId === undefined || !allBlockDefs[blockId]) {
                    continue;
                }
                
                const blockDef = allBlockDefs[blockId];
                const screenBlockX = viewportOffset.x + mapOffsetX + blockX * BLOCK_SIZE * TILE_SIZE * scale;
                const screenBlockY = viewportOffset.y + mapOffsetY + blockY * BLOCK_SIZE * TILE_SIZE * scale;
                
                // Render 4x4 tiles for this block
                for (let tileY = 0; tileY < BLOCK_SIZE; tileY++) {
                    for (let tileX = 0; tileX < BLOCK_SIZE; tileX++) {
                        // Access 2D array structure: tiles[row][col]
                        const tileId = blockDef.tiles[tileY][tileX];
                        
                        if (tileId === undefined) continue;
                        
                        const tileSize = TILE_SIZE * scale;
                        const screenX = screenBlockX + tileX * tileSize;
                        const screenY = screenBlockY + tileY * tileSize;
                        
                        // Check if this tile should be animated (disable at very small scales for performance)
                        let animatedTileCanvas = null;
                        if (scale >= 0.5) {
                            animatedTileCanvas = this.tileAnimator.renderAnimatedTile(
                                tilesetImg,
                                tileId,
                                animationType,
                                scale
                            );
                        }
                        
                        if (animatedTileCanvas) {
                            // Draw animated tile from cached canvas
                            this.renderer.drawImage(
                                animatedTileCanvas,
                                0, 0, animatedTileCanvas.width, animatedTileCanvas.height,
                                screenX, screenY, tileSize, tileSize
                            );
                        } else {
                            // Use optimized tileset for current scale
                            const tilesetToUse = optimizedTileset || tilesetImg;
                            const srcX = (tileId % 16) * TILE_SIZE;
                            const srcY = Math.floor(tileId / 16) * TILE_SIZE;
                            
                            this.renderer.drawImage(
                                tilesetToUse,
                                srcX, srcY, TILE_SIZE, TILE_SIZE,
                                screenX, screenY, tileSize, tileSize
                            );
                        }
                        
                        // Render collision indicators ONLY for the main map (and skip at very small scales)
                        if (isMainMap && this.showOverlays && scale >= 0.75) {
                            // Analyze tile collision type
                            const isPassable = this.tilesetManager.isTilePassable(mapData.tileset, tileId);
                            const isGrass = this.tilesetManager.isGrassTile(mapData.tileset, tileId);
                            const isWater = this.tilesetManager.isWaterTile(tileId);
                            const isLedge = this.tilesetManager.isLedgeTile(tileId);
                            const isFlower = this.tilesetManager.isFlowerTile(mapData.tileset, tileId);
                            const isDoor = this.tilesetManager.isDoorTile(tileId);
                            const isWarpCarpet = this.tilesetManager.isWarpCarpetTile(tileId);
                            const isCounter = this.tilesetManager.isCounterTile(tileId);
                            
                            // Determine collision overlay color based on tile type (priority order)
                            let overlayColor = null;
                            let overlayAlpha = 0.3;
                            
                            if (isGrass) {
                                // Grass tiles - bright green (encounter zones)
                                overlayColor = 'rgba(0, 255, 0, 1.0)';
                                overlayAlpha = 0.4;
                            } else if (isWater) {
                                // Water tiles - blue (surfable)
                                overlayColor = 'rgba(0, 100, 255, 1.0)';
                                overlayAlpha = 0.35;
                            } else if (isLedge) {
                                // Ledge tiles - orange (one-way, jumpable)
                                overlayColor = 'rgba(255, 140, 0, 1.0)';
                                overlayAlpha = 0.4;
                            } else if (isWarpCarpet) {
                                // Warp carpet tiles - magenta (walkable warp zones)
                                overlayColor = 'rgba(255, 0, 255, 1.0)';
                                overlayAlpha = 0.35;
                            } else if (isDoor) {
                                // Door tiles - purple (entrance/exit)
                                overlayColor = 'rgba(128, 0, 255, 1.0)';
                                overlayAlpha = 0.4;
                            } else if (isCounter) {
                                // Counter tiles - yellow (blocks but interactive)
                                overlayColor = 'rgba(255, 255, 0, 1.0)';
                                overlayAlpha = 0.35;
                            } else if (isFlower) {
                                // Flower/decoration tiles - cyan (walkable decoration)
                                overlayColor = 'rgba(0, 255, 255, 1.0)';
                                overlayAlpha = 0.25;
                            } else if (isPassable) {
                                // Regular walkable tiles - light green
                                overlayColor = 'rgba(100, 255, 100, 1.0)';
                                overlayAlpha = 0.2;
                            } else {
                                // Impassable tiles (walls, obstacles) - RED
                                // This includes tiles with NO collision data
                                overlayColor = 'rgba(255, 0, 0, 1.0)';
                                overlayAlpha = 0.3;
                            }
                            
                            // Draw collision overlay
                            if (overlayColor) {
                                this.renderer.setAlpha(overlayAlpha);
                                this.renderer.drawRect(screenX, screenY, tileSize, tileSize, overlayColor, true);
                                this.renderer.resetAlpha();
                            }
                        }
                    }
                }
            }
        }
    }
    
    // This will be continued in the next part...
    async render() {
        // Prevent concurrent render calls
        if (this.isRendering) {
            return;
        }
        this.isRendering = true;
        
        try {
            const currentMap = this.mapState.getCurrentMap();
            if (!currentMap) {
                this.isRendering = false;
                return;
            }
            if (!this.tilesetManager.hasTileset(currentMap.tileset)) {
                this.isRendering = false;
                return;
            }
            
            // Clear canvas
            this.renderer.clear('#000');
            
            const scale = this.viewportState.getScale();
            const offset = this.viewportState.getOffset();
            
            // Check if we're in interior layout mode
            if (this.showingInteriorLayout && this.interiorLayoutManager) {
                const layout = this.interiorLayoutManager.getCurrentLayout();
                if (layout) {
                    // Render interior layout with main map highlighting
                    this.interiorRenderer.renderInteriorLayout(
                        layout,
                        scale,
                        offset.x,
                        offset.y,
                        currentMap.mapId
                    );
                    
                    // Render overlays and sprites for the main map only
                    // Calculate the main room's position in the layout
                    const mainRoom = layout.rooms.find(room => room.mapData.mapId === currentMap.mapId);
                    
                    if (mainRoom) {
                        // Calculate offset for the main room within the layout
                        const mainRoomOffsetX = offset.x + (mainRoom.offsetX * BLOCK_SIZE * TILE_SIZE * scale);
                        const mainRoomOffsetY = offset.y + (mainRoom.offsetY * BLOCK_SIZE * TILE_SIZE * scale);
                        const mainRoomOffset = { x: mainRoomOffsetX, y: mainRoomOffsetY };
                        
                        // Render overlays (warps, signs, NPCs) for main map
                        if (this.showOverlays) {
                            this.renderOverlays(currentMap, mainRoomOffset, scale);
                        }
                        
                        // ALWAYS render sprites for main map
                        this.renderSprites(currentMap, mainRoomOffset, scale);
                    }
                    
                    // Draw grid if enabled (same as normal mode)
                    if (this.showGrid && scale >= 2) {
                        this.renderInteriorLayoutGrid(layout, scale, offset);
                    }
                    
                    this.isRendering = false;
                    return;
                }
            }
            
            // Normal rendering mode
            // For interior maps (no border connections), render only the current map
            // For outdoor maps (with border connections), render with connected maps
            const isInteriorMap = !currentMap.connections || 
                                 (!currentMap.connections.north && 
                                  !currentMap.connections.south && 
                                  !currentMap.connections.east && 
                                  !currentMap.connections.west);
            
            if (isInteriorMap) {
                // Interior map: Render only the single current map
                this.renderMapAtOffset(currentMap, 0, 0, scale, offset, true);
            } else {
                // Outdoor map: Render with connected maps
                let connectedMaps;
                try {
                    connectedMaps = await this.getVisibleConnectedMaps();
                } catch (error) {
                    console.error('Failed to load connected maps, rendering main map only:', error);
                    // Fallback: just render the main map
                    connectedMaps = [{
                        map: currentMap,
                        offsetX: 0,
                        offsetY: 0,
                        isMainMap: true
                    }];
                }
                
                if (!connectedMaps || connectedMaps.length === 0) {
                    this.isRendering = false;
                    return;
                }
                
                // Render all maps (main + connected)
                for (const { map, offsetX, offsetY, isMainMap } of connectedMaps) {
                    this.renderMapAtOffset(map, offsetX, offsetY, scale, offset, isMainMap);
                }
            }
        
        // Now render overlays, sprites, etc only for the main map
        // (We could extend this to render sprites from connected maps too)
        
        const allBlockDefs = this.tilesetManager.tilesetBlockDefinitions[currentMap.tileset];
        
        // Render overlays (warps, signs, NPCs) - only for main map
        if (this.showOverlays) {
            this.renderOverlays(currentMap, offset, scale);
            this.renderBoundaryConnections(currentMap, offset, scale);
        }
        
        // ALWAYS render sprites (not controlled by overlay toggle)
        this.renderSprites(currentMap, offset, scale);
        
        // Draw grid if enabled
        if (this.showGrid) {
            // Calculate visible blocks for grid
            const startX = Math.floor(-offset.x / (BLOCK_SIZE * TILE_SIZE * scale));
            const startY = Math.floor(-offset.y / (BLOCK_SIZE * TILE_SIZE * scale));
            const endX = Math.ceil((this.renderer.getWidth() - offset.x) / (BLOCK_SIZE * TILE_SIZE * scale));
            const endY = Math.ceil((this.renderer.getHeight() - offset.y) / (BLOCK_SIZE * TILE_SIZE * scale));
            
            // Calculate line width based on zoom level
            // At scale 2.0+, use 1px; scale down to minimum 0.5px at very low zoom
            const lineWidth = Math.max(0.5, Math.min(1, scale / 2));
            
            this.renderer.setAlpha(0.15);
            for (let x = startX; x <= endX; x++) {
                const screenX = offset.x + x * BLOCK_SIZE * TILE_SIZE * scale;
                this.renderer.drawLine(screenX, 0, screenX, this.renderer.getHeight(), '#fff', lineWidth);
            }
            for (let y = startY; y <= endY; y++) {
                const screenY = offset.y + y * BLOCK_SIZE * TILE_SIZE * scale;
                this.renderer.drawLine(0, screenY, this.renderer.getWidth(), screenY, '#fff', lineWidth);
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
        
        } finally {
            // Always release the rendering lock
            this.isRendering = false;
        }
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
     * Sprite sheet layout: 48x16 pixels (3 frames horizontally, 1 standing frame per direction)
     * - Frame 0 (x=0-15, y=0-15): DOWN facing
     * - Frame 1 (x=16-31, y=0-15): UP facing  
     * - Frame 2 (x=32-47, y=0-15): LEFT facing (RIGHT uses this with horizontal flip)
     * 
     * @param {Object} sprite - Sprite data from map
     * @param {number} facingDirection - Facing direction from movement engine (0=DOWN, 4=UP, 8=LEFT, 12=RIGHT)
     * @param {number} animFrame - Animation frame (0-3, where 0 = standing)
     * @param {boolean} isWalking - Whether sprite is currently walking
     * @returns {Object} - {facing: string, frameX: number, frameY: number, mirror: boolean}
     */
    getSpriteFrame(sprite, facingDirection = null, animFrame = 0, isWalking = false) {
        // Determine facing direction from various sources
        let facing = 0; // Default to DOWN (0)
        
        // Priority 1: Check raw byte2 for STAY movement FIRST (0xD0-0xD3 are facing directions)
        // This is more reliable than the movement engine for stationary sprites
        if (sprite.movement && sprite.movement.byte1 === 0xFF && sprite.movement.byte2 >= 0xD0 && sprite.movement.byte2 <= 0xD3) {
            // STAY movement with explicit facing direction
            // 0xD0 = DOWN, 0xD1 = UP, 0xD2 = LEFT, 0xD3 = RIGHT
            switch (sprite.movement.byte2) {
                case 0xD0:
                    facing = 0x00; // SPRITE_FACING_DOWN
                    break;
                case 0xD1:
                    facing = 0x04; // SPRITE_FACING_UP
                    break;
                case 0xD2:
                    facing = 0x08; // SPRITE_FACING_LEFT
                    break;
                case 0xD3:
                    facing = 0x0C; // SPRITE_FACING_RIGHT
                    break;
            }
        }
        // Priority 2: Movement engine provides facing direction (for moving sprites)
        else if (facingDirection !== null && facingDirection !== undefined) {
            facing = facingDirection;
        }
        // Priority 3: Sprite data has movement direction string
        else if (sprite.movement && sprite.movement.direction) {
            // Map string direction to numeric facing values
            switch (sprite.movement.direction) {
                case 'DOWN':
                    facing = 0x00; // SPRITE_FACING_DOWN
                    break;
                case 'UP':
                    facing = 0x04; // SPRITE_FACING_UP
                    break;
                case 'LEFT':
                    facing = 0x08; // SPRITE_FACING_LEFT
                    break;
                case 'RIGHT':
                    facing = 0x0C; // SPRITE_FACING_RIGHT
                    break;
                case 'NONE':
                default:
                    facing = 0x00; // Default to DOWN
                    break;
            }
        }
        
        // Map facing direction to sprite sheet position
        // Sprites are 48x16 with 3 frames horizontally: DOWN (x=0), UP (x=16), LEFT (x=32)
        // Each frame is 16x16 pixels (standing pose only, no walking animation in extracted sprites)
        let frameX = 0;
        let frameY = 0; // Always 0 since sprites are single row
        let mirror = false;
        let facingName = 'down';
        
        if (facing === 0x00) { // DOWN
            frameX = 0;
            facingName = 'down';
        } else if (facing === 0x04) { // UP
            frameX = 16;
            facingName = 'up';
        } else if (facing === 0x08) { // LEFT
            frameX = 32;
            facingName = 'left';
        } else if (facing === 0x0C) { // RIGHT
            frameX = 32; // Use left frame at x=32
            mirror = true; // but flip it horizontally
            facingName = 'right';
        }
        
        // Note: animFrame and isWalking are ignored since extracted sprites only have standing poses
        // The walking animation would require extracting additional frames from the ROM
        
        return {
            facing: facingName,
            frameX: frameX,
            frameY: frameY,
            mirror: mirror
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
                let facingDirection = null; // Will be determined from sprite data if not provided by movement engine
                let animFrame = 0;
                let isWalking = false;
                
                if (spritePositions && spritePositions[index]) {
                    const pos = spritePositions[index];
                    spriteX = pos.pixelX / 16; // Convert pixels back to tiles
                    spriteY = pos.pixelY / 16;
                    // Only use movement engine facing if sprite is actually walking
                    // For STAY sprites, leave facingDirection as null so ROM data is used
                    if (pos.isWalking) {
                        facingDirection = pos.facingDirection;
                    }
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
                            frameInfo.frameX, frameInfo.frameY, 16, 16,  // Source frame (x, y, width, height)
                            0, 0, size, size              // Draw at 0,0 due to transform
                        );
                    } else {
                        // Draw normally
                        this.renderer.drawImage(
                            spriteImg,
                            frameInfo.frameX, frameInfo.frameY, 16, 16,  // Source frame (x, y, width, height)
                            x, y, size, size
                        );
                    }
                    
                    this.renderer.restore();
                    
                    // Draw overlay indicator on top if overlays are enabled
                    if (this.showOverlays) {
                        this.renderer.setAlpha(0.36);
                        this.renderer.drawRect(x, y, size, size, 'rgba(50, 255, 50, 1.0)', true);
                        this.renderer.resetAlpha();
                        
                        // Draw N label in center
                        const fontSize = Math.max(12, Math.min(20, size * 0.4));
                        this.renderer.drawText('N', x + size / 2, y + size / 2, {
                            font: `bold ${fontSize}px "Courier New"`,
                            color: '#fff',
                            align: 'center',
                            baseline: 'middle',
                            shadow: true
                        });
                        
                        // Draw facing direction in top-left corner
                        const facingShort = frameInfo.facing.charAt(0).toUpperCase(); // D/U/L/R
                        const smallFontSize = Math.max(8, Math.min(12, size * 0.25));
                        this.renderer.drawText(facingShort, x + 3, y + 3, {
                            font: `bold ${smallFontSize}px "Courier New"`,
                            color: '#ffff00',
                            align: 'left',
                            baseline: 'top',
                            shadow: true
                        });
                        
                        // Draw frame index in top-right corner
                        const frameIdx = Math.floor(frameInfo.frameX / 16); // 0, 1, or 2
                        this.renderer.drawText(frameIdx.toString(), x + size - 3, y + 3, {
                            font: `bold ${smallFontSize}px "Courier New"`,
                            color: '#00ffff',
                            align: 'right',
                            baseline: 'top',
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
    
    /**
     * Render grid overlay for interior layout mode
     * @param {Object} layout - Interior layout data
     * @param {number} scale - Render scale
     * @param {Object} offset - Camera offset {x, y}
     */
    renderInteriorLayoutGrid(layout, scale, offset) {
        // Draw universal grid overlay (same as normal mode)
        // Calculate visible blocks for grid based on viewport
        const startX = Math.floor(-offset.x / (BLOCK_SIZE * TILE_SIZE * scale));
        const startY = Math.floor(-offset.y / (BLOCK_SIZE * TILE_SIZE * scale));
        const endX = Math.ceil((this.renderer.getWidth() - offset.x) / (BLOCK_SIZE * TILE_SIZE * scale));
        const endY = Math.ceil((this.renderer.getHeight() - offset.y) / (BLOCK_SIZE * TILE_SIZE * scale));
        
        // Calculate line width based on zoom level
        // At scale 2.0+, use 1px; scale down to minimum 0.5px at very low zoom
        const lineWidth = Math.max(0.5, Math.min(1, scale / 2));
        
        this.renderer.setAlpha(0.15);
        
        // Draw vertical grid lines across entire viewport
        for (let x = startX; x <= endX; x++) {
            const screenX = offset.x + x * BLOCK_SIZE * TILE_SIZE * scale;
            this.renderer.drawLine(screenX, 0, screenX, this.renderer.getHeight(), '#fff', lineWidth);
        }
        
        // Draw horizontal grid lines across entire viewport
        for (let y = startY; y <= endY; y++) {
            const screenY = offset.y + y * BLOCK_SIZE * TILE_SIZE * scale;
            this.renderer.drawLine(0, screenY, this.renderer.getWidth(), screenY, '#fff', lineWidth);
        }
        
        this.renderer.resetAlpha();
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
            hasDragged = false;
            mouseDownX = e.clientX;
            mouseDownY = e.clientY;
            this.dragStart = { x: e.clientX, y: e.clientY };
            
            // Check for Ctrl+Click for room dragging in interior layout mode
            if (e.ctrlKey && this.showingInteriorLayout && this.interiorLayoutManager) {
                const layout = this.interiorLayoutManager.getCurrentLayout();
                if (layout) {
                    const rect = this.canvas.getBoundingClientRect();
                    const canvasX = e.clientX - rect.left;
                    const canvasY = e.clientY - rect.top;
                    const offset = this.viewportState.getOffset();
                    const scale = this.viewportState.getScale();
                    
                    // Find which room was clicked
                    const clickedRoom = this.findRoomAtPosition(canvasX, canvasY, layout, offset, scale);
                    if (clickedRoom) {
                        this.isRoomDragging = true;
                        this.draggedRoom = clickedRoom;
                        
                        // Calculate offset from room origin to mouse position
                        const roomScreenX = (clickedRoom.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + offset.x;
                        const roomScreenY = (clickedRoom.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + offset.y;
                        this.roomDragOffset = {
                            x: canvasX - roomScreenX,
                            y: canvasY - roomScreenY
                        };
                        
                        this.canvas.style.cursor = 'move';
                        return;
                    }
                }
            }
            
            // Normal dragging (panning)
            this.isDragging = true;
            this.canvas.style.cursor = 'grabbing';
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isRoomDragging && this.draggedRoom) {
                // Handle room dragging
                hasDragged = true;
                
                const rect = this.canvas.getBoundingClientRect();
                const canvasX = e.clientX - rect.left;
                const canvasY = e.clientY - rect.top;
                const offset = this.viewportState.getOffset();
                const scale = this.viewportState.getScale();
                
                // Calculate new room position
                const newScreenX = canvasX - this.roomDragOffset.x;
                const newScreenY = canvasY - this.roomDragOffset.y;
                
                // Convert screen position to block offset
                const newOffsetX = Math.round((newScreenX - offset.x) / (BLOCK_SIZE * TILE_SIZE * scale));
                const newOffsetY = Math.round((newScreenY - offset.y) / (BLOCK_SIZE * TILE_SIZE * scale));
                
                // Update the room's position
                this.draggedRoom.offsetX = newOffsetX;
                this.draggedRoom.offsetY = newOffsetY;
                
                this.render();
                this.hideTooltip();
            } else if (this.isDragging) {
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
            if (this.isRoomDragging) {
                // Save custom positions to localStorage
                const layout = this.interiorLayoutManager?.currentLayout;
                if (layout && layout.rooms && layout.rooms.length > 0) {
                    const mapIds = layout.rooms.map(room => room.mapId);
                    const groupId = this.interiorLayoutManager.generateGroupId(mapIds);
                    this.interiorLayoutManager.saveCustomPositions(groupId, layout.rooms);
                    Logger.info(`✓ Saved custom positions for group: ${groupId}`);
                }
                
                this.isRoomDragging = false;
                this.draggedRoom = null;
                this.canvas.style.cursor = 'grab';
                return;
            }
            
            if (!hasDragged && this.showOverlays) {
                // Handle click on objects
                this.handleCanvasClick(e);
            }
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.isRoomDragging = false;
            this.draggedRoom = null;
            if (this.hoveredTile) {
                this.hoveredTile = null;
                this.render();
            }
            this.hideTooltip();
            this.canvas.style.cursor = 'default';
        });
        
        // Keyboard event listeners for Ctrl key (room drag mode)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Control' && this.showingInteriorLayout && this.interiorRenderer) {
                this.interiorRenderer.setShowDragOverlay(true);
                this.render();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'Control' && this.interiorRenderer) {
                this.interiorRenderer.setShowDragOverlay(false);
                this.render();
            }
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
        
        // Check if in interior layout mode
        if (this.showingInteriorLayout && this.interiorLayoutManager) {
            const layout = this.interiorLayoutManager.getCurrentLayout();
            if (layout) {
                // Check if hovering over a connection line
                const hoveredConnection = this.getHoveredConnection(canvasX, canvasY, layout, offset, scale);
                if (hoveredConnection) {
                    this.canvas.style.cursor = 'help';
                    this.showConnectionTooltip(e.clientX, e.clientY, hoveredConnection);
                    // Update renderer with hovered connection for highlighting
                    if (this.interiorRenderer) {
                        this.interiorRenderer.setHoveredConnection(hoveredConnection);
                        this.render();
                    }
                    return;
                } else {
                    this.hideTooltip();
                    // Clear hovered connection
                    if (this.interiorRenderer && this.interiorRenderer.hoveredConnection) {
                        this.interiorRenderer.setHoveredConnection(null);
                        this.render();
                    }
                }
                
                // In interior layout mode, need to account for room offset
                const mainRoom = layout.rooms.find(room => room.mapData.mapId === currentMap.mapId);
                if (mainRoom) {
                    // Adjust offset for the main room's position in the layout
                    const mainRoomOffsetX = offset.x + (mainRoom.offsetX * BLOCK_SIZE * TILE_SIZE * scale);
                    const mainRoomOffsetY = offset.y + (mainRoom.offsetY * BLOCK_SIZE * TILE_SIZE * scale);
                    
                    // Calculate tile coordinates relative to the main room
                    const worldTileX = Math.floor((canvasX - mainRoomOffsetX) / (TILE_SIZE * scale));
                    const worldTileY = Math.floor((canvasY - mainRoomOffsetY) / (TILE_SIZE * scale));
                    
                    // Convert tile coordinates to block coordinates
                    const mapBlockX = Math.floor(worldTileX / BLOCK_SIZE);
                    const mapBlockY = Math.floor(worldTileY / BLOCK_SIZE);
                    
                    // Calculate which tile within the block
                    const tileXInBlock = worldTileX % BLOCK_SIZE;
                    const tileYInBlock = worldTileY % BLOCK_SIZE;
                    const tileIndexInBlock = tileYInBlock * BLOCK_SIZE + tileXInBlock;
                    
                    // Check if within main room bounds
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
                        
                        this.canvas.style.cursor = isOverWarp ? 'pointer' : 'grab';
                    } else {
                        if (this.hoveredTile) {
                            this.hoveredTile = null;
                        }
                        this.hideTooltip();
                        this.canvas.style.cursor = 'default';
                    }
                    
                    return;
                }
            }
        }
        
        // Convert to TILE coordinates (normal mode)
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
        
        let tileX, tileY;
        
        // Check if in interior layout mode and adjust coordinates accordingly
        if (this.showingInteriorLayout && this.interiorLayoutManager) {
            const layout = this.interiorLayoutManager.getCurrentLayout();
            if (layout) {
                const mainRoom = layout.rooms.find(room => room.mapData.mapId === currentMap.mapId);
                if (mainRoom) {
                    // Adjust offset for the main room's position in the layout
                    const mainRoomOffsetX = offset.x + (mainRoom.offsetX * BLOCK_SIZE * TILE_SIZE * scale);
                    const mainRoomOffsetY = offset.y + (mainRoom.offsetY * BLOCK_SIZE * TILE_SIZE * scale);
                    
                    // Convert to TILE coordinates relative to the main room
                    tileX = Math.floor((canvasX - mainRoomOffsetX) / (TILE_SIZE * scale));
                    tileY = Math.floor((canvasY - mainRoomOffsetY) / (TILE_SIZE * scale));
                } else {
                    // Fallback to normal calculation
                    tileX = Math.floor((canvasX - offset.x) / (TILE_SIZE * scale));
                    tileY = Math.floor((canvasY - offset.y) / (TILE_SIZE * scale));
                }
            } else {
                // Fallback to normal calculation
                tileX = Math.floor((canvasX - offset.x) / (TILE_SIZE * scale));
                tileY = Math.floor((canvasY - offset.y) / (TILE_SIZE * scale));
            }
        } else {
            // Normal mode: Convert to TILE coordinates
            tileX = Math.floor((canvasX - offset.x) / (TILE_SIZE * scale));
            tileY = Math.floor((canvasY - offset.y) / (TILE_SIZE * scale));
        }
        
        // ROM object coords are in 2-TILE units
        const romX = Math.floor(tileX / 2);
        const romY = Math.floor(tileY / 2);
        
        Logger.log(`Clicked at tile (${tileX}, ${tileY}) = ROM coords (${romX}, ${romY})`);
        
        // Check boundary connections first (only in normal mode, not interior layout)
        if (!this.showingInteriorLayout) {
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
            const isFlower = this.tilesetManager.isFlowerTile(currentMap.tileset, tileId);
            const isDoor = this.tilesetManager.isDoorTile(tileId);
            const isWarpCarpet = this.tilesetManager.isWarpCarpetTile(tileId);
            const isCounter = this.tilesetManager.isCounterTile(tileId);
            
            // Build collision info object for display
            collisionInfo = {
                tileId: tileId,
                walkable: isPassable,
                surfable: isWater,
                type: 'PASSABLE'
            };
            
            // Determine tile type (priority order matches rendering)
            if (isGrass) {
                collisionInfo.type = 'GRASS';
                collisionColor = '#00ff00';
                collisionIcon = '🌿';
                collisionInfo.description = 'Wild Pokemon encounters';
            } else if (isWater) {
                collisionInfo.type = 'WATER';
                collisionColor = '#0066ff';
                collisionIcon = '🌊';
                collisionInfo.description = 'Requires Surf to traverse';
            } else if (isLedge) {
                collisionInfo.type = 'LEDGE';
                collisionColor = '#ff8800';
                collisionIcon = '⬇️';
                collisionInfo.description = 'One-way jumpable ledge';
            } else if (isWarpCarpet) {
                collisionInfo.type = 'WARP_CARPET';
                collisionColor = '#ff00ff';
                collisionIcon = '🟪';
                collisionInfo.description = 'Warp zone (Pokemon Center/Mart)';
            } else if (isDoor) {
                collisionInfo.type = 'DOOR';
                collisionColor = '#8000ff';
                collisionIcon = '🚪';
                collisionInfo.description = 'Building entrance/exit';
            } else if (isCounter) {
                collisionInfo.type = 'COUNTER';
                collisionColor = '#ffff00';
                collisionIcon = '🟨';
                collisionInfo.description = 'Blocks movement, allows interaction';
            } else if (isFlower) {
                collisionInfo.type = 'FLOWER';
                collisionColor = '#00ffff';
                collisionIcon = '🌸';
                collisionInfo.description = 'Decorative walkable tile';
            } else if (!isPassable) {
                collisionInfo.type = 'WALL';
                collisionColor = '#ff0000';
                collisionIcon = '🧱';
                collisionInfo.description = 'Impassable obstacle';
            } else {
                collisionColor = '#00ff88';
                collisionIcon = '✅';
                collisionInfo.description = 'Normal walkable ground';
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
                // Support both old (warpId) and new (destWarpId) field names
                const destWarpId = warp.destWarpId !== undefined ? warp.destWarpId : warp.warpId;
                if (destWarpId !== undefined) {
                    objectsInfo += `   Dest Warp ID: <span style="color: #ffaa00;">${destWarpId}</span><br>`;
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
    
    /**
     * Check if mouse is hovering over a connection line in interior layout mode
     * @param {number} canvasX - Mouse X position on canvas
     * @param {number} canvasY - Mouse Y position on canvas
     * @param {Object} layout - Interior layout data
     * @param {Object} offset - Camera offset
     * @param {number} scale - Render scale
     * @returns {Object|null} Connection data if hovering, null otherwise
     */
    getHoveredConnection(canvasX, canvasY, layout, offset, scale) {
        const roomMap = new Map(layout.rooms.map(r => [r.mapId, r]));
        const HOVER_THRESHOLD = 10; // pixels
        
        for (const room of layout.rooms) {
            const baseX = (room.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + offset.x;
            const baseY = (room.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + offset.y;
            
            for (const connection of room.connections) {
                const destRoom = roomMap.get(connection.toMapId);
                if (!destRoom) continue;
                
                const warp = connection.fromWarp;
                const warpSizePixels = 2 * TILE_SIZE * scale;
                
                // Source warp position (center)
                const fromX = baseX + (warp.x * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                const fromY = baseY + (warp.y * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                
                // Destination position
                const destBaseX = (destRoom.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + offset.x;
                const destBaseY = (destRoom.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + offset.y;
                
                let toX, toY;
                let destWarp = null;
                
                if (connection.toWarpId !== undefined && destRoom.warps) {
                    destWarp = destRoom.warps.find(w => w.warpId === connection.toWarpId);
                    if (destWarp) {
                        toX = destBaseX + (destWarp.x * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                        toY = destBaseY + (destWarp.y * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                    } else {
                        toX = destBaseX + (destRoom.mapData.width * BLOCK_SIZE * TILE_SIZE * scale / 2);
                        toY = destBaseY + (destRoom.mapData.height * BLOCK_SIZE * TILE_SIZE * scale / 2);
                    }
                } else {
                    toX = destBaseX + (destRoom.mapData.width * BLOCK_SIZE * TILE_SIZE * scale / 2);
                    toY = destBaseY + (destRoom.mapData.height * BLOCK_SIZE * TILE_SIZE * scale / 2);
                }
                
                // Check if mouse is near the line
                const distance = this.pointToLineDistance(canvasX, canvasY, fromX, fromY, toX, toY);
                
                if (distance < HOVER_THRESHOLD) {
                    return {
                        fromMapId: room.mapId,
                        toMapId: connection.toMapId,
                        fromWarp: warp,
                        toWarp: destWarp,
                        fromMapData: room.mapData,
                        toMapData: destRoom.mapData
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Calculate distance from point to line segment
     * @param {number} px - Point X
     * @param {number} py - Point Y
     * @param {number} x1 - Line start X
     * @param {number} y1 - Line start Y
     * @param {number} x2 - Line end X
     * @param {number} y2 - Line end Y
     * @returns {number} Distance in pixels
     */
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Find which room is at the given canvas position
     * @param {number} canvasX - Canvas X coordinate
     * @param {number} canvasY - Canvas Y coordinate
     * @param {Object} layout - Interior layout data
     * @param {Object} offset - Camera offset
     * @param {number} scale - Render scale
     * @returns {Object|null} Room object if found, null otherwise
     */
    findRoomAtPosition(canvasX, canvasY, layout, offset, scale) {
        // Check rooms in reverse order (top to bottom in rendering)
        for (let i = layout.rooms.length - 1; i >= 0; i--) {
            const room = layout.rooms[i];
            
            const roomX = (room.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + offset.x;
            const roomY = (room.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + offset.y;
            const roomWidth = room.mapData.width * BLOCK_SIZE * TILE_SIZE * scale;
            const roomHeight = room.mapData.height * BLOCK_SIZE * TILE_SIZE * scale;
            
            // Check if click is within room bounds
            if (canvasX >= roomX && canvasX <= roomX + roomWidth &&
                canvasY >= roomY && canvasY <= roomY + roomHeight) {
                return room;
            }
        }
        
        return null;
    }
    
    /**
     * Show tooltip for connection hover
     * @param {number} mouseX - Mouse X position
     * @param {number} mouseY - Mouse Y position
     * @param {Object} connection - Connection data
     */
    showConnectionTooltip(mouseX, mouseY, connection) {
        const tooltip = document.getElementById('tileTooltip');
        if (!tooltip) return;
        
        let content = `<div style="font-weight: bold; margin-bottom: 4px; color: #ffff00;">🔗 Warp Connection</div>`;
        
        // From map info
        content += `<div style="color: #00ff00;">From Map ${connection.fromMapId}</div>`;
        if (connection.fromMapData?.name) {
            content += `<div style="color: #88ff88; font-size: 0.9em; margin-bottom: 2px;">"${connection.fromMapData.name}"</div>`;
        }
        content += `Warp Position: (${connection.fromWarp.x}, ${connection.fromWarp.y})<br>`;
        content += `Warp ID: ${connection.fromWarp.warpId}<br>`;
        
        // Convert ROM coords (2-tile units) to tile coords for display
        const fromTileX = connection.fromWarp.x * 2;
        const fromTileY = connection.fromWarp.y * 2;
        content += `<span style="color: #aaa; font-size: 0.9em;">Tile: (${fromTileX}, ${fromTileY})</span><br>`;
        
        content += `<div style="border-top: 1px solid #666; margin: 4px 0;"></div>`;
        
        // To map info
        content += `<div style="color: #00ffff;">To Map ${connection.toMapId}</div>`;
        if (connection.toMapData?.name) {
            content += `<div style="color: #88ffff; font-size: 0.9em; margin-bottom: 2px;">"${connection.toMapData.name}"</div>`;
        }
        if (connection.toWarp) {
            content += `Warp Position: (${connection.toWarp.x}, ${connection.toWarp.y})<br>`;
            content += `Warp ID: ${connection.toWarp.warpId}<br>`;
            
            // Convert ROM coords to tile coords for display
            const toTileX = connection.toWarp.x * 2;
            const toTileY = connection.toWarp.y * 2;
            content += `<span style="color: #aaa; font-size: 0.9em;">Tile: (${toTileX}, ${toTileY})</span><br>`;
        } else {
            content += `<span style="color: #ff8800;">⚠️ Destination warp not found</span><br>`;
            if (connection.fromWarp.destWarpId !== undefined) {
                content += `<span style="color: #888; font-size: 0.9em;">Looking for warp ID: ${connection.fromWarp.destWarpId}</span><br>`;
            }
        }
        
        content += `<div style="margin-top: 4px; color: #aaa; font-size: 0.85em;">Click to navigate to destination</div>`;
        
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
        
        // Zoom controls - slider (inverted: right = zoom out)
        const zoomSlider = document.getElementById('zoomSlider');
        const resetZoomBtn = document.getElementById('resetZoomBtn');
        
        if (zoomSlider) {
            // Initial slider value will be set by updateZoomDisplay()
            
            // Handle slider input
            zoomSlider.addEventListener('input', (e) => {
                const invertedValue = parseFloat(e.target.value);
                const zoomValue = this.invertZoomValue(invertedValue);
                this.setZoom(zoomValue);
            });
        }
        
        if (resetZoomBtn) resetZoomBtn.addEventListener('click', () => this.resetView());
        
        // Debug controls
        const printCollisionBtn = document.getElementById('printCollisionBtn');
        if (printCollisionBtn) printCollisionBtn.addEventListener('click', () => this.printCollisionData());
        
        const analyzeConnectionsBtn = document.getElementById('analyzeConnectionsBtn');
        if (analyzeConnectionsBtn) analyzeConnectionsBtn.addEventListener('click', () => this.analyzeConnections());
        
        const applyOptimalAlignmentsBtn = document.getElementById('applyOptimalAlignmentsBtn');
        if (applyOptimalAlignmentsBtn) applyOptimalAlignmentsBtn.addEventListener('click', () => this.applyOptimalAlignments());
        
        // Tile animation debug button
        const tileAnimDebugBtn = document.getElementById('tileAnimDebugBtn');
        if (tileAnimDebugBtn) {
            tileAnimDebugBtn.addEventListener('click', () => this.toggleTileAnimationDebug());
        }
        
        // Interior layout checkbox
        const interiorLayoutCheckbox = document.getElementById('showInteriorLayoutCheckbox');
        if (interiorLayoutCheckbox) {
            // Load saved state - default to true (checked)
            const savedState = this.preferences.loadInteriorLayoutMode();
            this.showingInteriorLayout = savedState;
            interiorLayoutCheckbox.checked = savedState;
            
            interiorLayoutCheckbox.addEventListener('change', (e) => {
                this.toggleInteriorLayout(e.target.checked);
            });
        }
        
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
                
                // Sync with interior renderer
                if (this.interiorRenderer) {
                    this.interiorRenderer.setShowCollisionOverlays(this.showOverlays);
                }
                
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
        
        // Tile optimization checkbox
        const tileOptimizationCheckbox = document.getElementById('tileOptimizationCheckbox');
        if (tileOptimizationCheckbox) {
            tileOptimizationCheckbox.checked = this.tileOptimizationEnabled;
            tileOptimizationCheckbox.addEventListener('change', (e) => {
                this.tileOptimizationEnabled = e.target.checked;
                this.preferences.saveTileOptimization(this.tileOptimizationEnabled);
                Logger.log(`Tile optimization ${this.tileOptimizationEnabled ? 'enabled' : 'disabled'}`);
                
                // Sync with interior renderer
                if (this.interiorRenderer) {
                    this.interiorRenderer.setTileOptimization(this.tileOptimizationEnabled);
                }
                
                // Force immediate render to show changes
                this.isRendering = false;
                this.render();
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
        this.updateZoomSlider();
        this.render();
    }
    
    /**
     * Set zoom to a specific value
     * @param {number} zoom - Target zoom level
     */
    setZoom(zoom) {
        this.viewportState.setScale(zoom);
        this.preferences.saveZoom(zoom);
        this.updateZoomDisplay();
        this.render();
    }
    
    /**
     * Invert zoom value for slider (right = zoom out)
     * @param {number} value - Value to invert
     * @returns {number} Inverted value
     */
    invertZoomValue(value) {
        // Invert around the midpoint in log scale for better feel
        const min = MIN_ZOOM;
        const max = MAX_ZOOM;
        // Use logarithmic inversion for better distribution
        const logMin = Math.log(min);
        const logMax = Math.log(max);
        const logValue = Math.log(value);
        const inverted = Math.exp(logMax + logMin - logValue);
        return Math.max(min, Math.min(max, inverted));
    }
    
    /**
     * Update zoom slider position
     */
    updateZoomSlider() {
        const zoomSlider = document.getElementById('zoomSlider');
        if (zoomSlider) {
            const currentScale = this.viewportState.getScale();
            zoomSlider.value = this.invertZoomValue(currentScale);
        }
    }
    
    toggleOverlays() {
        this.showOverlays = !this.showOverlays;
        this.preferences.saveShowOverlays(this.showOverlays);
        
        // Sync collision overlay setting with interior renderer
        if (this.interiorRenderer) {
            this.interiorRenderer.setShowCollisionOverlays(this.showOverlays);
        }
        
        // Sync checkbox state
        const overlaysCheckbox = document.getElementById('showOverlaysCheckbox');
        if (overlaysCheckbox) {
            overlaysCheckbox.checked = this.showOverlays;
        }
        
        Logger.log(`Overlays: ${this.showOverlays ? 'ON' : 'OFF'}`);
        
        // Force immediate render
        this.isRendering = false; // Reset render lock
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
    
    toggleTileAnimationDebug() {
        if (this.tileAnimationDebugPanel) {
            this.tileAnimationDebugPanel.toggle();
            
            // Update previews when panel opens
            if (this.tileAnimationDebugPanel.isVisible) {
                // Update flower frame previews
                const flowerFrames = this.tileAnimator.getFlowerFrames();
                this.tileAnimationDebugPanel.updateFlowerFramePreviews(flowerFrames);
                
                // Update water frame preview
                this.updateWaterFramePreview();
                
                // Set up interval to update water preview during animation
                if (!this._waterPreviewInterval) {
                    this._waterPreviewInterval = setInterval(() => {
                        if (this.tileAnimationDebugPanel && this.tileAnimationDebugPanel.isVisible) {
                            this.updateWaterFramePreview();
                        }
                    }, 200); // Update 5 times per second
                }
            } else {
                // Clear interval when panel closes
                if (this._waterPreviewInterval) {
                    clearInterval(this._waterPreviewInterval);
                    this._waterPreviewInterval = null;
                }
            }
        }
    }
    
    /**
     * Update the water frame preview in the debug panel
     */
    updateWaterFramePreview() {
        const currentMap = this.mapState.getCurrentMap();
        if (!currentMap) return;
        
        const tilesetImg = this.tilesetManager.getTilesetImage(currentMap.tileset);
        if (!tilesetImg) return;
        
        const waterFrameCanvas = this.tileAnimator.getCurrentWaterFrame(tilesetImg, 1);
        if (waterFrameCanvas && this.tileAnimationDebugPanel) {
            this.tileAnimationDebugPanel.updateWaterFramePreview(waterFrameCanvas);
        }
    }
    
    /**
     * Toggle interior layout rendering mode
     * @param {boolean} enabled - Whether to enable interior layout mode
     */
    async toggleInteriorLayout(enabled) {
        const currentMap = this.mapState.getCurrentMap();
        if (!currentMap) {
            Logger.warn('No map loaded');
            // Reset checkbox if no map
            const checkbox = document.getElementById('showInteriorLayoutCheckbox');
            if (checkbox) checkbox.checked = false;
            return;
        }
        
        if (!enabled || this.showingInteriorLayout) {
            // Switch back to normal rendering
            this.showingInteriorLayout = false;
            this.interiorLayoutManager.clearCurrentLayout();
            this.preferences.saveShowInteriorLayout(false);
            
            Logger.log('Interior layout mode: OFF');
            this.render();
        } else {
            // Check if this is an interior map
            if (!this.interiorLayoutManager.isInteriorMap(currentMap)) {
                Logger.warn(`Map ${currentMap.mapId} is not an interior map (has connections)`);
                
                // Reset checkbox
                const checkbox = document.getElementById('showInteriorLayoutCheckbox');
                if (checkbox) checkbox.checked = false;
                
                return;
            }
            
            // Analyze and build layout
            Logger.log(`🏢 Analyzing interior layout for map ${currentMap.mapId}...`);
            const layout = await this.interiorLayoutManager.analyzeInteriorMapLayout(currentMap.mapId);
            
            if (!layout) {
                Logger.error('Failed to build interior layout');
                
                // Reset checkbox
                const checkbox = document.getElementById('showInteriorLayoutCheckbox');
                if (checkbox) checkbox.checked = false;
                
                return;
            }
            
            // Set layout and switch to interior rendering mode
            this.interiorLayoutManager.setCurrentLayout(layout);
            this.showingInteriorLayout = true;
            this.preferences.saveShowInteriorLayout(true);
            
            Logger.success(`✓ Interior layout loaded: ${layout.rooms.length} rooms`);
            
            // Center view on the layout
            this.centerViewOnInteriorLayout(layout);
            
            this.render();
        }
    }
    
    /**
     * Center the view on an interior layout, focusing on the main room
     * Uses same top-left positioning as normal mode
     */
    centerViewOnInteriorLayout(layout) {
        if (!layout) return;
        
        const currentMap = this.mapState.getCurrentMap();
        if (!currentMap) return;
        
        // Find the main room in the layout
        const mainRoom = layout.rooms.find(room => room.mapData.mapId === currentMap.mapId);
        if (!mainRoom) {
            Logger.warn(`Main room ${currentMap.mapId} not found in layout, centering on entire layout`);
            this.centerViewOnEntireLayout(layout);
            return;
        }
        
        const scale = this.viewportState.getScale();
        
        // Position main room at top-left like normal mode (DEFAULT_OFFSET_X/Y)
        // Calculate offset so main room's top-left corner is at DEFAULT_OFFSET position
        const roomTopLeftX = mainRoom.offsetX * BLOCK_SIZE * TILE_SIZE * scale;
        const roomTopLeftY = mainRoom.offsetY * BLOCK_SIZE * TILE_SIZE * scale;
        
        const offsetX = DEFAULT_OFFSET_X - roomTopLeftX;
        const offsetY = DEFAULT_OFFSET_Y - roomTopLeftY;
        
        this.viewportState.offsetX = offsetX;
        this.viewportState.offsetY = offsetY;
        
        Logger.log(`📍 Interior layout centered on main room ${currentMap.mapId} at top-left position (${offsetX.toFixed(0)}, ${offsetY.toFixed(0)})`);
    }
    
    /**
     * Center the view on the entire interior layout (fallback)
     */
    centerViewOnEntireLayout(layout) {
        if (!layout) return;
        
        const scale = this.viewportState.getScale();
        const totalWidthPx = layout.totalWidth * BLOCK_SIZE * TILE_SIZE * scale;
        const totalHeightPx = layout.totalHeight * BLOCK_SIZE * TILE_SIZE * scale;
        
        const canvasWidth = this.renderer.getWidth();
        const canvasHeight = this.renderer.getHeight();
        
        // Center if layout fits, otherwise add padding
        let centerX, centerY;
        
        if (totalWidthPx < canvasWidth) {
            // Layout fits horizontally - center it
            centerX = (canvasWidth - totalWidthPx) / 2;
        } else {
            // Layout is wider than canvas - add left padding
            centerX = 50;
        }
        
        if (totalHeightPx < canvasHeight) {
            // Layout fits vertically - center it
            centerY = (canvasHeight - totalHeightPx) / 2;
        } else {
            // Layout is taller than canvas - add top padding
            centerY = 50;
        }
        
        this.viewportState.offsetX = centerX;
        this.viewportState.offsetY = centerY;
        
        Logger.log(`📍 Interior layout centered at (${centerX}, ${centerY})`);
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
    
    async analyzeConnections() {
        console.clear();
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔗 CONNECTION ALIGNMENT ANALYSIS');
        console.log('═══════════════════════════════════════════════════════');
        
        const currentMap = this.mapState.getCurrentMap();
        if (!currentMap) {
            console.log('\n⚠️  No map currently loaded');
            Logger.warn('Load a map first before analyzing connections');
            return;
        }
        console.log(`\n📍 Current Map: ${currentMap.name} (ID: ${currentMap.id})`);
        console.log(`   Size: ${currentMap.width}x${currentMap.height} blocks`);
        console.log(`   Tileset: ${currentMap.tilesetName} (ID: ${currentMap.tileset})`);
        
        // Check if map has connections
        if (!currentMap.connections || Object.keys(currentMap.connections).length === 0) {
            console.log('\n❌ This map has no connections');
            return;
        }
        
        console.log(`\n🔗 Found ${Object.keys(currentMap.connections).length} connection(s)`);
        
        // Track analysis results
        const analysisResults = [];
        
        // Analyze each connection
        const directions = ['north', 'south', 'east', 'west'];
        for (const direction of directions) {
            if (!currentMap.connections[direction] || !currentMap.connectionHeaders[direction]) {
                continue;
            }
            
            const header = currentMap.connectionHeaders[direction];
            const connectedMapId = header.connectedMap;
            
            console.log(`\n${'─'.repeat(55)}`);
            console.log(`📌 ${direction.toUpperCase()} Connection`);
            console.log(`${'─'.repeat(55)}`);
            
            // Load connected map
            const connectedMap = await this.mapDataManager.loadMapByIndex(connectedMapId);
            if (!connectedMap) {
                console.log('   ⚠️  Could not load connected map');
                continue;
            }
            
            // Ensure tilesets are loaded
            if (!this.tilesetManager.hasBlockDefinitions(currentMap.tileset)) {
                await this.tilesetManager.loadTilesetBlocks(currentMap.tileset);
            }
            if (!this.tilesetManager.hasBlockDefinitions(connectedMap.tileset)) {
                await this.tilesetManager.loadTilesetBlocks(connectedMap.tileset);
            }
            
            // Analyze alignment
            const currentAlignment = direction === 'north' || direction === 'south' ? header.xAlignment : header.yAlignment;
            const result = await this.connectionAligner.analyzeConnectionAlignment(
                currentMap,
                connectedMap,
                direction,
                currentAlignment
            );
            
            analysisResults.push({
                direction,
                header,
                ...result
            });
        }
        
        console.log(`\n${'═'.repeat(55)}`);
        console.log('📊 ANALYSIS SUMMARY');
        console.log(`${'═'.repeat(55)}`);
        
        const needsAdjustment = analysisResults.filter(r => r.shouldAdjust);
        const alreadyOptimal = analysisResults.filter(r => !r.shouldAdjust && r.currentScore > 0);
        const noWalkable = analysisResults.filter(r => r.currentScore === 0 && r.optimalScore === 0);
        
        console.log(`\n✅ Optimal: ${alreadyOptimal.length}`);
        console.log(`⚠️  Needs adjustment: ${needsAdjustment.length}`);
        console.log(`❌ No walkable alignments: ${noWalkable.length}`);
        
        if (needsAdjustment.length > 0) {
            console.log(`\n💡 SUGGESTED ADJUSTMENTS:`);
            needsAdjustment.forEach((result, index) => {
                console.log(`\n  ${index + 1}. ${result.direction.toUpperCase()}:`);
                console.log(`     Current: ${result.currentAlignment}px (score: ${result.currentScore})`);
                console.log(`     Optimal: ${result.optimalAlignment}px (score: ${result.optimalScore})`);
                console.log(`     Change: ${result.optimalAlignment - result.currentAlignment > 0 ? '+' : ''}${result.optimalAlignment - result.currentAlignment}px`);
            });
            
            console.log(`\n🔧 APPLY ADJUSTMENTS:`);
            console.log(`   Run: mapViewer.applyOptimalAlignments()`);
            console.log(`   This will temporarily adjust connection rendering to use optimal alignments.`);
        }
        
        console.log(`\n${'═'.repeat(55)}`);
        console.log('✅ Connection analysis complete');
        console.log(`${'═'.repeat(55)}\n`);
        
        Logger.success('Connection alignment analysis printed to console');
        
        // Return results for potential programmatic use
        return analysisResults;
    }
    
    /**
     * Apply optimal alignments to connected maps and re-render
     * This temporarily overrides connection headers with calculated optimal alignments
     */
    async applyOptimalAlignments() {
        const currentMap = this.mapState.getCurrentMap();
        if (!currentMap) {
            Logger.warn('No map loaded');
            return;
        }
        
        Logger.log('Applying optimal connection alignments...');
        
        let adjustmentCount = 0;
        const directions = ['north', 'south', 'east', 'west'];
        
        for (const direction of directions) {
            if (!currentMap.connections[direction] || !currentMap.connectionHeaders[direction]) {
                continue;
            }
            
            const header = currentMap.connectionHeaders[direction];
            const connectedMapId = header.connectedMap;
            const connectedMap = await this.mapDataManager.loadMapByIndex(connectedMapId);
            
            if (!connectedMap) continue;
            
            // Ensure tilesets loaded
            if (!this.tilesetManager.hasBlockDefinitions(currentMap.tileset)) {
                await this.tilesetManager.loadTilesetBlocks(currentMap.tileset);
            }
            if (!this.tilesetManager.hasBlockDefinitions(connectedMap.tileset)) {
                await this.tilesetManager.loadTilesetBlocks(connectedMap.tileset);
            }
            
            // Analyze and get optimal alignment
            const currentAlignment = direction === 'north' || direction === 'south' ? header.xAlignment : header.yAlignment;
            const result = await this.connectionAligner.analyzeConnectionAlignment(
                currentMap,
                connectedMap,
                direction,
                currentAlignment
            );
            
            if (result.shouldAdjust) {
                // Apply optimal alignment to header
                if (direction === 'north' || direction === 'south') {
                    header.xAlignment = result.optimalAlignment;
                } else {
                    header.yAlignment = result.optimalAlignment;
                }
                
                Logger.success(`Adjusted ${direction} connection: ${currentAlignment}px → ${result.optimalAlignment}px`);
                adjustmentCount++;
            }
        }
        
        if (adjustmentCount > 0) {
            Logger.success(`Applied ${adjustmentCount} alignment adjustment(s). Re-rendering...`);
            await this.render();
        } else {
            Logger.log('All connections already optimal, no adjustments needed');
        }
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
        
        // Also update slider position
        this.updateZoomSlider();
    }
    
    getModuleVersions() {
        return {
            'MapViewer': MODULE_VERSION,
            'Config': CONFIG_VERSION,
            'Logger': LOGGER_VERSION,
            'ErrorHandler': ERROR_HANDLER_VERSION,
            'FPSCounter': FPS_COUNTER_VERSION,
            'ViewportState': VIEWPORT_STATE_VERSION,
            'MapState': MAP_STATE_VERSION,
            'PreferencesManager': PREFERENCES_VERSION,
            'CacheManager': CACHE_MANAGER_VERSION,
            'MapDataManager': MAP_DATA_VERSION,
            'TilesetManager': TILESET_VERSION,
            'SpriteManager': SPRITE_VERSION,
            'CanvasRenderer': RENDERER_VERSION,
            'NPCMovement': NPC_MOVEMENT_VERSION,
            'TileAnimator': TILE_ANIMATOR_VERSION,
            'InteriorLayoutManager': INTERIOR_LAYOUT_VERSION,
            'InteriorRenderer': INTERIOR_RENDERER_VERSION
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
                ? `Map Viewer v${MAP_VIEWER_VERSION} | Build: ${MAP_VIEWER_BUILD_DATE} | Maps: <span id="mapsCount">${mapCount}</span> | FPS: <span id="fpsDisplay">--</span>`
                : `Map Viewer v${MAP_VIEWER_VERSION} | Build: ${MAP_VIEWER_BUILD_DATE} | Maps: <span id="mapsCount">0</span> | FPS: <span id="fpsDisplay">--</span>`;
            
            footer.innerHTML = `
                <div class="main-version">${mainInfo}</div>
                <div class="modules">Modules: ${versionList}</div>
            `;
            
            // Reinitialize FPS display element after innerHTML update
            const fpsElement = document.getElementById('fpsDisplay');
            if (fpsElement && this.fpsCounter) {
                this.fpsCounter.setDisplayElement(fpsElement);
            }
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
            
            // Check if we should enable interior layout mode
            // Restore preference from localStorage if this is an interior map
            const savedInteriorLayoutPref = this.preferences.loadShowInteriorLayout();
            const isInterior = this.interiorLayoutManager && this.interiorLayoutManager.isInteriorMap(mapData);
            
            // Apply interior layout if preference is enabled and this is an interior map
            if (savedInteriorLayoutPref && isInterior) {
                this.showingInteriorLayout = true;
                Logger.log(`🏢 Auto-loading interior layout for map ${mapId}...`);
                try {
                    // Clear layout and cache to rebuild from current map as root
                    this.interiorLayoutManager.clearCurrentLayout();
                    this.interiorLayoutManager.clearCache();
                    
                    const layout = await this.interiorLayoutManager.analyzeInteriorMapLayout(mapData.mapId);
                    if (layout) {
                        this.interiorLayoutManager.setCurrentLayout(layout);
                        this.centerViewOnInteriorLayout(layout);
                        Logger.success(`✓ Interior layout auto-loaded: ${layout.rooms.length} rooms`);
                    }
                } catch (error) {
                    Logger.warn(`Failed to auto-load interior layout: ${error.message}`);
                }
            } else if (!isInterior && this.showingInteriorLayout) {
                // If switching to non-interior map, disable layout mode but keep preference
                this.showingInteriorLayout = false;
                this.interiorLayoutManager.clearCurrentLayout();
            }
            
            // Render (await to ensure it completes)
            await this.render();
            
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
        
        // Enable debug buttons now that a map is loaded
        const analyzeConnectionsBtn = document.getElementById('analyzeConnectionsBtn');
        if (analyzeConnectionsBtn) {
            analyzeConnectionsBtn.disabled = false;
        }
        
        const applyOptimalAlignmentsBtn = document.getElementById('applyOptimalAlignmentsBtn');
        if (applyOptimalAlignmentsBtn) {
            applyOptimalAlignmentsBtn.disabled = false;
        }
        
        // Enable/disable interior layout checkbox based on map type
        const interiorLayoutCheckbox = document.getElementById('showInteriorLayoutCheckbox');
        if (interiorLayoutCheckbox && this.interiorLayoutManager) {
            const isInterior = this.interiorLayoutManager.isInteriorMap(mapData);
            interiorLayoutCheckbox.disabled = !isInterior;
            
            // Set checkbox state based on current mode
            if (isInterior) {
                interiorLayoutCheckbox.checked = this.showingInteriorLayout;
                const label = document.querySelector('label[for="showInteriorLayoutCheckbox"]');
                if (label) {
                    label.title = 'Show connected interior rooms side-by-side';
                }
            } else {
                // For non-interior maps, uncheck but don't modify the preference
                interiorLayoutCheckbox.checked = false;
                const label = document.querySelector('label[for="showInteriorLayoutCheckbox"]');
                if (label) {
                    label.title = 'Only available for interior maps without connections';
                }
            }
        }
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
