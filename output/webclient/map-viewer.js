// Pokemon Red Map Viewer
// Renders maps using extracted map data and tileset textures

// Version information
const MAP_VIEWER_VERSION = '2.1.1';
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
let canvas, ctx;
let scale = 2;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let showOverlays = true; // Toggle for warp/script/sign/sprite indicators
let showCoordLabels = false; // Toggle for coordinate labels on blocks (default: off)
let hoveredTile = null; // Track hovered tile for highlighting {blockX, blockY, tileX, tileY, tileIndex, screenX, screenY}

// Error handling
function showError(message) {
    console.error('❌ Error:', message);
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 5000);
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
        renderMap();
    }
}
window.zoomOut = zoomOut;

function resetView() {
    scale = 2;
    offsetX = 50;
    offsetY = 50;
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
    
    if (sidebar.classList.contains('hidden')) {
        toggleBtn.classList.remove('sidebar-visible');
        toggleBtn.textContent = '☰';
    } else {
        toggleBtn.classList.add('sidebar-visible');
        toggleBtn.textContent = '✕';
    }
    
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
    console.log('📌 DOM already ready, will initialize via manual trigger');
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
            const screenBlockX = Math.floor(worldTileX / BLOCK_SIZE);
            const screenBlockY = Math.floor(worldTileY / BLOCK_SIZE);
            const mapBlockX = screenBlockX - 1;  // Account for border
            const mapBlockY = screenBlockY - 1;
            
            // Calculate which tile within the block (0-15, in 4x4 grid)
            const tileXInBlock = worldTileX % BLOCK_SIZE;
            const tileYInBlock = worldTileY % BLOCK_SIZE;
            const tileIndexInBlock = tileYInBlock * BLOCK_SIZE + tileXInBlock;
            
            // Check if within map bounds
            if (screenBlockX >= 0 && screenBlockX < currentMap.width && 
                screenBlockY >= 0 && screenBlockY < currentMap.height) {
                
                // Update hovered tile and re-render if changed
                const newHovered = {
                    blockX: screenBlockX, 
                    blockY: screenBlockY,
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
                
                showTileTooltip(e.clientX, e.clientY, screenBlockX, screenBlockY, mapBlockX, mapBlockY, 
                                tileXInBlock, tileYInBlock, tileIndexInBlock);
                
                // Check if hovering over a warp to change cursor
                if (showOverlays && currentMap.objects) {
                    const isOverWarp = currentMap.objects.warps?.data?.some(warp => 
                        warp.x === mapBlockX && warp.y === mapBlockY
                    );
                    canvas.style.cursor = isOverWarp ? 'pointer' : 'grab';
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
function showTileTooltip(mouseX, mouseY, screenBlockX, screenBlockY, mapBlockX, mapBlockY, tileX, tileY, tileIndex) {
    const tooltip = document.getElementById('tileTooltip');
    if (!tooltip || !currentMap) return;
    
    // Get block data
    const blockIndex = screenBlockY * currentMap.width + screenBlockX;
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
    content += `Screen Block: (${screenBlockX}, ${screenBlockY})<br>`;
    content += `Map Block: (${mapBlockX}, ${mapBlockY})<br>`;
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
    // Objects use TILE coordinates, same as our map tile system
    if (currentMap.objects) {
        let hasObjects = false;
        let objectsInfo = `<div style="border-top: 1px solid #4ecdc4; margin-top: 4px; padding-top: 4px;">`;
        objectsInfo += `<span style="color: #4ecdc4;">Objects:</span><br>`;
        
        // Map tile coordinates can be used directly to match ROM coords
        const mapTileX = mapBlockX * BLOCK_SIZE;
        const mapTileY = mapBlockY * BLOCK_SIZE;
        
        const warp = currentMap.objects.warps?.data?.find(w => w.x === mapTileX && w.y === mapTileY);
        if (warp) {
            hasObjects = true;
            objectsInfo += `🚪 Warp → Map ${warp.mapId} (at tile ${warp.x},${warp.y})<br>`;
        }
        
        const sign = currentMap.objects.signs?.data?.find(s => s.x === mapTileX && s.y === mapTileY);
        if (sign) {
            hasObjects = true;
            objectsInfo += `📋 Sign (Text ${sign.textId}) (at tile ${sign.x},${sign.y})<br>`;
        }
        
        const sprite = currentMap.objects.sprites?.data?.find(s => s.x === mapTileX && s.y === mapTileY);
        if (sprite) {
            hasObjects = true;
            objectsInfo += `👤 ${sprite.type} (Pic ${sprite.pictureId}) (at tile ${sprite.x},${sprite.y})<br>`;
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
    
    // Convert canvas coordinates to map TILE coordinates
    // ROM object coordinates are in TILE units relative to map origin
    const worldTileX = Math.floor((canvasX - offsetX) / (TILE_SIZE * scale));
    const worldTileY = Math.floor((canvasY - offsetY) / (TILE_SIZE * scale));
    const mapTileX = worldTileX - BLOCK_SIZE;  // Subtract border (4 tiles)
    const mapTileY = worldTileY - BLOCK_SIZE;
    
    console.log(`🖱️ Clicked at map tile (${mapTileX}, ${mapTileY})`);
    
    // Check if we clicked on a warp (ROM coords are tile coordinates)
    if (currentMap.objects.warps && currentMap.objects.warps.data) {
        const clickedWarp = currentMap.objects.warps.data.find(warp => 
            warp.x === mapTileX && warp.y === mapTileY
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
        }
    }
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

async function loadMapList() {
    try {
        console.log('📑 Fetching map index from ../map-data/map_index.json');
        const response = await fetch('../map-data/map_index.json');
        
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
        
        // Load first map (Pallet Town)
        if (towns.length > 0) {
            console.log(`🗺️ Loading first map: ${towns[0].name} (ID: ${towns[0].mapId})`);
            await loadMap(towns[0].mapId);
        } else {
            console.warn('⚠️ No towns found to load');
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
        const mapFile = `../map-data/maps/${String(mapId).padStart(3, '0')}_${mapFileName}.json`;
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
        
        // Update UI
        console.log('🔄 Updating UI...');
        updateMapInfo();
        updateActiveMapItem(mapId);
        
        // Reset view and render
        console.log('🎨 Rendering map...');
        resetView();
        
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
        const response = await fetch('../map-data/map_index.json');
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
        const imgPath = `../map-data/textures/${filename}`;
        
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
        const response = await fetch('../map-data/tilesets_complete.json');
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

function updateMapInfo() {
    if (!currentMap) return;
    
    document.getElementById('mapName').textContent = currentMap.name;
    document.getElementById('mapId').textContent = currentMap.mapId;
    document.getElementById('mapSize').textContent = `${currentMap.width}x${currentMap.height} blocks`;
    document.getElementById('mapTileset').textContent = currentMap.tilesetName;
    
    // Update metadata if available
    if (currentMap.tileMetadata) {
        const metadataInfo = document.getElementById('metadataInfo');
        metadataInfo.style.display = 'block';
        
        const content = document.getElementById('metadataContent');
        const summary = currentMap.tileMetadata.summary;
        
        content.innerHTML = `
            <div class="info-row">Total Tiles: ${summary.totalTiles}</div>
            <div class="info-row">Grass Coverage: ${summary.grassCoverage}</div>
            <div class="info-row">Water Coverage: ${summary.waterCoverage}</div>
            <div class="info-row">Walkable: ${summary.walkableCoverage}</div>
            <div class="info-row">Grass Zones: ${summary.encounterZoneCount}</div>
            <div class="info-row">Water Areas: ${summary.surfableAreaCount}</div>
            <div class="info-row">Warp Tiles: ${currentMap.tileMetadata.warpTileCount}</div>
            <div class="info-row">Ledges: ${currentMap.tileMetadata.ledgeTileCount}</div>
        `;
    } else {
        document.getElementById('metadataInfo').style.display = 'none';
    }
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
        // ROM coords are in TILE units relative to map origin (no border)
        // Add border offset to get screen tile position
        const screenTileX = mapTileX + BLOCK_SIZE;  // Add 4-tile border
        const screenTileY = mapTileY + BLOCK_SIZE;
        
        // Calculate screen pixel position
        const screenX = offsetX + screenTileX * TILE_SIZE * scale;
        const screenY = offsetY + screenTileY * TILE_SIZE * scale;
        const indicatorSize = TILE_SIZE * scale;
        
        // Draw semi-transparent colored background
        ctx.fillStyle = color;
        ctx.fillRect(screenX, screenY, indicatorSize, indicatorSize);
        
        // Draw letter indicator
        const fontSize = Math.max(8, Math.min(14, indicatorSize * 0.6));
        ctx.font = `bold ${fontSize}px "Courier New"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = Math.max(2, scale * 0.5);
        ctx.strokeText(letter, screenX + indicatorSize / 2, screenY + indicatorSize / 2);
        
        ctx.fillStyle = '#fff';
        ctx.fillText(letter, screenX + indicatorSize / 2, screenY + indicatorSize / 2);
        
        // Draw coordinate label
        const coordFontSize = Math.max(6, Math.min(9, indicatorSize * 0.4));
        ctx.font = `${coordFontSize}px "Courier New"`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        
        const coordText = `${objRomX}:${objRomY}`;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = Math.max(1, scale * 0.3);
        ctx.strokeText(coordText, screenX + indicatorSize - 1, screenY + indicatorSize - 1);
        
        ctx.fillStyle = '#fff';
        ctx.fillText(coordText, screenX + indicatorSize - 1, screenY + indicatorSize - 1);
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
                
                // Show screen block coords (x,y) and map coords (x-1, y-1)
                const mapBlockX = x - 1;
                const mapBlockY = y - 1;
                const coordText = `${x},${y}`;
                const mapCoordText = `(${mapBlockX},${mapBlockY})`;
                
                // Draw with outline for visibility
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeText(coordText, screenX + 2, screenY + 2);
                ctx.strokeText(mapCoordText, screenX + 2, screenY + 2 + coordFontSize + 1);
                
                ctx.fillStyle = '#ffff00';  // Yellow for visibility
                ctx.fillText(coordText, screenX + 2, screenY + 2);
                ctx.fillStyle = '#00ffff';  // Cyan for map coords
                ctx.fillText(mapCoordText, screenX + 2, screenY + 2 + coordFontSize + 1);
            }
            
            blocksRendered++;
        }
    }
    
    console.log(`  ✓ Rendered ${blocksRendered} blocks`);
    console.log(`  📊 Block sample (first 5):`, blockSample);
    console.log(`  📏 Block ID range in map: min=${Math.min(...currentMap.blockData)}, max=${Math.max(...currentMap.blockData)}`);
    console.log(`  🗺️ Current map: ${currentMap.name} (${currentMap.mapId})`);
    console.log(`  🖼️ Tileset: ${currentMap.tilesetName} (ID: ${currentMap.tileset}, Size: ${tilesetImg.width}x${tilesetImg.height})`);
    
    // Draw object indicators AFTER all tiles (ROM coords are already in tile units)
    if (showOverlays && currentMap.objects) {
        console.log(`  📍 Drawing object overlays...`);
        
        // Draw warps - ROM coords are TILE coordinates (not 4-pixel units!)
        if (currentMap.objects.warps?.data) {
            currentMap.objects.warps.data.forEach(warp => {
                // ROM coords are already in tile units, use directly
                drawObjectIndicator(warp.x, warp.y, 'W', 'rgba(255, 50, 50, 0.6)', warp.x, warp.y);
            });
            console.log(`  ✅ Drew ${currentMap.objects.warps.data.length} warps`);
        }
        
        // Draw signs
        if (currentMap.objects.signs?.data) {
            currentMap.objects.signs.data.forEach(sign => {
                drawObjectIndicator(sign.x, sign.y, 'S', 'rgba(50, 150, 255, 0.6)', sign.x, sign.y);
            });
            console.log(`  ✅ Drew ${currentMap.objects.signs.data.length} signs`);
        }
        
        // Draw sprites
        if (currentMap.objects.sprites?.data) {
            currentMap.objects.sprites.data.forEach(sprite => {
                drawObjectIndicator(sprite.x, sprite.y, 'N', 'rgba(50, 255, 50, 0.6)', sprite.x, sprite.y);
            });
            console.log(`  ✅ Drew ${currentMap.objects.sprites.data.length} sprites`);
        }
    }
    
    // Draw map connections (visualize where map boundaries connect to other maps)
    if (showOverlays && currentMap.connections) {
        console.log(`  🧭 Drawing map connections...`);
        
        const borderWidth = BLOCK_SIZE * TILE_SIZE * scale; // 4 tiles = 32px * scale
        const arrowSize = Math.max(16, scale * 8);
        const connectionColor = 'rgba(255, 200, 0, 0.7)'; // Gold/yellow
        const mapWidthScreen = currentMap.width * BLOCK_SIZE * TILE_SIZE * scale;
        const mapHeightScreen = currentMap.height * BLOCK_SIZE * TILE_SIZE * scale;
        
        // North connection (top edge)
        if (currentMap.connections.north) {
            const x = offsetX + borderWidth;
            const y = offsetY + borderWidth;
            const width = mapWidthScreen;
            
            // Draw connection indicator bar
            ctx.fillStyle = connectionColor;
            ctx.fillRect(x, y - 4, width, 4);
            
            // Draw arrows
            for (let i = 0; i < 5; i++) {
                const arrowX = x + (width / 6) * (i + 1);
                ctx.fillStyle = connectionColor;
                ctx.beginPath();
                ctx.moveTo(arrowX, y - 8);
                ctx.lineTo(arrowX - arrowSize/2, y - 8 - arrowSize);
                ctx.lineTo(arrowX + arrowSize/2, y - 8 - arrowSize);
                ctx.closePath();
                ctx.fill();
            }
            
            console.log(`  ⬆️ North connection visualized`);
        }
        
        // South connection (bottom edge)
        if (currentMap.connections.south) {
            const x = offsetX + borderWidth;
            const y = offsetY + borderWidth + mapHeightScreen;
            const width = mapWidthScreen;
            
            // Draw connection indicator bar
            ctx.fillStyle = connectionColor;
            ctx.fillRect(x, y, width, 4);
            
            // Draw arrows
            for (let i = 0; i < 5; i++) {
                const arrowX = x + (width / 6) * (i + 1);
                ctx.fillStyle = connectionColor;
                ctx.beginPath();
                ctx.moveTo(arrowX, y + 8);
                ctx.lineTo(arrowX - arrowSize/2, y + 8 + arrowSize);
                ctx.lineTo(arrowX + arrowSize/2, y + 8 + arrowSize);
                ctx.closePath();
                ctx.fill();
            }
            
            console.log(`  ⬇️ South connection visualized`);
        }
        
        // West connection (left edge)
        if (currentMap.connections.west) {
            const x = offsetX + borderWidth;
            const y = offsetY + borderWidth;
            const height = mapHeightScreen;
            
            // Draw connection indicator bar
            ctx.fillStyle = connectionColor;
            ctx.fillRect(x - 4, y, 4, height);
            
            // Draw arrows
            for (let i = 0; i < 5; i++) {
                const arrowY = y + (height / 6) * (i + 1);
                ctx.fillStyle = connectionColor;
                ctx.beginPath();
                ctx.moveTo(x - 8, arrowY);
                ctx.lineTo(x - 8 - arrowSize, arrowY - arrowSize/2);
                ctx.lineTo(x - 8 - arrowSize, arrowY + arrowSize/2);
                ctx.closePath();
                ctx.fill();
            }
            
            console.log(`  ⬅️ West connection visualized`);
        }
        
        // East connection (right edge)
        if (currentMap.connections.east) {
            const x = offsetX + borderWidth + mapWidthScreen;
            const y = offsetY + borderWidth;
            const height = mapHeightScreen;
            
            // Draw connection indicator bar
            ctx.fillStyle = connectionColor;
            ctx.fillRect(x, y, 4, height);
            
            // Draw arrows
            for (let i = 0; i < 5; i++) {
                const arrowY = y + (height / 6) * (i + 1);
                ctx.fillStyle = connectionColor;
                ctx.beginPath();
                ctx.moveTo(x + 8, arrowY);
                ctx.lineTo(x + 8 + arrowSize, arrowY - arrowSize/2);
                ctx.lineTo(x + 8 + arrowSize, arrowY + arrowSize/2);
                ctx.closePath();
                ctx.fill();
            }
            
            console.log(`  ➡️ East connection visualized`);
        }
    }
    
    // Draw grid (optional)
    if (scale >= 4) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
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

