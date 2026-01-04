/**
 * Pokemon Red Map Viewer - Main Entry Point
 * Initializes the application and bootstraps the MapViewer
 */

import { MapViewer } from './core/MapViewer.js';
import { UIBuilder } from './ui/UIBuilder.js';

// Cache buster for development - forces fresh module loads
const CACHE_BUSTER = Date.now();

// Store cache buster globally for module imports
window.MODULE_CACHE_BUSTER = CACHE_BUSTER;

console.log('🔄 Cache Buster:', CACHE_BUSTER);

/**
 * Build the application UI dynamically
 * @param {string} mode - Application mode: 'map-viewer' or 'game'
 */
function buildUI(mode = 'map-viewer') {
    console.log('🎨 Building UI for mode:', mode);
    
    const app = document.getElementById('app');
    
    // Create main container
    const container = document.createElement('div');
    container.id = 'container';
    
    // In game mode, only create canvas
    if (mode === 'game') {
        const canvas = document.createElement('canvas');
        canvas.id = 'mapCanvas';
        container.appendChild(canvas);
        app.appendChild(container);
        
        // Add loading spinner
        const loadingEl = document.getElementById('loading');
        if (!loadingEl) {
            app.appendChild(UIBuilder.buildLoadingSpinner());
        }
        
        // Add version footer with town navigation for game mode
        app.appendChild(UIBuilder.buildVersionFooter(true));
        
        console.log('✅ Game UI built successfully');
        return;
    }
    
    // Map-viewer mode: Build full UI
    const sidebarToggle = UIBuilder.buildSidebarToggle(null); // Handler will be set later
    const sidebar = UIBuilder.buildSidebar({}); // Handlers will be set by MapViewer
    const canvas = document.createElement('canvas');
    canvas.id = 'mapCanvas';
    
    container.appendChild(sidebarToggle);
    container.appendChild(sidebar);
    container.appendChild(canvas);
    
    // Append to app
    app.appendChild(container);
    
    // Add loading spinner
    app.appendChild(UIBuilder.buildLoadingSpinner());
    
    // Add tile tooltip
    app.appendChild(UIBuilder.buildTileTooltip());
    
    // Add error toast
    app.appendChild(UIBuilder.buildErrorToast());
    
    // Add NPC modal
    app.appendChild(UIBuilder.buildNPCModal());
    
    // Add version footer
    app.appendChild(UIBuilder.buildVersionFooter());
    
    console.log('✅ UI built successfully');
}

/**
 * Initialize the Map Viewer application
 * @param {string} mode - Application mode: 'map-viewer' or 'game'
 */
async function initMapViewer(mode = 'map-viewer') {
    try {
        console.log('🎮 Initializing Pokemon Red Map Viewer...');
        console.log('📋 Mode:', mode);
        
        // Build UI first
        buildUI(mode);
        
        const viewer = new MapViewer('mapCanvas', mode);
        await viewer.init();
        
        // Expose to window for debugging and external access
        window.mapViewer = viewer;
        
        // Log module versions
        console.log('📦 Module Versions:', viewer.getModuleVersions());
        
        // Start memory and cache monitoring
        startMemoryMonitor(viewer);
        
        console.log('✅ Map Viewer initialized successfully');
        
    } catch (error) {
        console.error('❌ Fatal error initializing Map Viewer:', error);
        alert('Failed to initialize Map Viewer: ' + error.message);
    }
}

/**
 * Memory and cache monitoring for performance tracking
 * Updates browser title with memory and cache statistics
 */
function startMemoryMonitor(viewer) {
    function updateTitle() {
        let memoryInfo = '';
        let cacheInfo = '';
        
        // Get memory usage if available (Chrome/Edge)
        if (performance.memory) {
            const usedMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
            const totalMB = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1);
            const usedPercent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(0);
            memoryInfo = `Mem: ${usedMB}/${totalMB}MB (${usedPercent}%)`;
        }
        
        // Estimate cache usage from loaded resources
        if (viewer) {
            const spriteCount = Object.keys(viewer.spriteManager?.spriteImages || {}).length;
            const tilesetCount = Object.keys(viewer.tilesetManager?.tilesetImages || {}).length;
            const blockDefCount = Object.keys(viewer.tilesetManager?.tilesetBlockDefinitions || {}).length;
            const mapCount = viewer.mapState?.currentMap ? 1 : 0;
            
            // Calculate approximate cache size in MB
            let cacheSizeBytes = 0;
            
            // Sprites: ~48x16 RGBA = ~3KB per sprite
            cacheSizeBytes += spriteCount * 48 * 16 * 4;
            
            // Tilesets: ~128x128 RGBA = ~65KB per tileset
            cacheSizeBytes += tilesetCount * 128 * 128 * 4;
            
            // Block definitions: estimate ~256 blocks * 16 bytes each = ~4KB per tileset
            cacheSizeBytes += blockDefCount * 256 * 16;
            
            // Map data: estimate ~10KB per map
            cacheSizeBytes += mapCount * 10 * 1024;
            
            const cacheSizeMB = (cacheSizeBytes / 1024 / 1024).toFixed(2);
            cacheInfo = `Cache: ${cacheSizeMB}MB (${spriteCount}S | ${tilesetCount}T | ${blockDefCount}B | ${mapCount}M)`;
        }
        
        // Build title - cache first, then memory
        const parts = [];
        if (cacheInfo) parts.push(cacheInfo);
        if (memoryInfo) parts.push(memoryInfo);
        
        document.title = parts.length > 0 ? parts.join(' | ') : 'Pokemon Red - Map Viewer';
    }
    
    // Update immediately
    updateTitle();
    
    // Update every 2 seconds
    setInterval(updateTitle, 2000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Get mode from URL parameter or data attribute
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode') || document.body.dataset.mode || 'map-viewer';
        initMapViewer(mode);
    });
} else {
    // DOM already ready
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') || document.body.dataset.mode || 'map-viewer';
    initMapViewer(mode);
}

// Export initMapViewer for external use
window.initMapViewer = initMapViewer;
