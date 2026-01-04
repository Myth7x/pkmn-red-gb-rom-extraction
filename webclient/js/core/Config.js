// Configuration settings for the Map Viewer

// Always update version after changes
export const MODULE_VERSION = '1.1.0';

export class Config {
    constructor(mode = 'map-viewer') {
        // Application mode: 'map-viewer' or 'game'
        this.mode = mode;
        
        // Path configuration
        this.paths = {
            mapData: '../output/map-data/',
            maps: '../output/map-data/maps/',
            textures: '../output/map-data/textures/',
            sprites: '../output/overworld-sprites/',
            mapIndex: '../output/map-data/map_index.json',
            tilesetData: '../output/map-data/tilesets_complete.json',
            spriteMetadata: '../output/overworld-sprites/overworld_sprites.json'
        };
        
        // Default settings (mode-dependent)
        this.defaults = this.getDefaultsForMode(mode);
        
        // Performance settings
        this.performance = {
            maxCacheSize: 100,
            spritePreloadBatchSize: 10
        };
    }
    
    /**
     * Get default settings based on mode
     * @param {string} mode - 'map-viewer' or 'game'
     * @returns {Object}
     */
    getDefaultsForMode(mode) {
        if (mode === 'game') {
            return {
                zoom: 4,                 // Default zoom 4x for game mode
                offsetX: 0,
                offsetY: 0,
                showOverlays: false,     // No overlays in game mode
                showGrid: false,         // No grid in game mode
                showCoordLabels: false,  // No coord labels in game mode
                sidebarVisible: false,   // No sidebar in game mode
                showMapBoundaries: false, // No boundaries in game mode
                showIndicators: false    // No indicators in game mode
            };
        } else {
            // map-viewer mode (default)
            return {
                zoom: 2,
                offsetX: 50,
                offsetY: 50,
                showOverlays: true,
                showGrid: false,
                showCoordLabels: false,
                sidebarVisible: true,
                showMapBoundaries: true,
                showIndicators: true
            };
        }
    }
    
    /**
     * Check if a feature is enabled for the current mode
     * @param {string} feature - Feature name
     * @returns {boolean}
     */
    isFeatureEnabled(feature) {
        switch (feature) {
            case 'overlays':
                return this.mode === 'map-viewer';
            case 'grid':
                return this.mode === 'map-viewer';
            case 'coordLabels':
                return this.mode === 'map-viewer';
            case 'sidebar':
                return this.mode === 'map-viewer';
            case 'boundaries':
                return this.mode === 'map-viewer';
            case 'indicators':
                return this.mode === 'map-viewer';
            case 'player':
                return this.mode === 'game';
            case 'camera':
                return this.mode === 'game';
            default:
                return true;
        }
    }
    
    /**
     * Check if in game mode
     * @returns {boolean}
     */
    isGameMode() {
        return this.mode === 'game';
    }
    
    /**
     * Check if in map-viewer mode
     * @returns {boolean}
     */
    isMapViewerMode() {
        return this.mode === 'map-viewer';
    }
    
    getMapPath(mapId, fileName) {
        const paddedId = String(mapId).padStart(3, '0');
        // Replace spaces with underscores to match filesystem naming
        const sanitizedFileName = fileName.replace(/\s+/g, '_');
        return `${this.paths.maps}${paddedId}_${sanitizedFileName}.json`;
    }
    
    getTilesetPath(tilesetId, tilesetName) {
        const paddedId = String(tilesetId).padStart(2, '0');
        return `${this.paths.textures}tileset_${paddedId}_${tilesetName}.png`;
    }
    
    getSpritePath(spriteId, spriteName) {
        const paddedId = String(spriteId).padStart(3, '0');
        return `${this.paths.sprites}${paddedId}_${spriteName}.png`;
    }
}
