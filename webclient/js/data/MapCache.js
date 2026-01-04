/**
 * MapCache.js
 * 
 * Comprehensive caching system for all map data, connections, and collision data.
 * Preloads all maps at initialization for instant access during gameplay.
 */

import { Logger } from '../utils/Logger.js';
import { MapStitcher } from './MapStitcher.js';

export const MODULE_VERSION = '1.0.0';

export class MapCache {
    constructor(config, mapDataManager) {
        this.config = config;
        this.mapDataManager = mapDataManager;
        
        // Cache storage
        this.maps = new Map(); // mapId -> map data
        this.connections = new Map(); // mapId -> connections graph
        this.collisionData = new Map(); // mapId -> collision grid
        
        // Map graph for multi-hop pathfinding
        this.mapGraph = {}; // mapId -> [connected mapIds]
        
        // Map stitcher for seamless world
        this.stitcher = new MapStitcher();
        
        // Loading state
        this.isLoaded = false;
        this.loadPromise = null;
    }
    
    /**
     * Preload all maps and build cache
     * @returns {Promise<void>}
     */
    async preloadAll() {
        if (this.isLoaded) {
            return;
        }
        
        if (this.loadPromise) {
            return this.loadPromise;
        }
        
        this.loadPromise = this._doPreload();
        return this.loadPromise;
    }
    
    /**
     * Internal preload implementation
     * @private
     */
    async _doPreload() {
        try {
            Logger.log('🗺️ Starting comprehensive map cache preload...');
            const startTime = performance.now();
            
            // Load map index
            const mapIndex = await this.mapDataManager.loadMapIndex();
            const totalMaps = mapIndex.maps.length;
            
            Logger.log(`📦 Preloading ${totalMaps} maps...`);
            
            // Preload all maps
            let loadedCount = 0;
            const loadPromises = [];
            
            for (const mapInfo of mapIndex.maps) {
                const promise = this._loadAndCacheMap(mapInfo.mapId)
                    .then(() => {
                        loadedCount++;
                        if (loadedCount % 10 === 0 || loadedCount === totalMaps) {
                            Logger.log(`📍 Cached ${loadedCount}/${totalMaps} maps...`);
                        }
                    })
                    .catch(error => {
                        Logger.warn(`⚠️ Failed to cache map ${mapInfo.mapId}: ${error.message}`);
                    });
                loadPromises.push(promise);
            }
            
            // Wait for all maps to load
            await Promise.all(loadPromises);
            
            // Build map connection graph
            this._buildMapGraph();
            
            // Stitch world map (for game mode seamless world)
            await this.stitcher.stitchWorld(this.maps, this.connections);
            
            const endTime = performance.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            
            this.isLoaded = true;
            Logger.success(`✅ Map cache ready! Loaded ${this.maps.size} maps in ${duration}s`);
            Logger.info(`📊 Connection graph: ${Object.keys(this.mapGraph).length} nodes`);
            
        } catch (error) {
            Logger.error('❌ Failed to preload map cache:', error);
            throw error;
        }
    }
    
    /**
     * Load and cache a single map
     * @private
     */
    async _loadAndCacheMap(mapId) {
        try {
            // Load map data
            const mapData = await this.mapDataManager.loadMap(mapId);
            
            // Cache the map
            this.maps.set(mapId, mapData);
            
            // Cache connections using connectionHeaders (which has the actual connection data)
            if (mapData.connectionHeaders) {
                this.connections.set(mapId, {
                    north: mapData.connectionHeaders.north || null,
                    south: mapData.connectionHeaders.south || null,
                    east: mapData.connectionHeaders.east || null,
                    west: mapData.connectionHeaders.west || null
                });
            }
            
            // Cache collision data (simplified for now)
            // Can be expanded to include full tileset collision data
            this.collisionData.set(mapId, {
                width: mapData.width,
                height: mapData.height,
                blockData: mapData.blockData,
                tileset: mapData.tileset
            });
            
        } catch (error) {
            Logger.warn(`Failed to cache map ${mapId}:`, error.message);
        }
    }
    
    /**
     * Build map connection graph for pathfinding
     * @private
     */
    _buildMapGraph() {
        Logger.log('🔗 Building map connection graph...');
        
        this.mapGraph = {};
        
        for (const [mapId, connections] of this.connections.entries()) {
            const connectedMaps = [];
            
            // Check each direction and use connectionHeaders data
            if (connections.north && connections.north.connectedMap !== undefined) {
                connectedMaps.push({
                    mapId: connections.north.connectedMap,
                    direction: 'north',
                    connection: connections.north
                });
            }
            if (connections.south && connections.south.connectedMap !== undefined) {
                connectedMaps.push({
                    mapId: connections.south.connectedMap,
                    direction: 'south',
                    connection: connections.south
                });
            }
            if (connections.east && connections.east.connectedMap !== undefined) {
                connectedMaps.push({
                    mapId: connections.east.connectedMap,
                    direction: 'east',
                    connection: connections.east
                });
            }
            if (connections.west && connections.west.connectedMap !== undefined) {
                connectedMaps.push({
                    mapId: connections.west.connectedMap,
                    direction: 'west',
                    connection: connections.west
                });
            }
            
            if (connectedMaps.length > 0) {
                this.mapGraph[mapId] = connectedMaps;
            }
        }
        
        Logger.success(`✅ Built connection graph with ${Object.keys(this.mapGraph).length} nodes`);
        
        // Log some sample connections for debugging
        if (Object.keys(this.mapGraph).length > 0) {
            const sampleMapId = Object.keys(this.mapGraph)[0];
            const sampleMap = this.maps.get(parseInt(sampleMapId));
            const sampleConnections = this.mapGraph[sampleMapId];
            Logger.log(`   Sample: Map ${sampleMapId} (${sampleMap?.name || 'Unknown'}) has ${sampleConnections.length} connections`);
            sampleConnections.forEach(conn => {
                const connectedMap = this.maps.get(conn.mapId);
                Logger.log(`      - ${conn.direction} → Map ${conn.mapId} (${connectedMap?.name || 'Unknown'})`);
            });
        }
    }
    
    /**
     * Get cached map data
     * @param {number} mapId
     * @returns {Object|null}
     */
    getMap(mapId) {
        return this.maps.get(mapId) || null;
    }
    
    /**
     * Get map connections
     * @param {number} mapId
     * @returns {Object|null}
     */
    getConnections(mapId) {
        return this.connections.get(mapId) || null;
    }
    
    /**
     * Get collision data
     * @param {number} mapId
     * @returns {Object|null}
     */
    getCollisionData(mapId) {
        return this.collisionData.get(mapId) || null;
    }
    
    /**
     * Find path between two maps using BFS
     * @param {number} startMapId
     * @param {number} targetMapId
     * @returns {Array|null} - Array of {mapId, direction, connection} or null if no path
     */
    findMapPath(startMapId, targetMapId) {
        if (startMapId === targetMapId) {
            return [];
        }
        
        const startMap = this.maps.get(startMapId);
        const targetMap = this.maps.get(targetMapId);
        const startName = startMap ? startMap.name : `Map ${startMapId}`;
        const targetName = targetMap ? targetMap.name : `Map ${targetMapId}`;
        
        Logger.log(`🔍 Pathfinding: ${startName} (${startMapId}) → ${targetName} (${targetMapId})`);
        
        if (!this.mapGraph[startMapId]) {
            Logger.warn(`  ❌ ${startName} (${startMapId}) has no connections in graph`);
            const connections = this.connections.get(startMapId);
            if (connections) {
                Logger.log(`  📋 Raw connections:`, connections);
            }
            return null;
        }
        
        Logger.log(`  ✅ ${startName} has ${this.mapGraph[startMapId].length} connection(s)`);
        
        // BFS to find shortest path
        const queue = [[startMapId]];
        const visited = new Set([startMapId]);
        let iterations = 0;
        const maxIterations = 1000; // Safety limit
        
        while (queue.length > 0 && iterations < maxIterations) {
            iterations++;
            const path = queue.shift();
            const currentMapId = path[path.length - 1];
            
            // Get connections for current map
            const connections = this.mapGraph[currentMapId];
            if (!connections) continue;
            
            for (const conn of connections) {
                if (conn.mapId === targetMapId) {
                    // Found target!
                    const finalPath = [...path, conn.mapId].map((mapId, index, arr) => {
                        if (index === 0) return { mapId, direction: null, connection: null };
                        
                        // Find the direction from previous map to this map
                        const prevMapId = arr[index - 1];
                        const prevConnections = this.mapGraph[prevMapId];
                        const connection = prevConnections ? prevConnections.find(c => c.mapId === mapId) : null;
                        
                        return {
                            mapId,
                            direction: connection ? connection.direction : null,
                            connection: connection ? connection.connection : null
                        };
                    });
                    
                    Logger.success(`  ✅ Path found in ${iterations} iterations! Length: ${finalPath.length} maps`);
                    return finalPath;
                }
                
                if (!visited.has(conn.mapId)) {
                    visited.add(conn.mapId);
                    queue.push([...path, conn.mapId]);
                }
            }
        }
        
        if (iterations >= maxIterations) {
            Logger.error(`  ❌ Pathfinding exceeded maximum iterations (${maxIterations})`);
        } else {
            Logger.warn(`  ❌ No path found after ${iterations} iterations. Visited ${visited.size} maps.`);
        }
        
        return null; // No path found
    }
    
    /**
     * Get all towns/cities (maps with Town/City/Island/Plateau in name)
     * @returns {Array}
     */
    getTowns() {
        const towns = [];
        for (const [mapId, mapData] of this.maps.entries()) {
            if (mapData.name.includes('Town') || 
                mapData.name.includes('City') || 
                mapData.name.includes('Island') || 
                mapData.name.includes('Plateau')) {
                towns.push({
                    mapId,
                    name: mapData.name
                });
            }
        }
        return towns.sort((a, b) => a.mapId - b.mapId);
    }
    
    /**
     * Find a random walkable tile in a map (for navigation destination)
     * @param {number} mapId
     * @param {Object} player - Player instance with isWalkable method
     * @returns {Object|null} - {x, y} in player units, or null if no walkable tile found
     */
    findWalkableTile(mapId, player) {
        const mapData = this.maps.get(mapId);
        if (!mapData || !mapData.blockData) {
            return null;
        }
        
        const mapWidthBlocks = mapData.width;
        const mapHeightBlocks = mapData.height;
        const mapWidthPlayerUnits = mapWidthBlocks * 2;
        const mapHeightPlayerUnits = mapHeightBlocks * 2;
        
        // Try center area first (more likely to be walkable in towns)
        const centerX = Math.floor(mapWidthPlayerUnits / 2);
        const centerY = Math.floor(mapHeightPlayerUnits / 2);
        
        // Check center
        if (player.isWalkable(centerX, centerY, mapData)) {
            return { x: centerX, y: centerY };
        }
        
        // Try tiles in spiral pattern from center
        const maxRadius = Math.max(mapWidthPlayerUnits, mapHeightPlayerUnits);
        for (let radius = 1; radius < maxRadius; radius++) {
            // Try tiles at this radius
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Only check edge of current radius (not interior already checked)
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
                        continue;
                    }
                    
                    const x = centerX + dx;
                    const y = centerY + dy;
                    
                    // Check bounds
                    if (x < 0 || x >= mapWidthPlayerUnits || y < 0 || y >= mapHeightPlayerUnits) {
                        continue;
                    }
                    
                    if (player.isWalkable(x, y, mapData)) {
                        return { x, y };
                    }
                }
            }
        }
        
        return null; // No walkable tile found
    }
    
    /**
     * Check if a tile is walkable
     * @param {number} playerX - X in player units
     * @param {number} playerY - Y in player units
     * @param {Object} mapData - Map data object
     * @param {Object} tilesetManager - For checking tile collision
     * @returns {boolean}
     */
    isTileWalkable(playerX, playerY, mapData, tilesetManager) {
        // Convert player units to block coordinates
        const blockX = Math.floor(playerX / 2);
        const blockY = Math.floor(playerY / 2);
        
        // Check bounds
        if (blockX < 0 || blockX >= mapData.width || blockY < 0 || blockY >= mapData.height) {
            return false;
        }
        
        // Get block ID
        const blockIndex = blockY * mapData.width + blockX;
        if (!mapData.blockData || blockIndex >= mapData.blockData.length) {
            return false;
        }
        
        const blockId = mapData.blockData[blockIndex];
        
        // Get block definition from tileset
        const tilesetData = tilesetManager.getTileset(mapData.tileset);
        if (!tilesetData || !tilesetData.blocks || !tilesetData.blocks[blockId]) {
            return false; // Unknown block, treat as not walkable
        }
        
        const blockDef = tilesetData.blocks[blockId];
        
        // Check tile collision (in player unit offsets within the block)
        const tileX = playerX % 2;
        const tileY = playerY % 2;
        
        // Block is 2x2 tiles, get the specific tile
        const tileIndex = tileY * 2 + tileX;
        
        if (!blockDef.tiles || blockDef.tiles.length <= tileIndex) {
            return false;
        }
        
        const tileId = blockDef.tiles[tileIndex];
        
        // Check collision flag for this tile
        if (!tilesetData.collisions || !tilesetData.collisions[tileId]) {
            return true; // No collision data means walkable
        }
        
        return tilesetData.collisions[tileId] === 0; // 0 = walkable, non-zero = not walkable
    }
    
    /**
     * Check if cache is ready
     * @returns {boolean}
     */
    isReady() {
        return this.isLoaded && this.stitcher.isReady();
    }
    
    /**
     * Get cache statistics
     * @returns {Object}
     */
    getStats() {
        return {
            mapsLoaded: this.maps.size,
            connectionsLoaded: this.connections.size,
            collisionDataLoaded: this.collisionData.size,
            graphNodes: Object.keys(this.mapGraph).length,
            stitchedMaps: this.stitcher.getStitchedMapCount(),
            worldBounds: this.stitcher.getWorldBounds(),
            isReady: this.isLoaded
        };
    }
    
    /**
     * Get the map stitcher
     * @returns {MapStitcher}
     */
    getStitcher() {
        return this.stitcher;
    }
    
    /**
     * Convert local map coordinates to global world coordinates
     * @param {number} mapId - Map ID
     * @param {number} localX - Local X in player units
     * @param {number} localY - Local Y in player units
     * @returns {Object|null} - {x, y} or null if map not found
     */
    localToGlobal(mapId, localX, localY) {
        // Convert player units to blocks for stitcher
        const localBlockX = localX / 2;
        const localBlockY = localY / 2;
        
        const globalBlocks = this.stitcher.localToGlobal(mapId, localBlockX, localBlockY);
        if (!globalBlocks) return null;
        
        // Convert blocks back to player units
        return {
            x: globalBlocks.x * 2,
            y: globalBlocks.y * 2
        };
    }
    
    /**
     * Convert global world coordinates to local map coordinates
     * @param {number} globalX - Global X in player units
     * @param {number} globalY - Global Y in player units
     * @returns {Object|null} - {mapId, x, y} or null if no map at position
     */
    globalToLocal(globalX, globalY) {
        // Convert player units to blocks for stitcher
        const globalBlockX = globalX / 2;
        const globalBlockY = globalY / 2;
        
        const result = this.stitcher.globalToLocal(globalBlockX, globalBlockY);
        if (!result) return null;
        
        // Convert blocks back to player units
        return {
            mapId: result.mapId,
            x: result.x * 2,
            y: result.y * 2
        };
    }
    
    /**
     * Get all maps visible in viewport (for rendering)
     * @param {number} viewX - Viewport center X in player units
     * @param {number} viewY - Viewport center Y in player units
     * @param {number} viewWidth - Viewport width in pixels
     * @param {number} viewHeight - Viewport height in pixels
     * @param {number} scale - Render scale
     * @returns {Array} - Array of {mapId, globalX, globalY, map}
     */
    getVisibleMaps(viewX, viewY, viewWidth, viewHeight, scale) {
        // Convert player units to blocks
        const viewBlockX = viewX / 2;
        const viewBlockY = viewY / 2;
        
        // Calculate viewport size in blocks
        const BLOCK_SIZE = 4; // 4x4 tiles
        const TILE_SIZE = 8; // 8x8 pixels
        const blockPixelSize = BLOCK_SIZE * TILE_SIZE * scale;
        
        const viewWidthBlocks = Math.ceil(viewWidth / blockPixelSize) + 2; // Add padding
        const viewHeightBlocks = Math.ceil(viewHeight / blockPixelSize) + 2;
        
        // Get visible map positions from stitcher
        const visibleMapPositions = this.stitcher.getVisibleMaps(
            viewBlockX - viewWidthBlocks / 2,
            viewBlockY - viewHeightBlocks / 2,
            viewWidthBlocks,
            viewHeightBlocks
        );
        
        // Return map data with positions
        return visibleMapPositions.map(pos => ({
            mapId: pos.mapId,
            globalX: pos.x * 2, // Convert blocks to player units
            globalY: pos.y * 2,
            map: this.maps.get(pos.mapId)
        })).filter(m => m.map); // Filter out any missing maps
    }
}
