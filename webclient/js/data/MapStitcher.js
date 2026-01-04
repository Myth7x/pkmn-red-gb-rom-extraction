/**
 * MapStitcher.js
 * 
 * Stitches all overworld maps together into a single unified world map.
 * Calculates global coordinates for each map based on connection data.
 * Eliminates the need for map loading on boundary crossings.
 */

import { Logger } from '../utils/Logger.js';

export const MODULE_VERSION = '1.0.0';

/**
 * MapStitcher - Creates a seamless world from connected maps
 */
export class MapStitcher {
    constructor() {
        // Map positioning data
        this.mapPositions = new Map(); // mapId -> {x, y, width, height}
        this.worldBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        
        // Stitched world data
        this.isStitched = false;
    }
    
    /**
     * Build a stitched world from all maps with connections
     * @param {Map} maps - Map of all cached maps (mapId -> mapData)
     * @param {Map} connections - Map of all connections (mapId -> connection data)
     * @returns {Promise<void>}
     */
    async stitchWorld(maps, connections) {
        Logger.log('🧵 Starting world map stitching...');
        const startTime = performance.now();
        
        // Find a good starting map (prefer Pallet Town as origin)
        const startMapId = this._findStartingMap(maps);
        const startMap = maps.get(startMapId);
        
        if (!startMap) {
            Logger.error('❌ Could not find starting map for stitching');
            return;
        }
        
        Logger.log(`📍 Starting stitch from Map ${startMapId}: ${startMap.name}`);
        
        // Place starting map at origin (0, 0)
        this.mapPositions.set(startMapId, {
            x: 0,
            y: 0,
            width: startMap.width,
            height: startMap.height,
            mapId: startMapId,
            name: startMap.name
        });
        
        // Process all connected maps using BFS
        const queue = [startMapId];
        const visited = new Set([startMapId]);
        
        while (queue.length > 0) {
            const currentMapId = queue.shift();
            const currentPos = this.mapPositions.get(currentMapId);
            const currentMap = maps.get(currentMapId);
            const currentConnections = connections.get(currentMapId);
            
            if (!currentConnections) continue;
            
            // Process each direction
            const directions = ['north', 'south', 'east', 'west'];
            for (const direction of directions) {
                const connection = currentConnections[direction];
                if (!connection || connection.connectedMap === undefined) continue;
                
                const connectedMapId = connection.connectedMap;
                
                // Skip if already positioned
                if (visited.has(connectedMapId)) continue;
                
                const connectedMap = maps.get(connectedMapId);
                if (!connectedMap) continue;
                
                // Calculate position of connected map based on direction and alignment
                const connectedPos = this._calculateConnectedMapPosition(
                    currentPos,
                    currentMap,
                    connectedMap,
                    connection,
                    direction
                );
                
                this.mapPositions.set(connectedMapId, connectedPos);
                visited.add(connectedMapId);
                queue.push(connectedMapId);
                
                Logger.log(`   📐 Positioned Map ${connectedMapId} (${connectedMap.name}) at (${connectedPos.x}, ${connectedPos.y}) [${direction}]`);
            }
        }
        
        // Calculate world bounds
        this._calculateWorldBounds();
        
        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        this.isStitched = true;
        Logger.success(`✅ World stitched! ${this.mapPositions.size} maps positioned in ${duration}s`);
        Logger.info(`🌍 World bounds: (${this.worldBounds.minX}, ${this.worldBounds.minY}) to (${this.worldBounds.maxX}, ${this.worldBounds.maxY})`);
        Logger.info(`📏 World size: ${this.worldBounds.maxX - this.worldBounds.minX} x ${this.worldBounds.maxY - this.worldBounds.minY} blocks`);
    }
    
    /**
     * Find a suitable starting map for stitching (prefer Pallet Town)
     * @private
     */
    _findStartingMap(maps) {
        // Prefer Pallet Town as origin
        for (const [mapId, mapData] of maps.entries()) {
            if (mapData.name && mapData.name.includes('Pallet')) {
                return mapId;
            }
        }
        
        // Fallback: find any outdoor map with connections
        for (const [mapId, mapData] of maps.entries()) {
            if (mapData.connections && Object.keys(mapData.connections).length > 0) {
                return mapId;
            }
        }
        
        // Last resort: first map
        return maps.keys().next().value;
    }
    
    /**
     * Calculate position of a connected map relative to current map
     * @private
     */
    _calculateConnectedMapPosition(currentPos, currentMap, connectedMap, connection, direction) {
        // Connection alignment values from ROM
        // xAlignment and yAlignment represent offset in blocks (negative values)
        const xAlignment = connection.xAlignment || 0;
        const yAlignment = connection.yAlignment || 0;
        
        // Calculate offset in blocks (ROM uses negative alignment)
        const offsetX = -xAlignment / 2; // Convert to blocks
        const offsetY = -yAlignment / 2; // Convert to blocks
        
        let x, y;
        
        switch (direction) {
            case 'north':
                // Connected map is above current map
                x = currentPos.x + offsetX;
                y = currentPos.y - connectedMap.height;
                break;
                
            case 'south':
                // Connected map is below current map
                x = currentPos.x + offsetX;
                y = currentPos.y + currentMap.height;
                break;
                
            case 'west':
                // Connected map is to the left of current map
                x = currentPos.x - connectedMap.width;
                y = currentPos.y + offsetY;
                break;
                
            case 'east':
                // Connected map is to the right of current map
                x = currentPos.x + currentMap.width;
                y = currentPos.y + offsetY;
                break;
                
            default:
                x = currentPos.x;
                y = currentPos.y;
        }
        
        return {
            x,
            y,
            width: connectedMap.width,
            height: connectedMap.height,
            mapId: connectedMap.mapId,
            name: connectedMap.name
        };
    }
    
    /**
     * Calculate world bounds from all positioned maps
     * @private
     */
    _calculateWorldBounds() {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const pos of this.mapPositions.values()) {
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x + pos.width);
            maxY = Math.max(maxY, pos.y + pos.height);
        }
        
        this.worldBounds = { minX, minY, maxX, maxY };
    }
    
    /**
     * Get global coordinates for a map
     * @param {number} mapId - Map ID
     * @returns {Object|null} - {x, y, width, height} or null if not found
     */
    getMapPosition(mapId) {
        return this.mapPositions.get(mapId) || null;
    }
    
    /**
     * Convert local map coordinates to global world coordinates
     * @param {number} mapId - Map ID
     * @param {number} localX - Local X in blocks or player units
     * @param {number} localY - Local Y in blocks or player units
     * @returns {Object|null} - {x, y} or null if map not found
     */
    localToGlobal(mapId, localX, localY) {
        const mapPos = this.mapPositions.get(mapId);
        if (!mapPos) return null;
        
        return {
            x: mapPos.x + localX,
            y: mapPos.y + localY
        };
    }
    
    /**
     * Convert global world coordinates to local map coordinates
     * @param {number} globalX - Global X coordinate
     * @param {number} globalY - Global Y coordinate
     * @returns {Object|null} - {mapId, x, y} or null if no map at position
     */
    globalToLocal(globalX, globalY) {
        // Find which map contains this global position
        for (const [mapId, pos] of this.mapPositions.entries()) {
            if (globalX >= pos.x && globalX < pos.x + pos.width &&
                globalY >= pos.y && globalY < pos.y + pos.height) {
                return {
                    mapId,
                    x: globalX - pos.x,
                    y: globalY - pos.y
                };
            }
        }
        
        return null;
    }
    
    /**
     * Get all maps that intersect with a viewport rectangle
     * @param {number} viewX - Viewport X in global coordinates (blocks)
     * @param {number} viewY - Viewport Y in global coordinates (blocks)
     * @param {number} viewWidth - Viewport width in blocks
     * @param {number} viewHeight - Viewport height in blocks
     * @returns {Array} - Array of {mapId, x, y, width, height}
     */
    getVisibleMaps(viewX, viewY, viewWidth, viewHeight) {
        const visible = [];
        
        for (const [mapId, pos] of this.mapPositions.entries()) {
            // Check if map rectangle intersects with viewport rectangle
            if (this._rectanglesIntersect(
                viewX, viewY, viewWidth, viewHeight,
                pos.x, pos.y, pos.width, pos.height
            )) {
                visible.push({
                    mapId,
                    ...pos
                });
            }
        }
        
        return visible;
    }
    
    /**
     * Check if two rectangles intersect
     * @private
     */
    _rectanglesIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
        return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1);
    }
    
    /**
     * Get which map is at a specific global position
     * @param {number} globalBlockX - Global X coordinate in blocks
     * @param {number} globalBlockY - Global Y coordinate in blocks
     * @returns {Object|null} - {mapId, x, y, width, height} or null if no map at position
     */
    getMapAtPosition(globalBlockX, globalBlockY) {
        for (const [mapId, pos] of this.mapPositions.entries()) {
            // Check if position is within this map's bounds
            if (globalBlockX >= pos.x && 
                globalBlockX < pos.x + pos.width &&
                globalBlockY >= pos.y && 
                globalBlockY < pos.y + pos.height) {
                return {
                    mapId,
                    ...pos
                };
            }
        }
        return null;
    }
    
    /**
     * Get world bounds
     * @returns {Object} - {minX, minY, maxX, maxY}
     */
    getWorldBounds() {
        return { ...this.worldBounds };
    }
    
    /**
     * Check if stitching is complete
     * @returns {boolean}
     */
    isReady() {
        return this.isStitched;
    }
    
    /**
     * Get total number of stitched maps
     * @returns {number}
     */
    getStitchedMapCount() {
        return this.mapPositions.size;
    }
}
