// Configuration settings for the Map Viewer

// Always update version after changes
export const MODULE_VERSION = '1.0.0';

export class Config {
    constructor() {
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
        
        // Default settings
        this.defaults = {
            zoom: 2,
            offsetX: 50,
            offsetY: 50,
            showOverlays: true,
            showGrid: false,
            showCoordLabels: false,
            sidebarVisible: true
        };
        
        // Performance settings
        this.performance = {
            maxCacheSize: 100,
            spritePreloadBatchSize: 10
        };
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
