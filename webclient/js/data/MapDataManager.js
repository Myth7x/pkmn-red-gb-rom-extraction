// Map data loading and caching
import { CacheManager } from './CacheManager.js';
import { Logger } from '../utils/Logger.js';

// Always update version after changes
export const MODULE_VERSION = '1.0.1';

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
    
    /**
     * Load map by index (0-based array index, not mapId)
     * @param {number} index - The array index in the map list
     * @returns {Promise<Object>} - The map data
     */
    async loadMapByIndex(index) {
        if (!this.mapIndex) {
            await this.loadMapIndex();
        }
        
        if (index < 0 || index >= this.mapIndex.maps.length) {
            Logger.warn(`Map index ${index} out of range`);
            return null;
        }
        
        const mapInfo = this.mapIndex.maps[index];
        return await this.loadMap(mapInfo.mapId);
    }
    
    async loadMap(mapId) {
        // Check cache first
        if (this.cache.has(mapId)) {
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
    
    /**
     * Find which overworld map has a warp leading to the specified indoor map
     * Used for handling warp 255 (return to previous map)
     * @param {number} indoorMapId - The indoor map ID to find the source for
     * @returns {Promise<{mapId: number, x: number, y: number}|null>} Source map info or null
     */
    async findSourceOverworldMap(indoorMapId) {
        if (!this.mapIndex) {
            await this.loadMapIndex();
        }
        
        Logger.log(`Finding source overworld map for indoor map ${indoorMapId}...`);
        
        // Search through all maps to find one with a warp leading to this indoor map
        for (const mapInfo of this.mapIndex.maps) {
            try {
                const mapData = await this.loadMap(mapInfo.mapId);
                
                // Check if this map has connections (it's an overworld map)
                const hasConnections = mapData.connections && (
                    mapData.connections.north || 
                    mapData.connections.south || 
                    mapData.connections.east || 
                    mapData.connections.west
                );
                
                if (!hasConnections) {
                    continue; // Skip indoor maps
                }
                
                // Check if this overworld map has a warp to our indoor map
                if (mapData.objects?.warps?.data) {
                    const warpToIndoor = mapData.objects.warps.data.find(w => w.mapId === indoorMapId);
                    if (warpToIndoor) {
                        Logger.success(`Found source: Map ${mapInfo.mapId} (${mapInfo.name}) at (${warpToIndoor.x}, ${warpToIndoor.y})`);
                        return {
                            mapId: mapInfo.mapId,
                            x: warpToIndoor.x,
                            y: warpToIndoor.y
                        };
                    }
                }
            } catch (error) {
                // Skip maps that fail to load
                Logger.warn(`Failed to check map ${mapInfo.mapId}:`, error.message);
                continue;
            }
        }
        
        Logger.warn(`No source overworld map found for indoor map ${indoorMapId}`);
        return null;
    }
    
    /**
     * Find all maps that have warps leading to the specified target map
     * @param {number} targetMapId - The target map ID to find sources for
     * @param {number|null} preferredMapId - Preferred source map ID (e.g., from history)
     * @returns {Promise<{mapId: number, x: number, y: number}|null>} Source map info or null
     */
    async findSourceMapsWithWarp(targetMapId, preferredMapId = null) {
        if (!this.mapIndex) {
            await this.loadMapIndex();
        }
        
        Logger.log(`Finding source maps with warps to map ${targetMapId}...`);
        const sourceMaps = [];
        
        // Search through all maps to find ones with warps leading to target map
        for (const mapInfo of this.mapIndex.maps) {
            try {
                const mapData = await this.loadMap(mapInfo.mapId);
                
                // Check if this map has a warp to our target map
                if (mapData.objects?.warps?.data) {
                    const warpsToTarget = mapData.objects.warps.data.filter(w => w.mapId === targetMapId);
                    if (warpsToTarget.length > 0) {
                        // Add all warps from this map to the target
                        for (const warp of warpsToTarget) {
                            sourceMaps.push({
                                mapId: mapInfo.mapId,
                                mapName: mapInfo.name,
                                x: warp.x,
                                y: warp.y,
                                warpId: warp.warpId
                            });
                        }
                    }
                }
            } catch (error) {
                // Skip maps that fail to load
                continue;
            }
        }
        
        Logger.log(`Found ${sourceMaps.length} source map(s) with warps to map ${targetMapId}`);
        
        if (sourceMaps.length === 0) {
            return null;
        }
        
        // If we have a preferred map ID and it's in the list, return that one
        if (preferredMapId !== null) {
            const preferred = sourceMaps.find(m => m.mapId === preferredMapId);
            if (preferred) {
                Logger.success(`Using preferred source map ${preferred.mapId} (${preferred.mapName})`);
                return preferred;
            }
        }
        
        // Otherwise return the first one found
        Logger.log(`Using first source map ${sourceMaps[0].mapId} (${sourceMaps[0].mapName})`);
        return sourceMaps[0];
    }
}
