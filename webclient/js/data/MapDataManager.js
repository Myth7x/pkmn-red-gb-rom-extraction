// Map data loading and caching
import { CacheManager } from './CacheManager.js';
import { Logger } from '../utils/Logger.js';

export const MODULE_VERSION = '1.0.0';

export class MapDataManager {
    constructor(config) {
        this.config = config;
        this.cache = new CacheManager(config.performance.maxCacheSize);
        this.mapIndex = null;
    }
    
    async loadMapIndex() {
        if (this.mapIndex) {
            return this.mapIndex;
        }
        
        Logger.log('Fetching map index from', this.config.paths.mapIndex);
        const response = await fetch(this.config.paths.mapIndex);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        this.mapIndex = data;
        Logger.success(`Loaded ${data.maps.length} maps`);
        
        return data;
    }
    
    async getMapFileName(mapId) {
        Logger.info(`Getting filename for map ${mapId}...`);
        
        if (!this.mapIndex) {
            await this.loadMapIndex();
        }
        
        const map = this.mapIndex.maps.find(m => m.mapId === mapId);
        
        if (!map) {
            Logger.warn(`Map ${mapId} not found in index, using fallback`);
            return `Map_${mapId}`;
        }
        
        Logger.info(`Found: ${map.name}`);
        return map.name;
    }
    
    async loadMap(mapId) {
        // Check cache first
        if (this.cache.has(mapId)) {
            Logger.log(`Map ${mapId} loaded from cache`);
            return this.cache.get(mapId);
        }
        
        Logger.log(`Loading map ID: ${mapId}`);
        
        // Handle special/invalid map IDs
        if (mapId === 255 || mapId === -1 || mapId === null || mapId === undefined) {
            throw new Error(`Invalid map ID: ${mapId} (Special marker or invalid destination)`);
        }
        
        // Load map data
        const mapFileName = await this.getMapFileName(mapId);
        const mapFile = this.config.getMapPath(mapId, mapFileName);
        Logger.log(`Fetching map file: ${mapFile}`);
        
        const response = await fetch(mapFile);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText} for ${mapFile}`);
        }
        
        const mapData = await response.json();
        Logger.success(`Map data loaded: ${mapData.name}`);
        Logger.info(`Size: ${mapData.width}x${mapData.height} blocks`);
        Logger.info(`Tileset: ${mapData.tileset} (${mapData.tilesetName})`);
        
        // Validate blockData
        if (!mapData.blockData || !Array.isArray(mapData.blockData)) {
            throw new Error(`Map ${mapData.name} has no blockData array!`);
        }
        
        Logger.info(`Block data length: ${mapData.blockData.length}`);
        Logger.debug(`Expected length: ${mapData.width * mapData.height}`);
        Logger.debug(`Match: ${mapData.blockData.length === mapData.width * mapData.height ? '✓' : '✗'}`);
        
        // Cache the map data
        this.cache.set(mapId, mapData);
        
        return mapData;
    }
    
    getMapFromCache(mapId) {
        return this.cache.get(mapId);
    }
}
