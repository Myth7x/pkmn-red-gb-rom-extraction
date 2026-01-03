/**
 * InteriorMapLayoutManager.js
 * 
 * Manages layout and rendering of interior maps connected by warps.
 * For maps without connections (borders), analyzes warps and arranges
 * connected interior maps in a grid layout.
 */

import { Logger } from '../utils/Logger.js';
import { TILE_SIZE, BLOCK_SIZE } from '../core/Constants.js';

// Version: Update patch number for bug fixes, minor for new features, major for breaking changes
export const MODULE_VERSION = '1.2.2';

export class InteriorMapLayoutManager {
    constructor(mapDataManager) {
        this.mapDataManager = mapDataManager;
        
        // Cache of analyzed layouts
        this.layoutCache = new Map(); // Key: mapId, Value: layout data
        
        // Current active layout
        this.currentLayout = null;
        
        // LocalStorage key for custom positions
        this.STORAGE_KEY = 'pokemonRed_interiorRoomPositions';
    }
    
    /**
     * Generate a unique ID for an interior room group
     * ID is based on sorted map IDs to ensure consistency
     * @param {Array} mapIds - Array of map IDs in the group
     * @returns {string} Unique group ID
     */
    generateGroupId(mapIds) {
        // Sort map IDs and join to create consistent ID
        const sortedIds = [...mapIds].sort((a, b) => a - b);
        return `interior_${sortedIds.join('_')}`;
    }
    
    /**
     * Save custom room positions to localStorage
     * @param {string} groupId - Unique group ID
     * @param {Array} rooms - Array of room objects with custom positions
     */
    saveCustomPositions(groupId, rooms) {
        try {
            const allPositions = this.loadAllCustomPositions();
            
            // Store only the necessary position data
            allPositions[groupId] = rooms.map(room => ({
                mapId: room.mapId,
                offsetX: room.offsetX,
                offsetY: room.offsetY
            }));
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allPositions));
            Logger.log(`Saved custom positions for group: ${groupId}`);
        } catch (error) {
            Logger.warn(`Failed to save custom positions: ${error.message}`);
        }
    }
    
    /**
     * Load all custom positions from localStorage
     * @returns {Object} All saved position data
     */
    loadAllCustomPositions() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            Logger.warn(`Failed to load custom positions: ${error.message}`);
            return {};
        }
    }
    
    /**
     * Load custom positions for a specific group
     * @param {string} groupId - Unique group ID
     * @returns {Object|null} Custom positions or null if not found
     */
    loadCustomPositions(groupId) {
        const allPositions = this.loadAllCustomPositions();
        return allPositions[groupId] || null;
    }
    
    /**
     * Apply custom positions to a layout
     * @param {Object} layout - Layout object to modify
     * @param {Object} customPositions - Custom position data
     */
    applyCustomPositions(layout, customPositions) {
        const positionMap = new Map(customPositions.map(p => [p.mapId, p]));
        
        for (const room of layout.rooms) {
            const customPos = positionMap.get(room.mapId);
            if (customPos) {
                room.offsetX = customPos.offsetX;
                room.offsetY = customPos.offsetY;
            }
        }
        
        Logger.log(`Applied custom positions to layout`);
    }
    
    /**
     * Check if a map has no connections (is an interior/building map)
     * @param {Object} mapData - Map data to check
     * @returns {boolean} True if map has no connections
     */
    isInteriorMap(mapData) {
        if (!mapData.connections) return true;
        
        const hasAnyConnection = 
            mapData.connections.north || 
            mapData.connections.south ||
            mapData.connections.east ||
            mapData.connections.west;
        
        return !hasAnyConnection;
    }
    
    /**
     * Analyze warps in a map and build connected interior map network
     * @param {number} rootMapId - Starting map ID
     * @returns {Promise<Object>} Layout information
     */
    async analyzeInteriorMapLayout(rootMapId) {
        // Check cache
        if (this.layoutCache.has(rootMapId)) {
            Logger.log(`Using cached layout for map ${rootMapId}`);
            return this.layoutCache.get(rootMapId);
        }
        
        Logger.log(`🏢 Analyzing interior map layout for map ${rootMapId}...`);
        
        const rootMapData = await this.mapDataManager.loadMap(rootMapId);
        
        // Check if this is actually an interior map
        if (!this.isInteriorMap(rootMapData)) {
            Logger.warn(`Map ${rootMapId} has connections, not an interior map`);
            return null;
        }
        
        // Check if map has warps
        if (!rootMapData.objects?.warps?.data || rootMapData.objects.warps.data.length === 0) {
            Logger.log(`Map ${rootMapId} has no warps, single room`);
            return {
                rootMapId,
                rooms: [{
                    mapId: rootMapId,
                    mapData: rootMapData,
                    gridX: 0,
                    gridY: 0,
                    offsetX: 0,
                    offsetY: 0
                }],
                gridWidth: 1,
                gridHeight: 1
            };
        }
        
        // Build network of connected rooms via warps
        const network = await this.buildWarpNetwork(rootMapId, rootMapData);
        
        // Arrange rooms in a grid layout (pass rootMapId to ensure it's placed first)
        const layout = this.arrangeRoomsInGrid(network, rootMapId);
        
        // Generate group ID and try to load custom positions
        const mapIds = layout.rooms.map(room => room.mapId);
        const groupId = this.generateGroupId(mapIds);
        const customPositions = this.loadCustomPositions(groupId);
        
        // Apply custom positions if they exist
        if (customPositions && customPositions.length > 0) {
            this.applyCustomPositions(layout, customPositions);
            Logger.info(`✓ Restored custom positions for group: ${groupId}`);
        } else {
            Logger.info(`Using default tree layout for group: ${groupId}`);
        }
        
        // Cache the layout
        this.layoutCache.set(rootMapId, layout);
        
        Logger.success(`✓ Layout analyzed: ${layout.rooms.length} rooms in ${layout.gridWidth}x${layout.gridHeight} grid`);
        
        return layout;
    }
    
    /**
     * Build network of rooms connected by warps
     * @param {number} rootMapId - Starting map ID
     * @param {Object} rootMapData - Starting map data
     * @returns {Promise<Map>} Map of roomId -> room data
     */
    async buildWarpNetwork(rootMapId, rootMapData) {
        const network = new Map();
        const visited = new Set();
        const queue = [{ mapId: rootMapId, mapData: rootMapData, depth: 0 }];
        
        while (queue.length > 0) {
            const { mapId, mapData, depth } = queue.shift();
            
            if (visited.has(mapId)) continue;
            visited.add(mapId);
            
            // Don't go too deep (prevent infinite loops)
            if (depth > 10) {
                Logger.warn(`Max depth reached at map ${mapId}`);
                continue;
            }
            
            // Add this room to network
            const warpsWithIds = (mapData.objects?.warps?.data || []).map((warp, index) => ({
                ...warp,
                warpId: index // Add explicit warpId based on array index
            }));
            
            network.set(mapId, {
                mapId,
                mapData,
                warps: warpsWithIds,
                connections: []
            });
            
            // Process warps to find connected interior rooms
            if (mapData.objects?.warps?.data) {
                for (let warpIndex = 0; warpIndex < mapData.objects.warps.data.length; warpIndex++) {
                    const warp = mapData.objects.warps.data[warpIndex];
                    const destMapId = warp.mapId;
                    
                    // Skip special warp IDs
                    if (destMapId === 255 || destMapId === 0) continue;
                    
                    // Add explicit warpId to the warp object
                    // Support both old (warpId) and new (destWarpId) field names
                    const destWarpId = warp.destWarpId !== undefined ? warp.destWarpId : warp.warpId;
                    const warpWithId = { 
                        ...warp, 
                        warpId: warpIndex,  // This warp's own ID (array index)
                        destWarpId: destWarpId  // Destination warp ID
                    };
                    
                    // Skip if already visited
                    if (visited.has(destMapId)) {
                        // Just record the connection with destination warp ID
                        network.get(mapId).connections.push({
                            fromWarp: warpWithId,
                            toMapId: destMapId,
                            toWarpId: destWarpId // Destination warp ID (array index on dest map)
                        });
                        continue;
                    }
                    
                    try {
                        const destMapData = await this.mapDataManager.loadMap(destMapId);
                        
                        // Only include if destination is also an interior map
                        if (this.isInteriorMap(destMapData)) {
                            // Record connection with destination warp ID
                            network.get(mapId).connections.push({
                                fromWarp: warpWithId,
                                toMapId: destMapId,
                                toWarpId: destWarpId // Destination warp ID (array index on dest map)
                            });
                            
                            // Add to queue
                            queue.push({
                                mapId: destMapId,
                                mapData: destMapData,
                                depth: depth + 1
                            });
                        }
                    } catch (error) {
                        Logger.warn(`Failed to load destination map ${destMapId}: ${error.message}`);
                    }
                }
            }
        }
        
        Logger.log(`Network built: ${network.size} connected rooms`);
        return network;
    }
    
    /**
     * Arrange rooms in a tree-based layout
     * Tree shows warp hierarchy - starting with lowest map ID at top, 
     * descending levels show rooms reachable by additional warps
     * @param {Map} network - Network of connected rooms
     * @param {number} rootMapId - The root/starting map ID
     * @returns {Object} Layout with tree positions
     */
    arrangeRoomsInGrid(network, rootMapId) {
        const rooms = [];
        const positions = new Map(); // mapId -> {gridX, gridY, level}
        
        // Find the map with the lowest ID to use as tree root
        const allMapIds = Array.from(network.keys());
        const treeRootId = Math.min(...allMapIds);
        
        Logger.log(`Building tree layout with root: Map ${treeRootId}`);
        
        // Build tree structure using BFS from tree root
        const levels = []; // Array of arrays: levels[depth] = [mapIds at that depth]
        const visited = new Set();
        const queue = [{ mapId: treeRootId, depth: 0 }];
        
        visited.add(treeRootId);
        
        while (queue.length > 0) {
            const { mapId, depth } = queue.shift();
            
            // Initialize level array if needed
            if (!levels[depth]) {
                levels[depth] = [];
            }
            levels[depth].push(mapId);
            
            // Find all connected rooms via warps
            const room = network.get(mapId);
            if (room && room.connections) {
                for (const connection of room.connections) {
                    const destMapId = connection.toMapId;
                    if (!visited.has(destMapId) && network.has(destMapId)) {
                        visited.add(destMapId);
                        queue.push({ mapId: destMapId, depth: depth + 1 });
                    }
                }
            }
        }
        
        // Add any disconnected rooms to the bottom level
        for (const mapId of allMapIds) {
            if (!visited.has(mapId)) {
                const lastLevel = levels.length;
                if (!levels[lastLevel]) {
                    levels[lastLevel] = [];
                }
                levels[lastLevel].push(mapId);
            }
        }
        
        Logger.log(`Tree layout: ${levels.length} levels`);
        levels.forEach((level, i) => {
            Logger.log(`  Level ${i}: ${level.length} rooms (${level.join(', ')})`);
        });
        
        // Assign grid positions based on tree structure
        // Each level is a row, rooms spread horizontally
        for (let depth = 0; depth < levels.length; depth++) {
            const levelRooms = levels[depth];
            const roomCount = levelRooms.length;
            
            // Center rooms horizontally for this level
            for (let i = 0; i < roomCount; i++) {
                const mapId = levelRooms[i];
                const gridX = i - Math.floor(roomCount / 2); // Center around 0
                const gridY = depth;
                
                positions.set(mapId, { gridX, gridY, level: depth });
            }
        }
        
        // Calculate actual pixel offsets
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const [mapId, roomData] of network) {
            const pos = positions.get(mapId);
            minX = Math.min(minX, pos.gridX);
            minY = Math.min(minY, pos.gridY);
            maxX = Math.max(maxX, pos.gridX);
            maxY = Math.max(maxY, pos.gridY);
        }
        
        // Normalize to start at (0, 0) and calculate pixel offsets
        const ROOM_SPACING_BLOCKS = 3; // Space between rooms in blocks (increased for tree layout)
        const LEVEL_SPACING_BLOCKS = 4; // Vertical spacing between levels
        
        // Build rooms array: root map first (for highlighting), then by tree level order
        const roomsOrder = [rootMapId];
        for (const level of levels) {
            for (const mapId of level) {
                if (mapId !== rootMapId) {
                    roomsOrder.push(mapId);
                }
            }
        }
        
        for (const mapId of roomsOrder) {
            const roomData = network.get(mapId);
            const pos = positions.get(mapId);
            const normalizedX = pos.gridX - minX;
            const normalizedY = pos.gridY - minY;
            
            // Calculate cumulative offset based on room sizes and tree structure
            let offsetX = 0;
            let offsetY = 0;
            
            // For horizontal offset: sum widths of rooms to the left in same level
            for (const [otherMapId, otherData] of network) {
                const otherPos = positions.get(otherMapId);
                if (otherPos.gridY === pos.gridY && otherPos.gridX < pos.gridX) {
                    offsetX += otherData.mapData.width + ROOM_SPACING_BLOCKS;
                }
            }
            
            // For vertical offset: sum heights of all rooms in levels above, plus spacing
            for (let level = 0; level < pos.gridY; level++) {
                // Find max height in this level
                let maxHeightInLevel = 0;
                for (const [otherMapId, otherData] of network) {
                    const otherPos = positions.get(otherMapId);
                    if (otherPos.gridY === level) {
                        maxHeightInLevel = Math.max(maxHeightInLevel, otherData.mapData.height);
                    }
                }
                offsetY += maxHeightInLevel + LEVEL_SPACING_BLOCKS;
            }
            
            rooms.push({
                mapId,
                mapData: roomData.mapData,
                warps: roomData.warps,
                connections: roomData.connections,
                gridX: normalizedX,
                gridY: normalizedY,
                level: pos.level,
                offsetX: offsetX,
                offsetY: offsetY
            });
        }
        
        return {
            rootMapId: rootMapId,
            rooms,
            gridWidth: maxX - minX + 1,
            gridHeight: maxY - minY + 1,
            totalWidth: rooms.reduce((max, r) => Math.max(max, r.offsetX + r.mapData.width), 0),
            totalHeight: rooms.reduce((max, r) => Math.max(max, r.offsetY + r.mapData.height), 0)
        };
    }
    
    /**
     * Set the current active layout for rendering
     * @param {Object} layout - Layout data
     */
    setCurrentLayout(layout) {
        this.currentLayout = layout;
        Logger.log(`Active layout set: ${layout.rooms.length} rooms`);
    }
    
    /**
     * Get the current active layout
     * @returns {Object|null} Current layout or null
     */
    getCurrentLayout() {
        return this.currentLayout;
    }
    
    /**
     * Clear the current layout
     */
    clearCurrentLayout() {
        this.currentLayout = null;
        Logger.log('Active layout cleared');
    }
    
    /**
     * Clear the layout cache
     */
    clearCache() {
        this.layoutCache.clear();
        Logger.log('Layout cache cleared');
    }
}
