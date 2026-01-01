// Pokemon Red Map Viewer
// Renders maps using extracted map data and tileset textures

// Version information
const MAP_VIEWER_VERSION = '2.5.0';
const MAP_VIEWER_BUILD_DATE = '2025-12-31';

console.log('🎮 Pokemon Red Map Viewer - Starting initialization...');
console.log(`📦 Version ${MAP_VIEWER_VERSION} (Build: ${MAP_VIEWER_BUILD_DATE})`);

// Constants
const TILE_SIZE = 8; // Each tile is 8x8 pixels
const BLOCK_SIZE = 4; // Each block is 4x4 tiles (32x32 pixels)

// Global state
let currentMap = null;
let previousMapId = null; // Track the immediate previous map
let lastOverworldMapId = null; // Track the last overworld map (for map 255 warps)
let mapDataCache = {};
let tilesetImages = {};
let tilesetBlockDefinitions = {}; // Cache for block definitions from tilesets_complete.json
let overworldSprites = {}; // Cache for loaded overworld sprite images
let overworldSpriteData = null; // Metadata from overworld_sprites.json
let canvas, ctx;
let scale = 2;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let showOverlays = true; // Toggle for warp/script/sign/sprite indicators
let showGrid = false; // Toggle for grid overlay (default: off)
let showCoordLabels = false; // Toggle for coordinate labels on blocks (default: off)
let hoveredTile = null; // Track hovered tile for highlighting {blockX, blockY, tileX, tileY, tileIndex, screenX, screenY}

// Error handling
function showError(message) {
    console.error('❌ Error:', message);
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        const toastEl = document.getElementById('errorToast');
        const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
        toast.show();
    } else {
        // Fallback if Bootstrap isn't loaded yet
        alert('Error: ' + message);
    }
}

// Version footer
function updateVersionFooter(mapCount = null) {
    const footer = document.getElementById('versionFooter');
    if (footer) {
        if (mapCount !== null) {
            footer.textContent = `Map Viewer v${MAP_VIEWER_VERSION} | Build: ${MAP_VIEWER_BUILD_DATE} | Maps: ${mapCount}`;
        } else {
            footer.textContent = `Map Viewer v${MAP_VIEWER_VERSION} | Build: ${MAP_VIEWER_BUILD_DATE}`;
        }
        console.log(`📌 Version footer updated: v${MAP_VIEWER_VERSION}`);
    }
}

// Control functions - defined early so they're available for onclick handlers
function zoomIn() {
    if (scale < 8) {
        const oldScale = scale;
        scale = Math.min(8, scale + 1);
        
        // Adjust offset to zoom towards center
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        offsetX = centerX - (centerX - offsetX) * (scale / oldScale);
        offsetY = centerY - (centerY - offsetY) * (scale / oldScale);
        
        console.log(`🔍 Zoom: ${scale}x`);
        localStorage.setItem('mapViewerZoom', scale); // Save zoom level
        updateZoomDisplay();
        renderMap();
    }
}
window.zoomIn = zoomIn;

function zoomOut() {
    if (scale > 1) {
        const oldScale = scale;
        scale = Math.max(1, scale - 1);
        
        // Adjust offset to zoom towards center
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        offsetX = centerX - (centerX - offsetX) * (scale / oldScale);
        offsetY = centerY - (centerY - offsetY) * (scale / oldScale);
        
        console.log(`🔍 Zoom: ${scale}x`);
        localStorage.setItem('mapViewerZoom', scale); // Save zoom level
        updateZoomDisplay();
        renderMap();
    }
}
window.zoomOut = zoomOut;

function resetView() {
    scale = 2;
    offsetX = 50;
    offsetY = 50;
    localStorage.setItem('mapViewerZoom', scale); // Save zoom level
    updateZoomDisplay();
    renderMap();
}
window.resetView = resetView;

function toggleOverlays() {
    showOverlays = !showOverlays;
    console.log(`🔄 Overlays: ${showOverlays ? 'ON' : 'OFF'}`);
    renderMap();
}
window.toggleOverlays = toggleOverlays;

function toggleCoordLabels() {
    showCoordLabels = !showCoordLabels;
    console.log(`🏷️ Coordinate labels: ${showCoordLabels ? 'ON' : 'OFF'}`);
    renderMap();
}
window.toggleCoordLabels = toggleCoordLabels;

function toggleSidebar() {
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
    
    // Save sidebar state to localStorage
    localStorage.setItem('mapViewerSidebarHidden', isHidden);
    console.log(`📋 Sidebar: ${isHidden ? 'HIDDEN' : 'VISIBLE'} (saved)`);
    
    // Re-render map after sidebar animation completes
    setTimeout(() => {
        if (canvas) {
            const container = canvas.parentElement;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            renderMap();
        }
    }, 300);
}
window.toggleSidebar = toggleSidebar;

// Initialize
async function init() {
    // Prevent double initialization
    if (window.mapViewerInitialized) {
        console.log('⚠️ Already initialized, skipping');
        return;
    }
    window.mapViewerInitialized = true;
    
    try {
        console.log('📋 DOM loaded, initializing canvas...');
        
        canvas = document.getElementById('mapCanvas');
        if (!canvas) {
            throw new Error('Canvas element not found!');
        }
        console.log('✓ Canvas element found');
        
        ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context!');
        }
        console.log('✓ 2D context acquired');
        
        // Disable image smoothing for pixel-perfect rendering
        ctx.imageSmoothingEnabled = false;
        
        // Restore saved zoom level from localStorage
        const savedZoom = localStorage.getItem('mapViewerZoom');
        if (savedZoom) {
            const zoomValue = parseInt(savedZoom, 10);
            if (zoomValue >= 1 && zoomValue <= 8) {
                scale = zoomValue;
                console.log(`🔍 Restored zoom level: ${scale}x`);
            }
        }
        
        // Restore debug panel options from localStorage
        const savedOverlays = localStorage.getItem('mapViewerShowOverlays');
        if (savedOverlays !== null) {
            showOverlays = savedOverlays === 'true';
            console.log(`🔄 Restored overlays: ${showOverlays ? 'ON' : 'OFF'}`);
        }
        
        const savedGrid = localStorage.getItem('mapViewerShowGrid');
        if (savedGrid !== null) {
            showGrid = savedGrid === 'true';
            console.log(`📊 Restored grid: ${showGrid ? 'ON' : 'OFF'}`);
        }
        
        const savedCoordLabels = localStorage.getItem('mapViewerShowCoordLabels');
        if (savedCoordLabels !== null) {
            showCoordLabels = savedCoordLabels === 'true';
            console.log(`🏷️ Restored coordinates: ${showCoordLabels ? 'ON' : 'OFF'}`);
        }
        
        // Setup canvas size
        console.log('📏 Setting up canvas size...');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        console.log('✓ Canvas resize handler attached');
        
        // Initialize version footer early
        updateVersionFooter();
        
        // Setup mouse controls
        console.log('🖱️ Setting up mouse controls...');
        setupMouseControls();
        console.log('✓ Mouse controls ready');
        
        // Setup keyboard controls
        console.log('⌨️ Setting up keyboard controls...');
        setupKeyboardControls();
        console.log('✓ Keyboard controls ready');
        
        // Setup UI controls
        console.log('🎛️ Setting up UI controls...');
        setupUIControls();
        console.log('✓ UI controls ready');
        
        // Restore sidebar state from localStorage
        const sidebarHidden = localStorage.getItem('mapViewerSidebarHidden');
        if (sidebarHidden === 'true') {
            const sidebar = document.getElementById('sidebar');
            const toggleBtn = document.getElementById('toggleSidebarBtn');
            if (sidebar && toggleBtn) {
                sidebar.classList.add('hidden');
                toggleBtn.classList.remove('sidebar-visible');
                toggleBtn.textContent = '☰';
                console.log('📋 Restored sidebar state: HIDDEN');
            }
        }
        
        // Update zoom display with restored value
        updateZoomDisplay();
        
        // Load map list
        console.log('📂 Loading map list...');
        await loadMapList();
        console.log('✓ Map list loaded successfully');
        
        // Hide loading screen
        document.getElementById('loading').classList.add('hidden');
        console.log('✅ Initialization complete!');
        
    } catch (error) {
        console.error('💥 Fatal error during initialization:', error);
        showError('Failed to initialize: ' + error.message);
        document.getElementById('loading').classList.add('hidden');
    }
}

// Expose init to window and set up event listener
window.init = init;
window.addEventListener('DOMContentLoaded', init);

// Also try to initialize if DOM is already ready (for dynamic script loading)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('📌 DOM already ready, calling init immediately');
    // Use setTimeout to ensure the script is fully loaded
    setTimeout(() => init(), 0);
}


function resizeCanvas() {
    const container = document.getElementById('container');
    const sidebar = document.getElementById('sidebar');
    canvas.width = container.clientWidth - sidebar.clientWidth;
    canvas.height = container.clientHeight;
    
    if (currentMap) {
        renderMap();
    }
}

function setupMouseControls() {
    let mouseDownX = 0, mouseDownY = 0;
    let hasDragged = false;
    
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        hasDragged = false;
        mouseDownX = e.clientX;
        mouseDownY = e.clientY;
        dragStartX = e.clientX - offsetX;
        dragStartY = e.clientY - offsetY;
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const dx = Math.abs(e.clientX - mouseDownX);
            const dy = Math.abs(e.clientY - mouseDownY);
            if (dx > 5 || dy > 5) {
                hasDragged = true;
            }
            offsetX = e.clientX - dragStartX;
            offsetY = e.clientY - dragStartY;
            renderMap();
            hideTooltip();
        } else if (currentMap) {
            // Get tile information for tooltip
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            
            // Convert to TILE coordinates (not block!)
            const worldTileX = Math.floor((canvasX - offsetX) / (TILE_SIZE * scale));
            const worldTileY = Math.floor((canvasY - offsetY) / (TILE_SIZE * scale));
            
            // Convert tile coordinates to block coordinates
            const mapBlockX = Math.floor(worldTileX / BLOCK_SIZE);
            const mapBlockY = Math.floor(worldTileY / BLOCK_SIZE);
            
            // Calculate which tile within the block (0-15, in 4x4 grid)
            const tileXInBlock = worldTileX % BLOCK_SIZE;
            const tileYInBlock = worldTileY % BLOCK_SIZE;
            const tileIndexInBlock = tileYInBlock * BLOCK_SIZE + tileXInBlock;
            
            // Check if within map bounds
            if (mapBlockX >= 0 && mapBlockX < currentMap.width && 
                mapBlockY >= 0 && mapBlockY < currentMap.height) {
                
                // Update hovered tile and re-render if changed
                const newHovered = {
                    blockX: mapBlockX, 
                    blockY: mapBlockY,
                    tileX: tileXInBlock,
                    tileY: tileYInBlock,
                    tileIndex: tileIndexInBlock,
                    worldTileX: worldTileX,
                    worldTileY: worldTileY
                };
                
                if (!hoveredTile || 
                    hoveredTile.worldTileX !== worldTileX || 
                    hoveredTile.worldTileY !== worldTileY) {
                    hoveredTile = newHovered;
                    renderMap(); // Re-render to show highlight
                }
                
                showTileTooltip(e.clientX, e.clientY, mapBlockX, mapBlockY, 
                                tileXInBlock, tileYInBlock, tileIndexInBlock);
                
                // Check if hovering over a warp or boundary to change cursor
                if (showOverlays && currentMap.objects) {
                    // ROM coords are in 2-tile units (metatiles)
                    const romX = Math.floor(worldTileX / 2);
                    const romY = Math.floor(worldTileY / 2);
                    const isOverWarp = currentMap.objects.warps?.data?.some(warp => 
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
                    
                    canvas.style.cursor = (isOverWarp || isOverBoundary) ? 'pointer' : 'grab';
                } else {
                    canvas.style.cursor = 'grab';
                }
            } else {
                if (hoveredTile) {
                    hoveredTile = null;
                    renderMap();
                }
                hideTooltip();
                canvas.style.cursor = 'default';
            }
        } else {
            hideTooltip();
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        if (!hasDragged && showOverlays) {
            // Check if we clicked on a warp
            handleCanvasClick(e);
        }
        isDragging = false;
    });
    
    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
        if (hoveredTile) {
            hoveredTile = null;
            renderMap();
        }
        hideTooltip();
    });
    
    // Zoom with mouse wheel
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            zoomIn();
        } else {
            zoomOut();
        }
    });
}

// Tooltip functions
function showTileTooltip(mouseX, mouseY, blockX, blockY, tileX, tileY, tileIndex) {
    const tooltip = document.getElementById('tileTooltip');
    if (!tooltip || !currentMap) return;
    
    // Get block data
    const blockIndex = blockY * currentMap.width + blockX;
    const blockId = currentMap.blockData[blockIndex];
    
    // Get tile ID from block definition
    const blockDefinitions = tilesetBlockDefinitions[currentMap.tileset];
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
    
    // Add tile metadata if available
    if (currentMap.tileMetadata && currentMap.tileMetadata[blockIndex]) {
        const meta = currentMap.tileMetadata[blockIndex];
        content += `<div style="border-top: 1px solid #4ecdc4; margin-top: 4px; padding-top: 4px;">`;
        content += `<span style="color: #ff6b6b;">Metadata:</span><br>`;
        if (meta.isGrass) content += `🌱 Grass<br>`;
        if (meta.isWater) content += `💧 Water<br>`;
        if (meta.collision) content += `🚫 Collision<br>`;
        if (meta.canEncounter) content += `⚔️ Wild Pokemon<br>`;
        content += `</div>`;
    }
    
    // Check for objects at this position
    // ROM object coords are in 2-tile units (metatiles)
    if (currentMap.objects) {
        let hasObjects = false;
        let objectsInfo = `<div style="border-top: 1px solid #4ecdc4; margin-top: 4px; padding-top: 4px;">`;
        objectsInfo += `<span style="color: #4ecdc4;">Objects:</span><br>`;
        
        // Convert block coords to tile coords, then to ROM 2-tile units
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
            objectsInfo += `👤 ${sprite.type} (Pic ${sprite.pictureId}) (ROM: ${sprite.x},${sprite.y})<br>`;
        }
        
        if (hasObjects) {
            objectsInfo += `</div>`;
            content += objectsInfo;
        }
    }
    
    tooltip.innerHTML = content;
    tooltip.style.display = 'block';
    
    // Position tooltip near mouse but keep it on screen
    const offsetX = 15;
    const offsetY = 15;
    let left = mouseX + offsetX;
    let top = mouseY + offsetY;
    
    // Check if tooltip would go off screen
    const tooltipRect = tooltip.getBoundingClientRect();
    if (left + tooltipRect.width > window.innerWidth) {
        left = mouseX - tooltipRect.width - offsetX;
    }
    if (top + tooltipRect.height > window.innerHeight) {
        top = mouseY - tooltipRect.height - offsetY;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

function hideTooltip() {
    const tooltip = document.getElementById('tileTooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

function handleCanvasClick(e) {
    if (!currentMap || !currentMap.objects) return;
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // Convert canvas coordinates to TILE coordinates
    const tileX = Math.floor((canvasX - offsetX) / (TILE_SIZE * scale));
    const tileY = Math.floor((canvasY - offsetY) / (TILE_SIZE * scale));
    
    // ROM object coords are in 2-TILE units (metatiles), so convert tile coords
    const romX = Math.floor(tileX / 2);
    const romY = Math.floor(tileY / 2);
    
    console.log(`🖱️ Clicked at tile (${tileX}, ${tileY}) = ROM coords (${romX}, ${romY})`);
    
    // Calculate map dimensions in tiles
    const mapWidthTiles = currentMap.width * BLOCK_SIZE;
    const mapHeightTiles = currentMap.height * BLOCK_SIZE;
    
    // Check if clicked on a map boundary connection (using tile coords)
    if (currentMap.connections && currentMap.connectionHeaders) {
        const boundaryThreshold = 1; // One tile width for boundary detection
        
        // North boundary (top row of tiles)
        if (currentMap.connections.north && 
            tileY >= 0 && tileY < boundaryThreshold &&
            tileX >= 0 && tileX < mapWidthTiles) {
            console.log(`🧭 Clicked on NORTH boundary connection`);
            const connectedMapId = currentMap.connectionHeaders.north.connectedMap;
            console.log(`   -> Loading connected map: ${connectedMapId}`);
            loadMap(connectedMapId);
            return;
        }
        
        // South boundary (bottom row of tiles)
        if (currentMap.connections.south && 
            tileY >= mapHeightTiles - boundaryThreshold && tileY < mapHeightTiles &&
            tileX >= 0 && tileX < mapWidthTiles) {
            console.log(`🧭 Clicked on SOUTH boundary connection`);
            const connectedMapId = currentMap.connectionHeaders.south.connectedMap;
            console.log(`   -> Loading connected map: ${connectedMapId}`);
            loadMap(connectedMapId);
            return;
        }
        
        // West boundary (left column of tiles)
        if (currentMap.connections.west && 
            tileX >= 0 && tileX < boundaryThreshold &&
            tileY >= 0 && tileY < mapHeightTiles) {
            console.log(`🧭 Clicked on WEST boundary connection`);
            const connectedMapId = currentMap.connectionHeaders.west.connectedMap;
            console.log(`   -> Loading connected map: ${connectedMapId}`);
            loadMap(connectedMapId);
            return;
        }
        
        // East boundary (right column of tiles)
        if (currentMap.connections.east && 
            tileX >= mapWidthTiles - boundaryThreshold && tileX < mapWidthTiles &&
            tileY >= 0 && tileY < mapHeightTiles) {
            console.log(`🧭 Clicked on EAST boundary connection`);
            const connectedMapId = currentMap.connectionHeaders.east.connectedMap;
            console.log(`   -> Loading connected map: ${connectedMapId}`);
            loadMap(connectedMapId);
            return;
        }
    }
    
    // Check if we clicked on a warp (ROM coords are in 2-tile units)
    if (currentMap.objects.warps && currentMap.objects.warps.data) {
        const clickedWarp = currentMap.objects.warps.data.find(warp => 
            warp.x === romX && warp.y === romY
        );
        
        if (clickedWarp) {
            console.log(`🚪 Clicked on warp:`, clickedWarp);
            console.log(`   -> Destination: Map ${clickedWarp.mapId} (warpId: ${clickedWarp.warpId})`);
            
            // Handle special map IDs
            if (clickedWarp.mapId === 255) {
                // Map 255 means "return to overworld" (exit building)
                console.log(`   🌍 Warp to overworld (map 255)`);
                
                if (lastOverworldMapId !== null && lastOverworldMapId !== undefined) {
                    console.log(`   📍 Returning to last overworld map: ${lastOverworldMapId}`);
                    loadMap(lastOverworldMapId);
                } else {
                    // Fallback to Pallet Town if no overworld map tracked
                    console.log(`   📍 No overworld map tracked, loading Pallet Town (map 0)`);
                    loadMap(0);
                }
            } else if (clickedWarp.mapId === 0 || clickedWarp.mapId < 0) {
                console.warn(`   ⚠️ Invalid warp destination: ${clickedWarp.mapId}`);
            } else {
                // Navigate to the destination map
                loadMap(clickedWarp.mapId);
            }
            return; // Exit after handling warp
        }
    }
    
    // Check if we clicked on a sprite/NPC
    if (currentMap.objects.sprites && currentMap.objects.sprites.data) {
        const clickedSprite = currentMap.objects.sprites.data.find(sprite => 
            sprite.x === romX && sprite.y === romY
        );
        
        if (clickedSprite) {
            console.log(`👤 Clicked on NPC:`, clickedSprite);
            showSpriteDetails(clickedSprite, romX, romY);
            return;
        }
    }
    
    // Check if we clicked on a sign
    if (currentMap.objects.signs && currentMap.objects.signs.data) {
        const clickedSign = currentMap.objects.signs.data.find(sign => 
            sign.x === romX && sign.y === romY
        );
        
        if (clickedSign) {
            console.log(`📋 Clicked on sign:`, clickedSign);
            showSignDetails(clickedSign, romX, romY);
            return;
        }
    }
}

// Show detailed sprite/NPC information in a modal
function showSpriteDetails(sprite, romX, romY) {
    const movementTypes = {
        0: 'Static',
        1: 'Walk randomly',
        2: 'Walk up/down',
        3: 'Walk left/right',
        254: 'Look around',
        255: 'Stand still'
    };
    
    const movementName = movementTypes[sprite.movement] || `Unknown (${sprite.movement})`;
    
    // Populate modal content
    const modalContent = document.getElementById('npcModalContent');
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
            <span class="npc-info-label"><i class="bi bi-arrows-move"></i> Movement:</span>
            <span class="npc-info-value">${movementName} <span class="badge bg-info">${sprite.movement}</span></span>
        </div>
        <div class="npc-info-item">
            <span class="npc-info-label"><i class="bi bi-chat-left-text"></i> Text ID:</span>
            <span class="npc-info-value badge bg-success">${sprite.textId}</span>
        </div>
        <div class="alert alert-info mt-3 mb-0" role="alert">
            <i class="bi bi-info-circle"></i> <small>In future versions, this will show the sprite graphic and allow editing movement patterns.</small>
        </div>
    `;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('npcModal'));
    modal.show();
}

// Show detailed sign information
function showSignDetails(sign, romX, romY) {
    // Populate modal content
    const modalContent = document.getElementById('npcModalContent');
    const modalTitle = document.getElementById('npcModalLabel');
    
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
            <i class="bi bi-info-circle"></i> <small>In future versions, this will show the actual text content.</small>
        </div>
    `;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('npcModal'));
    modal.show();
    
    // Reset title when modal is hidden
    document.getElementById('npcModal').addEventListener('hidden.bs.modal', function () {
        modalTitle.innerHTML = '<i class="bi bi-person-circle"></i> NPC Information';
    }, { once: true });
}

function setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
        switch(e.key) {
            case '+':
            case '=':
                zoomIn();
                break;
            case '-':
            case '_':
                zoomOut();
                break;
            case '0':
                resetView();
                break;
            case 'Tab':
                e.preventDefault();
                toggleSidebar();
                break;
            case 'ArrowUp':
                offsetY += 50;
                renderMap();
                break;
            case 'ArrowDown':
                offsetY -= 50;
                renderMap();
                break;
            case 'ArrowLeft':
                offsetX += 50;
                renderMap();
                break;
            case 'ArrowRight':
                offsetX -= 50;
                renderMap();
                break;
        }
    });
}

function setupUIControls() {
    // Sidebar toggle
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleSidebar);
    }
    
    // Zoom controls
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const resetZoomBtn = document.getElementById('resetZoomBtn');
    
    if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
    if (resetZoomBtn) resetZoomBtn.addEventListener('click', resetView);
    
    // Overlay toggles
    const overlaysCheckbox = document.getElementById('showOverlaysCheckbox');
    const gridCheckbox = document.getElementById('showGridCheckbox');
    const coordsCheckbox = document.getElementById('showCoordsCheckbox');
    
    // Sync checkboxes with restored values
    if (overlaysCheckbox) {
        overlaysCheckbox.checked = showOverlays;
        overlaysCheckbox.addEventListener('change', (e) => {
            showOverlays = e.target.checked;
            localStorage.setItem('mapViewerShowOverlays', showOverlays);
            console.log(`🔄 Overlays: ${showOverlays ? 'ON' : 'OFF'} (saved)`);
            renderMap();
        });
    }
    
    if (gridCheckbox) {
        gridCheckbox.checked = showGrid;
        gridCheckbox.addEventListener('change', (e) => {
            showGrid = e.target.checked;
            localStorage.setItem('mapViewerShowGrid', showGrid);
            console.log(`📊 Grid: ${showGrid ? 'ON' : 'OFF'} (saved)`);
            renderMap();
        });
    }
    
    if (coordsCheckbox) {
        coordsCheckbox.checked = showCoordLabels;
        coordsCheckbox.addEventListener('change', (e) => {
            showCoordLabels = e.target.checked;
            localStorage.setItem('mapViewerShowCoordLabels', showCoordLabels);
            console.log(`🏷️ Coordinates: ${showCoordLabels ? 'ON' : 'OFF'} (saved)`);
            renderMap();
        });
    }
}

async function loadMapList() {
    try {
        console.log('📑 Fetching map index from ../output/map-data/map_index.json');
        const response = await fetch('../output/map-data/map_index.json');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        console.log('✓ Map index fetched successfully');
        
        const data = await response.json();
        console.log(`📊 Loaded ${data.maps.length} maps`);
        
        const mapList = document.getElementById('mapList');
        mapList.innerHTML = '';
        
        // Sort maps by ID
        const sortedMaps = data.maps.sort((a, b) => a.mapId - b.mapId);
        console.log('✓ Maps sorted by ID');
        
        // Group maps
        const towns = sortedMaps.filter(m => m.name.includes('Town') || m.name.includes('City') || m.name.includes('Island') || m.name.includes('Plateau'));
        const routes = sortedMaps.filter(m => m.name.includes('Route'));
        const indoors = sortedMaps.filter(m => !towns.includes(m) && !routes.includes(m));
        
        console.log(`🏘️ Grouped: ${towns.length} towns, ${routes.length} routes, ${indoors.length} indoor maps`);
        
        // Create sections
        createMapSection(mapList, 'Towns & Cities', towns);
        createMapSection(mapList, 'Routes', routes);
        createMapSection(mapList, 'Indoor Maps', indoors);
        
        // Update version footer with map count
        updateVersionFooter(data.maps.length);
        
        // Try to load saved map from localStorage, otherwise load first map (Pallet Town)
        const savedMapId = localStorage.getItem('mapViewerCurrentMap');
        let mapToLoad = null;
        
        if (savedMapId) {
            const savedMapIdNum = parseInt(savedMapId, 10);
            const savedMap = sortedMaps.find(m => m.mapId === savedMapIdNum);
            if (savedMap) {
                console.log(`📌 Restoring saved map: ${savedMap.name} (ID: ${savedMap.mapId})`);
                mapToLoad = savedMap.mapId;
            } else {
                console.warn(`⚠️ Saved map ID ${savedMapId} not found in map list`);
            }
        }
        
        // Fallback to first town if no saved map
        if (mapToLoad === null && towns.length > 0) {
            console.log(`🗺️ Loading default map: ${towns[0].name} (ID: ${towns[0].mapId})`);
            mapToLoad = towns[0].mapId;
        }
        
        if (mapToLoad !== null) {
            await loadMap(mapToLoad);
        } else {
            console.warn('⚠️ No maps available to load');
        }
        
    } catch (error) {
        console.error('💥 Failed to load map list:', error);
        showError('Failed to load map list: ' + error.message);
        document.getElementById('mapList').innerHTML = '<p style="color: #ff6b6b;">Error loading maps</p>';
    }
}

function createMapSection(container, title, maps) {
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
        item.onclick = () => loadMap(map.mapId);
        section.appendChild(item);
    });
    
    container.appendChild(section);
}

async function loadMap(mapId) {
    try {
        console.log(`🗺️ Loading map ID: ${mapId}`);
        
        // Track previous map for map 255 warps (exit to overworld)
        if (currentMap && currentMap.mapId !== mapId) {
            previousMapId = currentMap.mapId;
            console.log(`📍 Previous map tracked: ${previousMapId}`);
        }
        
        // Handle special map IDs
        if (mapId === 255 || mapId === -1 || mapId === null || mapId === undefined) {
            console.warn(`⚠️ Invalid map ID: ${mapId} (Special marker or invalid warp destination)`);
            showError(`Cannot load map ${mapId}: This is a special marker or invalid destination`);
            return;
        }
        
        // Load map data
        const mapFileName = await getMapFileName(mapId);
        const mapFile = `../output/map-data/maps/${String(mapId).padStart(3, '0')}_${mapFileName}.json`;
        console.log(`📄 Fetching map file: ${mapFile}`);
        
        const response = await fetch(mapFile);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText} for ${mapFile}`);
        }
        
        const mapData = await response.json();
        console.log(`✓ Map data loaded: ${mapData.name}`);
        console.log(`  Size: ${mapData.width}x${mapData.height} blocks`);
        console.log(`  Tileset: ${mapData.tileset} (${mapData.tilesetName})`);
        console.log(`  Block data length: ${mapData.blockData ? mapData.blockData.length : 0}`);
        
        // CRITICAL: Validate blockData exists
        if (!mapData.blockData || !Array.isArray(mapData.blockData)) {
            throw new Error(`Map ${mapData.name} has no blockData array!`);
        }
        
        // Log first few blocks for debugging
        if (mapData.blockData && mapData.blockData.length > 0) {
            const first10 = mapData.blockData.slice(0, 10);
            console.log(`  📦 First 10 blocks:`, first10.map(b => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(', '));
            console.log(`  📊 Block data stats:`);
            console.log(`    - Expected length: ${mapData.width * mapData.height}`);
            console.log(`    - Actual length: ${mapData.blockData.length}`);
            console.log(`    - Match: ${mapData.blockData.length === mapData.width * mapData.height ? '✓' : '✗'}`);
            
            // Analyze block ID distribution
            const uniqueBlocks = new Set(mapData.blockData);
            console.log(`    - Unique block IDs: ${uniqueBlocks.size}`);
            console.log(`    - Min block ID: ${Math.min(...mapData.blockData)} (0x${Math.min(...mapData.blockData).toString(16).toUpperCase().padStart(2, '0')})`);
            console.log(`    - Max block ID: ${Math.max(...mapData.blockData)} (0x${Math.max(...mapData.blockData).toString(16).toUpperCase().padStart(2, '0')})`);
        }
        
        // Log metadata if available
        if (mapData.tileMetadata) {
            console.log(`  🏷️ Tile metadata available:`);
            const summary = mapData.tileMetadata.summary;
            console.log(`    - Total tiles: ${summary.totalTiles}`);
            console.log(`    - Grass coverage: ${summary.grassCoverage}`);
            console.log(`    - Water coverage: ${summary.waterCoverage}`);
            console.log(`    - Encounter zones: ${summary.encounterZoneCount}`);
        }
        
        // Cache map data
        mapDataCache[mapId] = mapData;
        currentMap = mapData;
        
        // Save current map ID to localStorage
        localStorage.setItem('mapViewerCurrentMap', mapId);
        console.log(`💾 Saved map ${mapId} to localStorage`);
        
        // Track last overworld map (maps with connections are overworld maps)
        // Check if this map has any connections (north, south, east, or west)
        const hasConnections = mapData.connections && (
            mapData.connections.north || 
            mapData.connections.south || 
            mapData.connections.east || 
            mapData.connections.west
        );
        
        if (hasConnections) {
            lastOverworldMapId = mapData.mapId;
            console.log(`🌍 Overworld map detected: ${mapData.mapId} (${mapData.name})`);
        } else {
            console.log(`🏠 Indoor/interior map: ${mapData.mapId} (${mapData.name})`);
            console.log(`   Last overworld map: ${lastOverworldMapId}`);
        }
        
        // Load tileset if not already loaded
        if (!tilesetImages[mapData.tileset]) {
            console.log(`🖼️ Tileset ${mapData.tileset} not cached, loading...`);
            await loadTileset(mapData.tileset, mapData.tilesetName);
        } else {
            console.log(`✓ Tileset ${mapData.tileset} already cached`);
        }
        
        // Load tileset block definitions
        if (!tilesetBlockDefinitions[mapData.tileset]) {
            console.log(`🔧 Block definitions for tileset ${mapData.tileset} not cached, loading...`);
            await loadTilesetBlocks(mapData.tileset);
        } else {
            console.log(`✓ Block definitions for tileset ${mapData.tileset} already cached`);
        }
        
        // Load overworld sprite metadata if not already loaded
        if (!overworldSpriteData) {
            console.log(`📋 Loading overworld sprite metadata...`);
            try {
                await loadOverworldSpriteMetadata();
            } catch (error) {
                console.warn(`⚠️ Failed to load sprite metadata:`, error.message);
            }
        }
        
        // Preload sprites used in this map
        if (mapData.objects?.sprites?.data) {
            console.log(`👤 Preloading ${mapData.objects.sprites.data.length} sprites for this map...`);
            const spriteLoadPromises = mapData.objects.sprites.data.map(sprite => 
                loadOverworldSprite(sprite.pictureId).catch(err => {
                    console.warn(`  ⚠️ Failed to load sprite ${sprite.pictureId}:`, err);
                    return null;
                })
            );
            await Promise.all(spriteLoadPromises);
            console.log(`✅ Sprites preloaded`);
        }
        
        // Update UI
        console.log('🔄 Updating UI...');
        updateMapInfo();
        updateActiveMapItem(mapId);
        
        // Center view without changing zoom (preserve user's zoom level)
        console.log('🎨 Centering map view...');
        offsetX = 50;
        offsetY = 50;
        renderMap();
        
        console.log(`✅ Map ${mapId} loaded and rendered successfully`);
        
    } catch (error) {
        console.error(`💥 Failed to load map ${mapId}:`, error);
        showError(`Failed to load map ${mapId}: ` + error.message);
    }
}

async function getMapFileName(mapId) {
    try {
        console.log(`  📇 Getting filename for map ${mapId}...`);
        // Load map index to get proper filename
        const response = await fetch('../output/map-data/map_index.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const map = data.maps.find(m => m.mapId === mapId);
        
        if (!map) {
            console.warn(`  ⚠️ Map ${mapId} not found in index, using fallback`);
            return `Map_${mapId}`;
        }
        
        const filename = map.name.replace(/\s+/g, '_');
        console.log(`  ✓ Filename: ${filename}`);
        return filename;
    } catch (error) {
        console.error(`  ❌ Error getting filename for map ${mapId}:`, error);
        return `Map_${mapId}`;
    }
}

async function loadTileset(tilesetId, tilesetName) {
    return new Promise((resolve, reject) => {
        console.log(`  🖼️ Loading tileset ${tilesetId}: ${tilesetName}`);
        
        const img = new Image();
        const filename = `tileset_${String(tilesetId).padStart(2, '0')}_${tilesetName.replace(/\s+/g, '_')}.png`;
        const imgPath = `../output/map-data/textures/${filename}`;
        
        console.log(`  📁 Tileset path: ${imgPath}`);
        img.src = imgPath;
        
        img.onload = () => {
            tilesetImages[tilesetId] = img;
            console.log(`  ✅ Tileset loaded: ${filename} (${img.width}x${img.height})`);
            resolve();
        };
        
        img.onerror = (error) => {
            console.error(`  ❌ Failed to load tileset image: ${filename}`, error);
            reject(new Error(`Failed to load tileset image: ${filename}`));
        };
    });
}

async function loadTilesetBlocks(tilesetId) {
    if (tilesetBlockDefinitions[tilesetId]) {
        console.log(`  ✓ Tileset ${tilesetId} block definitions already cached`);
        return tilesetBlockDefinitions[tilesetId];
    }

    console.log(`  🔧 Loading block definitions for tileset ${tilesetId}...`);
    
    try {
        const response = await fetch('../output/map-data/tilesets_complete.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const tileset = data.tilesets.find(t => t.tilesetId === tilesetId);
        
        if (!tileset || !tileset.blocks) {
            throw new Error(`No block definitions found for tileset ${tilesetId}`);
        }
        
        console.log(`  ✅ Loaded ${tileset.blocks.length} block definitions for tileset ${tilesetId}`);
        tilesetBlockDefinitions[tilesetId] = tileset.blocks;
        return tileset.blocks;
    } catch (error) {
        console.error(`  ❌ Failed to load block definitions for tileset ${tilesetId}:`, error.message);
        throw error;
    }
}

// Load overworld sprite metadata
async function loadOverworldSpriteMetadata() {
    if (overworldSpriteData) {
        console.log(`  ✓ Overworld sprite metadata already loaded`);
        return overworldSpriteData;
    }
    
    console.log(`  📋 Loading overworld sprite metadata...`);
    
    try {
        const response = await fetch('../output/overworld-sprites/overworld_sprites.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        overworldSpriteData = await response.json();
        console.log(`  ✅ Loaded metadata for ${overworldSpriteData.sprites.length} sprites`);
        return overworldSpriteData;
    } catch (error) {
        console.error(`  ❌ Failed to load sprite metadata:`, error.message);
        throw error;
    }
}

// Load a single overworld sprite image
async function loadOverworldSprite(spriteId) {
    if (overworldSprites[spriteId]) {
        return overworldSprites[spriteId];
    }
    
    return new Promise((resolve, reject) => {
        // Load metadata first if not already loaded
        if (!overworldSpriteData) {
            loadOverworldSpriteMetadata()
                .then(() => loadOverworldSprite(spriteId))
                .then(resolve)
                .catch(reject);
            return;
        }
        
        // Find sprite info in metadata
        const spriteInfo = overworldSpriteData.sprites.find(s => s.id === spriteId);
        if (!spriteInfo) {
            console.warn(`  ⚠️ No metadata for sprite ID ${spriteId}`);
            resolve(null);
            return;
        }
        
        const img = new Image();
        const imgPath = `../output/overworld-sprites/${spriteInfo.filename}`;
        
        img.src = imgPath;
        
        img.onload = () => {
            overworldSprites[spriteId] = img;
            console.log(`  ✅ Loaded sprite ${spriteId}: ${spriteInfo.name} (${img.width}x${img.height})`);
            resolve(img);
        };
        
        img.onerror = (error) => {
            console.warn(`  ⚠️ Failed to load sprite ${spriteId}: ${spriteInfo.filename}`, error);
            overworldSprites[spriteId] = null;
            resolve(null);
        };
    });
}

function updateMapInfo() {
    if (!currentMap) return;
    
    // Safely update elements if they exist
    const mapNameEl = document.getElementById('mapName');
    const mapIdEl = document.getElementById('mapId');
    const mapSizeEl = document.getElementById('mapSize');
    const tilesetNameEl = document.getElementById('tilesetName');
    
    if (mapNameEl) mapNameEl.textContent = currentMap.name;
    if (mapIdEl) mapIdEl.textContent = currentMap.mapId;
    if (mapSizeEl) mapSizeEl.textContent = `${currentMap.width}x${currentMap.height} blocks`;
    if (tilesetNameEl) tilesetNameEl.textContent = currentMap.tilesetName;
    
    // Update zoom level display
    const zoomLevelEl = document.getElementById('zoomLevel');
    if (zoomLevelEl) zoomLevelEl.textContent = `${scale}x`;
}

function updateZoomDisplay() {
    const zoomLevelEl = document.getElementById('zoomLevel');
    if (zoomLevelEl) zoomLevelEl.textContent = `${scale}x`;
}

function updateActiveMapItem(mapId) {
    // Remove active class from all items
    document.querySelectorAll('.map-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to current item
    document.querySelectorAll('.map-item').forEach(item => {
        if (item.textContent.startsWith(String(mapId).padStart(3, '0'))) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
}

function renderMap() {
    if (!currentMap || !tilesetImages[currentMap.tileset]) {
        console.warn('⚠️ Cannot render: missing map or tileset');
        if (!currentMap) console.warn('  - currentMap is null');
        if (currentMap && !tilesetImages[currentMap.tileset]) {
            console.warn(`  - tileset ${currentMap.tileset} not loaded`);
        }
        return;
    }
    
    console.log('🎨 Rendering map...');
    
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const tilesetImg = tilesetImages[currentMap.tileset];
    const mapWidthPixels = currentMap.width * BLOCK_SIZE * TILE_SIZE;
    const mapHeightPixels = currentMap.height * BLOCK_SIZE * TILE_SIZE;
    
    console.log(`  Map size: ${mapWidthPixels}x${mapHeightPixels} pixels`);
    console.log(`  Canvas size: ${canvas.width}x${canvas.height} pixels`);
    console.log(`  Scale: ${scale}x, Offset: (${offsetX}, ${offsetY})`);
    
    // Helper function to draw object indicator at exact tile position
    function drawObjectIndicator(mapTileX, mapTileY, letter, color, objRomX, objRomY) {
        // ROM coords are in 2-TILE units (metatiles / 16×16 pixels)
        // Convert to single tile coordinates by multiplying by 2
        const tileX = mapTileX * 2;
        const tileY = mapTileY * 2;
        
        // Calculate screen pixel position for 2×2 tile area
        const screenX = offsetX + tileX * TILE_SIZE * scale;
        const screenY = offsetY + tileY * TILE_SIZE * scale;
        const metatileSize = 2 * TILE_SIZE * scale; // 2×2 tiles = 16×16 pixels
        
        // Draw semi-transparent colored background over 2×2 tile area
        ctx.fillStyle = color;
        ctx.fillRect(screenX, screenY, metatileSize, metatileSize);
        
        // Draw letter indicator (centered in 2×2 area)
        const fontSize = Math.max(12, Math.min(20, metatileSize * 0.4));
        ctx.font = `bold ${fontSize}px "Courier New"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = Math.max(3, scale * 0.8);
        ctx.strokeText(letter, screenX + metatileSize / 2, screenY + metatileSize / 2);
        
        ctx.fillStyle = '#fff';
        ctx.fillText(letter, screenX + metatileSize / 2, screenY + metatileSize / 2);
        
        // Draw coordinate label (ROM coords)
        const coordFontSize = Math.max(7, Math.min(11, metatileSize * 0.25));
        ctx.font = `${coordFontSize}px "Courier New"`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        
        const coordText = `${objRomX}:${objRomY}`;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = Math.max(2, scale * 0.4);
        ctx.strokeText(coordText, screenX + metatileSize - 2, screenY + metatileSize - 2);
        
        ctx.fillStyle = '#fff';
        ctx.fillText(coordText, screenX + metatileSize - 2, screenY + metatileSize - 2);
        
        // Draw metadata icons if available (top-left area)
        const blockX = Math.floor(tileX / BLOCK_SIZE);
        const blockY = Math.floor(tileY / BLOCK_SIZE);
        
        if (currentMap.tileMetadata) {
            const iconFontSize = Math.max(8, Math.min(14, metatileSize * 0.25));
            ctx.font = `${iconFontSize}px Arial`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            let iconText = '';
            
            // Check if this block is in a grass zone
            if (currentMap.tileMetadata.grassZones) {
                const isGrass = currentMap.tileMetadata.grassZones.some(zone => 
                    zone.tiles && zone.tiles.some(tile => tile.x === blockX && tile.y === blockY)
                );
                if (isGrass) iconText += '🌱';
            }
            
            // Check if this block is in a water area
            if (currentMap.tileMetadata.waterAreas) {
                const isWater = currentMap.tileMetadata.waterAreas.some(area => 
                    area.tiles && area.tiles.some(tile => tile.x === blockX && tile.y === blockY)
                );
                if (isWater) iconText += '💧';
            }
            
            if (iconText) {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                
                ctx.fillStyle = '#fff';
                ctx.fillText(iconText, screenX + 3, screenY + 3);
                
                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }
        }
    }
    
    // Calculate visible area
    const startX = Math.max(0, Math.floor(-offsetX / (BLOCK_SIZE * TILE_SIZE * scale)));
    const startY = Math.max(0, Math.floor(-offsetY / (BLOCK_SIZE * TILE_SIZE * scale)));
    const endX = Math.min(currentMap.width, Math.ceil((canvas.width - offsetX) / (BLOCK_SIZE * TILE_SIZE * scale)) + 1);
    const endY = Math.min(currentMap.height, Math.ceil((canvas.height - offsetY) / (BLOCK_SIZE * TILE_SIZE * scale)) + 1);
    
    console.log(`  Visible blocks: (${startX},${startY}) to (${endX},${endY})`);
    
    let blocksRendered = 0;
    const blockSample = []; // Sample of first few blocks for debugging
    
    // Render each block
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const blockIndex = y * currentMap.width + x;
            if (blockIndex >= currentMap.blockData.length) {
                console.warn(`  ⚠️ Block index ${blockIndex} out of bounds (max: ${currentMap.blockData.length})`);
                continue;
            }
            
            const blockId = currentMap.blockData[blockIndex];
            const blockDefinitions = tilesetBlockDefinitions[currentMap.tileset];
            
            // Log first few blocks for debugging
            if (blocksRendered < 5) {
                blockSample.push({
                    position: `(${x},${y})`,
                    index: blockIndex,
                    blockId: blockId,
                    blockIdHex: `0x${blockId.toString(16).toUpperCase().padStart(2, '0')}`
                });
            }
            
            if (!blockDefinitions || blockId >= blockDefinitions.length) {
                console.warn(`  ⚠️ No block definition for blockId ${blockId}`);
                continue;
            }
            
            // Get the 16 tile IDs that make up this block (4x4 grid)
            const blockDef = blockDefinitions[blockId];
            
            // Log detailed tile info for first few
            if (blocksRendered < 3) {
                console.log(`  🎨 Block ${blocksRendered}: pos=(${x},${y}) blockId=${blockId}(0x${blockId.toString(16).toUpperCase().padStart(2, '0')}) tiles=[${blockDef.slice(0, 4).join(',')}...]`);
            }
            
            // Render the 4x4 tile grid that makes up this block
            for (let tileY = 0; tileY < BLOCK_SIZE; tileY++) {
                for (let tileX = 0; tileX < BLOCK_SIZE; tileX++) {
                    const tileIndex = tileY * BLOCK_SIZE + tileX;
                    const tileId = blockDef[tileIndex];
                    
                    // Calculate position in tileset (16 tiles per row, 128x128 pixel image)
                    const tilesPerRow = 16;
                    const srcX = (tileId % tilesPerRow) * TILE_SIZE;
                    const srcY = Math.floor(tileId / tilesPerRow) * TILE_SIZE;
                    
                    // Calculate screen position
                    const screenX = offsetX + (x * BLOCK_SIZE + tileX) * TILE_SIZE * scale;
                    const screenY = offsetY + (y * BLOCK_SIZE + tileY) * TILE_SIZE * scale;
                    const tileSize = TILE_SIZE * scale;
                    
                    // Draw the tile
                    try {
                        ctx.drawImage(
                            tilesetImg,
                            srcX, srcY, TILE_SIZE, TILE_SIZE,
                            screenX, screenY, tileSize, tileSize
                        );
                    } catch (error) {
                        console.error(`  ❌ Error drawing tile at (${x},${y}) tile ${tileX},${tileY}:`, error);
                    }
                }
            }
            
            // Draw block coordinates for debugging (when zoomed in enough and if enabled)
            if (scale >= 2 && showCoordLabels) {
                const screenX = offsetX + x * BLOCK_SIZE * TILE_SIZE * scale;
                const screenY = offsetY + y * BLOCK_SIZE * TILE_SIZE * scale;
                const blockSize = BLOCK_SIZE * TILE_SIZE * scale;
                
                const coordFontSize = Math.max(7, Math.min(10, blockSize * 0.2));
                ctx.font = `${coordFontSize}px "Courier New"`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                
                // Show block coords directly (no border offset)
                const coordText = `${x},${y}`;
                
                // Draw with outline for visibility
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeText(coordText, screenX + 2, screenY + 2);
                
                ctx.fillStyle = '#ffff00';  // Yellow for visibility
                ctx.fillText(coordText, screenX + 2, screenY + 2);
            }
            
            blocksRendered++;
        }
    }
    
    console.log(`  ✓ Rendered ${blocksRendered} blocks`);
    console.log(`  📊 Block sample (first 5):`, blockSample);
    console.log(`  📏 Block ID range in map: min=${Math.min(...currentMap.blockData)}, max=${Math.max(...currentMap.blockData)}`);
    console.log(`  🗺️ Current map: ${currentMap.name} (${currentMap.mapId})`);
    console.log(`  🖼️ Tileset: ${currentMap.tilesetName} (ID: ${currentMap.tileset}, Size: ${tilesetImg.width}x${tilesetImg.height})`);
    
    // Draw sprites ALWAYS (not affected by overlay toggle)
    if (currentMap.objects?.sprites?.data) {
        console.log(`  🧍 Drawing overworld sprites...`);
        for (const sprite of currentMap.objects.sprites.data) {
            // ROM uses 1-based sprite IDs (1-72), our metadata uses 0-based (0-71)
            // So pictureId 1 (RED in ROM) = sprite file 000_RED.png (id: 0)
            const spriteFileId = sprite.pictureId - 1;
            
            // Skip invalid sprite IDs (like 255 = unused/disabled sprites)
            if (spriteFileId > 71 || spriteFileId < 0) {
                console.log(`  ⚠️ Skipping invalid sprite pictureId ${sprite.pictureId} at (${sprite.x}, ${sprite.y})`);
                continue;
            }
            
            const spriteImg = overworldSprites[spriteFileId];
            
            if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
                // Draw actual sprite image
                // Sprite image is 48x16 (3 frames: down, up, left at 16x16 each)
                // Use the first frame (down) for now
                const tileX = sprite.x * 2;
                const tileY = sprite.y * 2;
                const screenX = offsetX + tileX * TILE_SIZE * scale;
                const screenY = offsetY + tileY * TILE_SIZE * scale;
                const spriteSize = 2 * TILE_SIZE * scale; // 16x16 pixels scaled
                
                // Draw the sprite (first frame from sprite sheet)
                ctx.drawImage(
                    spriteImg,
                    0, 0, 16, 16,  // Source: first frame (down direction)
                    screenX, screenY, spriteSize, spriteSize  // Destination
                );
                
                // Draw indicator overlay on top of sprite if overlays are enabled
                if (showOverlays) {
                    drawObjectIndicator(sprite.x, sprite.y, 'N', 'rgba(50, 255, 50, 0.36)', sprite.x, sprite.y);
                }
            } else {
                // Fallback to indicator if sprite not loaded
                drawObjectIndicator(sprite.x, sprite.y, 'N', 'rgba(50, 255, 50, 0.36)', sprite.x, sprite.y);
                
                // Try to load the sprite asynchronously
                if (!overworldSprites[spriteFileId]) {
                    loadOverworldSprite(spriteFileId).then(() => {
                        // Re-render once sprite is loaded
                        if (overworldSprites[spriteFileId]) {
                            renderMap();
                        }
                    });
                }
            }
        }
        console.log(`  ✅ Drew ${currentMap.objects.sprites.data.length} sprites`);
    }
    
    // Draw object overlays AFTER all tiles (ROM coords are already in tile units)
    if (showOverlays && currentMap.objects) {
        console.log(`  📍 Drawing object overlays...`);
        
        // Draw warps - ROM coords are TILE coordinates (not 4-pixel units!)
        if (currentMap.objects.warps?.data) {
            currentMap.objects.warps.data.forEach(warp => {
                // ROM coords are already in tile units, use directly
                drawObjectIndicator(warp.x, warp.y, 'W', 'rgba(255, 50, 50, 0.36)', warp.x, warp.y);
            });
            console.log(`  ✅ Drew ${currentMap.objects.warps.data.length} warps`);
        }
        
        // Draw signs
        if (currentMap.objects.signs?.data) {
            currentMap.objects.signs.data.forEach(sign => {
                drawObjectIndicator(sign.x, sign.y, 'S', 'rgba(50, 150, 255, 0.36)', sign.x, sign.y);
            });
            console.log(`  ✅ Drew ${currentMap.objects.signs.data.length} signs`);
        }
    }
    
    // Draw map connections (visualize where map boundaries connect to other maps)
    if (showOverlays && currentMap.connections) {
        console.log(`  🧭 Drawing map connections...`);
        
        const connectionColor = 'rgba(255, 140, 0, 0.8)'; // Orange
        const connectionWidth = TILE_SIZE * scale; // One tile width
        const mapWidthScreen = currentMap.width * BLOCK_SIZE * TILE_SIZE * scale;
        const mapHeightScreen = currentMap.height * BLOCK_SIZE * TILE_SIZE * scale;
        
        // North connection (top edge)
        if (currentMap.connections.north) {
            const x = offsetX;
            const y = offsetY;
            const width = mapWidthScreen;
            
            // Draw single-tile-width orange line along the boundary
            ctx.fillStyle = connectionColor;
            ctx.fillRect(x, y, width, connectionWidth);
            
            console.log(`  ⬆️ North connection visualized`);
        }
        
        // South connection (bottom edge)
        if (currentMap.connections.south) {
            const x = offsetX;
            const y = offsetY + mapHeightScreen - connectionWidth;
            const width = mapWidthScreen;
            
            // Draw single-tile-width orange line along the boundary
            ctx.fillStyle = connectionColor;
            ctx.fillRect(x, y, width, connectionWidth);
            
            console.log(`  ⬇️ South connection visualized`);
        }
        
        // West connection (left edge)
        if (currentMap.connections.west) {
            const x = offsetX;
            const y = offsetY;
            const height = mapHeightScreen;
            
            // Draw single-tile-width orange line along the boundary
            ctx.fillStyle = connectionColor;
            ctx.fillRect(x, y, connectionWidth, height);
            
            console.log(`  ⬅️ West connection visualized`);
        }
        
        // East connection (right edge)
        if (currentMap.connections.east) {
            const x = offsetX + mapWidthScreen - connectionWidth;
            const y = offsetY;
            const height = mapHeightScreen;
            
            // Draw single-tile-width orange line along the boundary
            ctx.fillStyle = connectionColor;
            ctx.fillRect(x, y, connectionWidth, height);
            
            console.log(`  ➡️ East connection visualized`);
        }
    }
    
    // Draw grid (optional)
    if (showGrid && scale >= 2) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        
        for (let x = startX; x <= endX; x++) {
            const screenX = offsetX + x * BLOCK_SIZE * TILE_SIZE * scale;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, canvas.height);
            ctx.stroke();
        }
        
        for (let y = startY; y <= endY; y++) {
            const screenY = offsetY + y * BLOCK_SIZE * TILE_SIZE * scale;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(canvas.width, screenY);
            ctx.stroke();
        }
    }
    
    // Draw hovered tile highlight (individual tile, not whole block!)
    if (hoveredTile) {
        // Calculate screen position of the specific tile
        const screenX = offsetX + hoveredTile.worldTileX * TILE_SIZE * scale;
        const screenY = offsetY + hoveredTile.worldTileY * TILE_SIZE * scale;
        const tileSize = TILE_SIZE * scale;
        
        // Draw bright border around hovered tile
        ctx.strokeStyle = '#00ffff';  // Cyan
        ctx.lineWidth = Math.max(2, scale * 0.8);
        ctx.strokeRect(screenX, screenY, tileSize, tileSize);
        
        // Draw inner border for double-line effect
        const inset = Math.max(1, scale * 0.3);
        ctx.strokeStyle = '#ffffff';  // White
        ctx.lineWidth = Math.max(1, scale * 0.4);
        ctx.strokeRect(screenX + inset, screenY + inset, tileSize - inset * 2, tileSize - inset * 2);
    }
}

// Old renderOverlays function - NO LONGER USED
// Overlays are now rendered inline during block rendering for perfect alignment
// This ensures overlays match block positions exactly and scale properly






