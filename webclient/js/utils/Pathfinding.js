/**
 * Pathfinding.js
 * 
 * A* pathfinding algorithm for player movement
 */

export const MODULE_VERSION = '1.0.0';

/**
 * A* pathfinding implementation
 */
export class Pathfinding {
    constructor(player, tilesetManager) {
        this.player = player;
        this.tilesetManager = tilesetManager;
    }

    /**
     * Find path from start to goal using A* algorithm with GLOBAL coordinates (stitched world)
     * @param {number} startX - Start X in player units (global)
     * @param {number} startY - Start Y in player units (global)
     * @param {number} goalX - Goal X in player units (global)
     * @param {number} goalY - Goal Y in player units (global)
     * @param {Object} currentMap - Current map data (optional, for backwards compatibility)
     * @param {boolean} useGlobalCoords - Whether to use global coordinates (default: true for new system)
     * @returns {Array} - Array of {x, y} positions in player units, or null if no path
     */
    findPath(startX, startY, goalX, goalY, currentMap, useGlobalCoords = false) {
        // If using global coordinates (stitched world system)
        if (useGlobalCoords) {
            return this.findPathGlobal(startX, startY, goalX, goalY);
        }
        
        // Legacy local coordinate system
        // Check if goal is walkable
        if (!this.player.isWalkable(goalX, goalY, currentMap)) {
            return null;
        }

        // If already at goal
        if (startX === goalX && startY === goalY) {
            return [];
        }

        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${startX},${startY}`;
        const goalKey = `${goalX},${goalY}`;

        // Initialize scores
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startX, startY, goalX, goalY));
        
        openSet.push({ x: startX, y: startY, f: fScore.get(startKey) });

        let iterations = 0;
        const maxIterations = 1000; // Prevent infinite loops

        while (openSet.length > 0 && iterations < maxIterations) {
            iterations++;

            // Sort by f score and get node with lowest f score
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = `${current.x},${current.y}`;

            // Check if we reached the goal
            if (current.x === goalX && current.y === goalY) {
                return this.reconstructPath(cameFrom, currentKey);
            }

            closedSet.add(currentKey);

            // Check all neighbors (up, down, left, right)
            const neighbors = [
                { x: current.x, y: current.y - 1 }, // Up
                { x: current.x, y: current.y + 1 }, // Down
                { x: current.x - 1, y: current.y }, // Left
                { x: current.x + 1, y: current.y }  // Right
            ];

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;

                // Skip if already evaluated
                if (closedSet.has(neighborKey)) {
                    continue;
                }

                // Skip if not walkable
                if (!this.player.isWalkable(neighbor.x, neighbor.y, currentMap)) {
                    continue;
                }

                // Calculate tentative g score
                const tentativeGScore = gScore.get(currentKey) + 1;

                // Check if this path to neighbor is better
                if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                    // This is a better path
                    cameFrom.set(neighborKey, currentKey);
                    gScore.set(neighborKey, tentativeGScore);
                    const h = this.heuristic(neighbor.x, neighbor.y, goalX, goalY);
                    const f = tentativeGScore + h;
                    fScore.set(neighborKey, f);

                    // Add to open set if not already there
                    if (!openSet.find(n => n.x === neighbor.x && n.y === neighbor.y)) {
                        openSet.push({ x: neighbor.x, y: neighbor.y, f });
                    }
                }
            }
        }

        return null; // No path found
    }

    /**
     * Heuristic function for A* (Manhattan distance)
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @returns {number}
     */
    heuristic(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    /**
     * Reconstruct path from cameFrom map
     * @param {Map} cameFrom
     * @param {string} currentKey
     * @returns {Array} - Array of {x, y} positions
     */
    reconstructPath(cameFrom, currentKey) {
        const path = [];
        const [x, y] = currentKey.split(',').map(Number);
        path.push({ x, y });

        while (cameFrom.has(currentKey)) {
            currentKey = cameFrom.get(currentKey);
            const [x, y] = currentKey.split(',').map(Number);
            path.unshift({ x, y }); // Add to beginning
        }

        // Remove the first position (current position)
        path.shift();

        return path;
    }

    /**
     * Find path using GLOBAL coordinates (stitched world system)
     * Works across map boundaries using MapCache coordinate conversion
     * @param {number} startX - Start X in global player units
     * @param {number} startY - Start Y in global player units
     * @param {number} goalX - Goal X in global player units
     * @param {number} goalY - Goal Y in global player units
     * @returns {Array} - Array of {x, y} positions in GLOBAL player units, or null if no path
     */
    findPathGlobal(startX, startY, goalX, goalY) {
        // Check if goal is walkable using GLOBAL coordinates
        if (!this.player.isWalkable(goalX, goalY, null, true)) {
            return null;
        }

        // If already at goal
        if (startX === goalX && startY === goalY) {
            return [];
        }

        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${startX},${startY}`;
        const goalKey = `${goalX},${goalY}`;

        // Initialize scores
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startX, startY, goalX, goalY));
        
        openSet.push({ x: startX, y: startY, f: fScore.get(startKey) });

        let iterations = 0;
        const maxIterations = 2000; // Higher limit for cross-map pathfinding

        while (openSet.length > 0 && iterations < maxIterations) {
            iterations++;

            // Sort by f score and get node with lowest f score
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = `${current.x},${current.y}`;

            // Check if we reached the goal
            if (current.x === goalX && current.y === goalY) {
                return this.reconstructPath(cameFrom, currentKey);
            }

            closedSet.add(currentKey);

            // Check all neighbors (up, down, left, right)
            const neighbors = [
                { x: current.x, y: current.y - 1 }, // Up
                { x: current.x, y: current.y + 1 }, // Down
                { x: current.x - 1, y: current.y }, // Left
                { x: current.x + 1, y: current.y }  // Right
            ];

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;

                // Skip if already evaluated
                if (closedSet.has(neighborKey)) {
                    continue;
                }

                // Skip if not walkable - USE GLOBAL COORDINATES
                if (!this.player.isWalkable(neighbor.x, neighbor.y, null, true)) {
                    continue;
                }

                // Calculate tentative g score
                const tentativeGScore = gScore.get(currentKey) + 1;

                // Check if this path to neighbor is better
                if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                    // This is a better path
                    cameFrom.set(neighborKey, currentKey);
                    gScore.set(neighborKey, tentativeGScore);
                    const h = this.heuristic(neighbor.x, neighbor.y, goalX, goalY);
                    const f = tentativeGScore + h;
                    fScore.set(neighborKey, f);

                    // Add to open set if not already there
                    if (!openSet.find(n => n.x === neighbor.x && n.y === neighbor.y)) {
                        openSet.push({ x: neighbor.x, y: neighbor.y, f });
                    }
                }
            }
        }

        return null; // No path found
    }
}
