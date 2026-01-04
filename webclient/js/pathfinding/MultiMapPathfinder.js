/**
 * MultiMapPathfinder.js
 * 
 * Handles pathfinding across multiple connected maps with border crossing logic.
 * Calculates paths for each map segment and generates border crossing transitions.
 */

import { Logger } from '../utils/Logger.js';

export const MODULE_VERSION = '1.0.0';

export class MultiMapPathfinder {
    constructor(mapCache, pathfinding, player) {
        this.mapCache = mapCache;
        this.pathfinding = pathfinding;
        this.player = player;
    }

    /**
     * Build paths for multi-map navigation route
     * @param {Array} mapRoute - Array of {mapId, direction, connection} from map graph search
     * @param {Object} finalDestination - Optional {mapId, x, y} for specific target location
     * @returns {Array} Array of path segments {mapId, path, borderExit, nextMapId}
     */
    buildMultiMapPath(mapRoute, finalDestination = null) {
        if (!mapRoute || mapRoute.length < 1) {
            Logger.warn('MultiMapPathfinder: Invalid map route');
            return [];
        }

        Logger.log(`🗺️ Building multi-map path for ${mapRoute.length} map(s)...`);
        Logger.log(`  📍 Route order: ${mapRoute.map((hop, i) => `${i}:Map${hop.mapId}`).join(' → ')}`);

        const pathSegments = [];

        for (let i = 0; i < mapRoute.length; i++) {
            const hop = mapRoute[i];
            const mapData = this.mapCache.getMap(hop.mapId);

            if (!mapData) {
                Logger.warn(`  ⚠️ Map ${hop.mapId} not found in cache`);
                continue;
            }

            // Calculate start point for this map segment
            const startPoint = this.calculateEntryPoint(mapRoute, i);
            if (!startPoint) {
                Logger.warn(`  ⚠️ Could not calculate entry point for map ${hop.mapId}`);
                continue;
            }

            // Calculate end point (border or final destination)
            const endPoint = this.calculateExitPoint(mapRoute, i, finalDestination);
            if (!endPoint) {
                Logger.warn(`  ⚠️ Could not calculate exit point for map ${hop.mapId}`);
                continue;
            }

            // Find path within this map from entry to exit
            const path = this.pathfinding.findPath(
                startPoint.x,
                startPoint.y,
                endPoint.x,
                endPoint.y,
                mapData
            );

            if (!path || path.length === 0) {
                Logger.warn(`  ⚠️ No path found for map ${hop.mapId} from (${startPoint.x},${startPoint.y}) to (${endPoint.x},${endPoint.y})`);
                continue;
            }

            // Determine if this segment needs a border crossing
            const isLastMap = (i === mapRoute.length - 1);
            const nextHop = isLastMap ? null : mapRoute[i + 1];
            const borderExit = isLastMap ? null : {
                direction: nextHop.direction,
                connection: mapData.connectionHeaders?.[nextHop.direction]
            };

            const nextMapId = isLastMap ? null : nextHop.mapId;

            pathSegments.push({
                mapId: hop.mapId,
                mapName: mapData.name,
                path: path,
                borderExit: borderExit,
                nextMapId: nextMapId,
                startPoint: startPoint,
                endPoint: endPoint
            });

            Logger.log(`  ✅ Map ${hop.mapId} (${mapData.name}): ${path.length} steps from (${startPoint.x},${startPoint.y}) to (${endPoint.x},${endPoint.y})`);
        }

        Logger.success(`✅ Built ${pathSegments.length} path segment(s)`);
        Logger.log(`  📋 Segment order: ${pathSegments.map((seg, i) => `${i}:Map${seg.mapId}`).join(' → ')}`);
        return pathSegments;
    }

    /**
     * Calculate entry point for a map in the route
     * @param {Array} mapRoute - Full route
     * @param {number} index - Current map index
     * @returns {Object} {x, y} entry point
     */
    calculateEntryPoint(mapRoute, index) {
        if (index === 0) {
            // First map - start from player's current position
            return {
                x: this.player.state.x,
                y: this.player.state.y
            };
        }

        // Entry from previous map's border
        // The direction tells us which way we're going (e.g., "north" means going north into this map)
        const currentHop = mapRoute[index];
        const prevHop = mapRoute[index - 1];
        const mapData = this.mapCache.getMap(currentHop.mapId);
        const prevMap = this.mapCache.getMap(prevHop.mapId);
        
        if (!mapData || !prevMap) return null;

        // The direction we're traveling is stored in currentHop
        const direction = currentHop.direction;
        const connection = prevMap.connectionHeaders?.[direction];

        if (!connection || !direction) {
            Logger.warn(`  ⚠️ No connection data for entry to map ${currentHop.mapId} (direction: ${direction})`);
            return null;
        }

        // Calculate entry point based on the direction we're traveling
        let entryX, entryY;
        const mapWidth = mapData.width * 2;  // Convert to player units
        const mapHeight = mapData.height * 2;

        switch (direction) {
            case 'north':
                // Going north into this map, enter at bottom edge
                // Alignment tells us horizontal offset from center
                entryX = connection.xAlignment !== undefined
                    ? Math.floor(mapWidth / 2) - connection.xAlignment
                    : Math.floor(mapWidth / 2);
                entryY = mapHeight - 1;
                break;
            case 'south':
                // Going south into this map, enter at top edge
                entryX = connection.xAlignment !== undefined
                    ? Math.floor(mapWidth / 2) - connection.xAlignment
                    : Math.floor(mapWidth / 2);
                entryY = 0;
                break;
            case 'west':
                // Going west into this map, enter at right edge
                entryX = mapWidth - 1;
                entryY = connection.yAlignment !== undefined
                    ? Math.floor(mapHeight / 2) - connection.yAlignment
                    : Math.floor(mapHeight / 2);
                break;
            case 'east':
                // Going east into this map, enter at left edge
                entryX = 0;
                entryY = connection.yAlignment !== undefined
                    ? Math.floor(mapHeight / 2) - connection.yAlignment
                    : Math.floor(mapHeight / 2);
                break;
            default:
                Logger.warn(`  ⚠️ Unknown direction: ${direction}`);
                return null;
        }

        // Find nearest walkable tile if the calculated entry point is not walkable
        const walkableEntry = this.findNearestWalkable(entryX, entryY, mapData, direction);
        return walkableEntry || { x: entryX, y: entryY };
    }

    /**
     * Calculate exit point for a map in the route
     * @param {Array} mapRoute - Full route
     * @param {number} index - Current map index
     * @param {Object} finalDestination - Optional final destination
     * @returns {Object} {x, y} exit point
     */
    calculateExitPoint(mapRoute, index, finalDestination = null) {
        const currentHop = mapRoute[index];
        const mapData = this.mapCache.getMap(currentHop.mapId);
        
        if (!mapData) return null;

        const isLastMap = (index === mapRoute.length - 1);

        if (isLastMap) {
            // Last map - use final destination or center
            if (finalDestination && finalDestination.mapId === currentHop.mapId) {
                return {
                    x: finalDestination.x,
                    y: finalDestination.y
                };
            } else {
                // Default to center of map
                const centerX = Math.floor(mapData.width);
                const centerY = Math.floor(mapData.height);
                const walkableCenter = this.mapCache.findWalkableTile(mapData.mapId, this.player);
                return walkableCenter || { x: centerX, y: centerY };
            }
        }

        // Intermediate map - exit at border toward next map
        // The direction is stored in the NEXT hop, not current
        const nextHop = mapRoute[index + 1];
        const direction = nextHop?.direction;
        const connection = mapData.connectionHeaders?.[direction];

        if (!direction) {
            Logger.warn(`  ⚠️ No exit direction for map ${currentHop.mapId} (next hop has no direction)`);
            return null;
        }

        let exitX, exitY;
        const mapWidth = mapData.width * 2;  // Convert to player units
        const mapHeight = mapData.height * 2;

        switch (direction) {
            case 'north':
                // Exit at top edge, centered horizontally (or use alignment if available)
                exitX = connection && connection.xAlignment !== undefined 
                    ? Math.floor(mapWidth / 2) - connection.xAlignment 
                    : Math.floor(mapWidth / 2);
                exitY = 0;
                break;
            case 'south':
                // Exit at bottom edge, centered horizontally (or use alignment if available)
                exitX = connection && connection.xAlignment !== undefined
                    ? Math.floor(mapWidth / 2) - connection.xAlignment
                    : Math.floor(mapWidth / 2);
                exitY = mapHeight - 1;
                break;
            case 'west':
                // Exit at left edge, centered vertically (or use alignment if available)
                exitX = 0;
                exitY = connection && connection.yAlignment !== undefined
                    ? Math.floor(mapHeight / 2) - connection.yAlignment
                    : Math.floor(mapHeight / 2);
                break;
            case 'east':
                // Exit at right edge, centered vertically (or use alignment if available)
                exitX = mapWidth - 1;
                exitY = connection && connection.yAlignment !== undefined
                    ? Math.floor(mapHeight / 2) - connection.yAlignment
                    : Math.floor(mapHeight / 2);
                break;
            default:
                Logger.warn(`  ⚠️ Unknown exit direction: ${direction}`);
                return null;
        }

        // Find nearest walkable tile at the border
        const walkableExit = this.findNearestWalkable(exitX, exitY, mapData, direction);
        return walkableExit || { x: exitX, y: exitY };
    }

    /**
     * Find nearest walkable tile near a target position
     * @param {number} x - Target X
     * @param {number} y - Target Y
     * @param {Object} mapData - Map data
     * @param {string} direction - Border direction (for searching perpendicular)
     * @param {number} maxRadius - Maximum search radius
     * @returns {Object|null} {x, y} or null
     */
    findNearestWalkable(x, y, mapData, direction = null, maxRadius = 5) {
        // Check if target is already walkable
        if (this.player.isWalkable(x, y, mapData)) {
            return { x, y };
        }

        // Search in expanding radius
        for (let radius = 1; radius <= maxRadius; radius++) {
            // Determine search pattern based on direction
            const searchPositions = [];

            if (direction === 'north' || direction === 'south') {
                // Search horizontally along the border
                searchPositions.push(
                    { x: x - radius, y: y },
                    { x: x + radius, y: y }
                );
            } else if (direction === 'west' || direction === 'east') {
                // Search vertically along the border
                searchPositions.push(
                    { x: x, y: y - radius },
                    { x: x, y: y + radius }
                );
            } else {
                // Search in all directions
                searchPositions.push(
                    { x: x - radius, y: y },
                    { x: x + radius, y: y },
                    { x: x, y: y - radius },
                    { x: x, y: y + radius }
                );
            }

            // Check each position
            for (const pos of searchPositions) {
                if (pos.x >= 0 && pos.x < mapData.width * 2 &&
                    pos.y >= 0 && pos.y < mapData.height * 2 &&
                    this.player.isWalkable(pos.x, pos.y, mapData)) {
                    if (radius > 0) {
                        Logger.log(`  📍 Found walkable at (${pos.x}, ${pos.y}) [radius ${radius}]`);
                    }
                    return pos;
                }
            }
        }

        Logger.warn(`  ⚠️ No walkable tile found near (${x}, ${y})`);
        return null;
    }
}
