/**
 * Player.js
 * 
 * Handles player rendering, input, and movement.
 * Only active in game mode.
 */

import { PlayerState } from '../state/PlayerState.js';
import { TILE_SIZE } from '../core/Constants.js';
import { MovementQueue } from '../pathfinding/MovementQueue.js';

export const MODULE_VERSION = '1.1.0';

export class Player {
    constructor(spriteManager, mapDataManager, tilesetManager, mapCache = null, mapStitcher = null) {
        this.spriteManager = spriteManager;
        this.mapDataManager = mapDataManager;
        this.tilesetManager = tilesetManager;
        this.mapCache = mapCache; // For global coordinate conversion
        this.mapStitcher = mapStitcher; // For seamless world coordinate lookups
        this.state = new PlayerState();
        
        // Global coordinates (for seamless world)
        this.globalX = 0; // Global X in player units
        this.globalY = 0; // Global Y in player units
        this.globalPixelX = 0; // Global X in pixels
        this.globalPixelY = 0; // Global Y in pixels
        
        // Current map ID (for tracking which map player is on)
        this.currentMapId = null;
        
        // Input state
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false
        };
        
        // Movement speed (tiles per second)
        this.moveSpeed = 4;
        
        // Last update time
        this.lastUpdateTime = performance.now();
        
        // Warp tracking (to prevent re-triggering on spawn)
        this.lastWarpPosition = null; // {x, y, mapId}
        this.canTriggerWarp = false; // Set to false after warping, true after moving off warp
        
        // Movement lock (for map transitions)
        this.isMovementLocked = false;
        this.movementLockTimeout = null;
        
        // NEW: Multi-map movement queue system
        this.movementQueue = new MovementQueue();
        
        // LEGACY: Keep for backwards compatibility during transition
        this.navigationRoute = null; // Array of {mapId, direction, connection}
        this.finalDestination = null; // {mapId, x, y} - final destination for multi-hop routes
        this.currentPath = null; // Array of {x, y} positions for current map segment
        this.pathIndex = 0; // Current position in path
        this.isGlobalPath = false; // Whether currentPath uses global coordinates
        this.fullMultiMapPath = null; // {currentMapPath: [...], neighborPaths: {mapId: [...]}} - complete visualization
        this.mapPathQueue = null; // Array of {mapId, path, direction} - paths for each map in sequence
        this.currentQueueIndex = 0; // Current path in the queue
        
        // Setup input listeners
        this.setupInputListeners();
    }
    
    /**
     * Setup keyboard input listeners
     */
    setupInputListeners() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }
    
    /**
     * Handle key down event
     * @param {KeyboardEvent} e
     */
    handleKeyDown(e) {
        switch (e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.keys.up = true;
                e.preventDefault();
                break;
            case 's':
            case 'arrowdown':
                this.keys.down = true;
                e.preventDefault();
                break;
            case 'a':
            case 'arrowleft':
                this.keys.left = true;
                e.preventDefault();
                break;
            case 'd':
            case 'arrowright':
                this.keys.right = true;
                e.preventDefault();
                break;
        }
    }
    
    /**
     * Handle key up event
     * @param {KeyboardEvent} e
     */
    handleKeyUp(e) {
        switch (e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.keys.up = false;
                break;
            case 's':
            case 'arrowdown':
                this.keys.down = false;
                break;
            case 'a':
            case 'arrowleft':
                this.keys.left = false;
                break;
            case 'd':
            case 'arrowright':
                this.keys.right = false;
                break;
        }
    }
    
    /**
     * Spawn player at a position
     * @param {number} x - X position in player units (16-pixel tiles)
     * @param {number} y - Y position in player units (16-pixel tiles)
     * @param {number} mapId - Map ID
     * @param {string} mapName - Map name
     * @param {PreferencesManager} preferences - Optional preferences manager to save state
     * @param {number} facing - Optional facing direction (0x00=DOWN, 0x04=UP, 0x08=LEFT, 0x0C=RIGHT)
     */
    spawn(x, y, mapId, mapName, preferences = null, facing = null) {
        this.state.setPosition(x, y);
        this.state.setMap(mapId, mapName);
        this.currentMapId = mapId;
        
        // Calculate global coordinates if mapCache is available
        if (this.mapCache && this.mapCache.isReady()) {
            const globalPos = this.mapCache.localToGlobal(mapId, x, y);
            if (globalPos) {
                this.globalX = globalPos.x;
                this.globalY = globalPos.y;
                this.globalPixelX = globalPos.x * 16;
                this.globalPixelY = globalPos.y * 16;
                console.log(`[Player] Global position: (${this.globalX}, ${this.globalY}) player units, (${this.globalPixelX}, ${this.globalPixelY}) pixels`);
            }
        }
        
        // Set facing direction if provided
        if (facing !== null) {
            this.state.setFacing(facing);
        }
        
        console.log(`[Player] Spawned at playerUnit (${x}, ${y}) on map ${mapName} (ID: ${mapId}), facing ${facing !== null ? '0x' + facing.toString(16).padStart(2, '0') : 'default'}`);
        console.log(`[Player] Pixel position: (${this.state.pixelX}, ${this.state.pixelY})`);
        
        // Save game state if preferences manager provided
        if (preferences) {
            preferences.saveGameState(mapId, x, y, this.state.facing);
        }
    }
    
    /**
     * Lock player movement (used during map transitions)
     * @param {number} duration - Duration in milliseconds (default: 200ms)
     */
    lockMovement(duration = 200) {
        this.isMovementLocked = true;
        
        // Clear any existing timeout
        if (this.movementLockTimeout) {
            clearTimeout(this.movementLockTimeout);
        }
        
        // Auto-unlock after duration
        this.movementLockTimeout = setTimeout(() => {
            this.unlockMovement();
        }, duration);
        
        console.log(`[Player] 🔒 Movement locked for ${duration}ms`);
    }
    
    /**
     * Unlock player movement
     */
    unlockMovement() {
        this.isMovementLocked = false;
        
        // Clear timeout if exists
        if (this.movementLockTimeout) {
            clearTimeout(this.movementLockTimeout);
            this.movementLockTimeout = null;
        }
        
        console.log(`[Player] 🔓 Movement unlocked`);
    }
    
    /**
     * Check if movement is currently locked
     * @returns {boolean}
     */
    isMovementBlocked() {
        return this.isMovementLocked;
    }
    
    /**
     * Get player's current global X coordinate (player units)
     * @returns {number} Global X position
     */
    getGlobalX() {
        if (this.mapStitcher && this.currentMapId !== null) {
            const mapPos = this.mapStitcher.getMapPosition(this.currentMapId);
            return (mapPos.x * 2) + this.state.x; // Convert blocks to player units and add local position
        }
        return this.state.x; // Fallback to local position
    }
    
    /**
     * Get player's current global Y coordinate (player units)
     * @returns {number} Global Y position
     */
    getGlobalY() {
        if (this.mapStitcher && this.currentMapId !== null) {
            const mapPos = this.mapStitcher.getMapPosition(this.currentMapId);
            return (mapPos.y * 2) + this.state.y; // Convert blocks to player units and add local position
        }
        return this.state.y; // Fallback to local position
    }
    
    /**
     * Check if tile is walkable
     * @param {number} x - X position in player units (16-pixel tiles) - local to current map OR global if useGlobalCoords=true
     * @param {number} y - Y position in player units (16-pixel tiles) - local to current map OR global if useGlobalCoords=true
     * @param {Object} currentMap - Current map data
     * @param {boolean} useGlobalCoords - If true, x/y are global coordinates; if false, they're local to currentMap
     * @returns {boolean}
     */
    isWalkable(x, y, currentMap, useGlobalCoords = false) {
        // USE MAPCACHE FOR COORDINATE CONVERSION if available
        if (this.mapCache && useGlobalCoords) {
            // MapCache.globalToLocal handles all coordinate conversion properly
            const localCoords = this.mapCache.globalToLocal(x, y);
            
            if (!localCoords) {
                return false;
            }
            
            // Get the actual map data
            const targetMap = this.mapCache.getMap(localCoords.mapId);
            if (!targetMap) {
                return false;
            }
            
            // Check walkability using local coordinates
            const walkable = this._checkLocalWalkability(localCoords.x, localCoords.y, targetMap);
            return walkable;
        }
        
        // USE MAPCACHE FOR LOCAL TO GLOBAL CONVERSION if available
        if (this.mapCache && !useGlobalCoords && this.currentMapId !== null) {
            // Use MapCache to convert local to global
            const globalCoords = this.mapCache.localToGlobal(this.currentMapId, x, y);
            if (!globalCoords) {
                if (!currentMap) return false;
                return this._checkLocalWalkability(x, y, currentMap);
            }
            
            // Now use global coordinate path with recursion
            return this.isWalkable(globalCoords.x, globalCoords.y, currentMap, true);
        }
        
        // FALLBACK: No MapCache or old-style check - Need currentMap
        if (!currentMap) {
            return false;
        }
        
        return this._checkLocalWalkability(x, y, currentMap);
    }
    
    /**
     * Check walkability within a single map (local coordinates)
     * @private
     */
    _checkLocalWalkability(x, y, mapData) {
        // Convert block dimensions to player units (each block is 32 pixels = 2 player units)
        const mapWidthPlayerUnits = mapData.width * 2;
        const mapHeightPlayerUnits = mapData.height * 2;
        
        // Check map boundaries
        if (x < 0 || y < 0 || x >= mapWidthPlayerUnits || y >= mapHeightPlayerUnits) {
            // In seamless world mode, boundaries are handled differently
            // The caller (isWalkable) already checked if this position is on another map
            // If we're here in seamless mode, it means the position is outside all maps
            return false;
        }
        
        // Get tile collision data
        // Player position is in 16-pixel units, but we need to check the 8-pixel tile collision
        // Each player unit covers 2 tiles (16px / 8px = 2), so we check the bottom-right tile of the player sprite
        const tileX = Math.floor(x * 2); // Convert player units to map tiles (×2)
        const tileY = Math.floor(y * 2); // Convert player units to map tiles (×2)
        
        // Player sprite is 16x16 (2x2 tiles), check bottom tiles for collision
        const tileX_left = tileX;
        const tileX_right = tileX + 1;
        const tileY_bottom = tileY + 1; // Bottom row of player sprite
        
        // Check both bottom tiles (left and right) for walkability
        const leftBottomWalkable = this.checkTileCollision(tileX_left, tileY_bottom, mapData);
        const rightBottomWalkable = this.checkTileCollision(tileX_right, tileY_bottom, mapData);
        
        const isWalkable = leftBottomWalkable && rightBottomWalkable;
        
        return isWalkable;
    }
    
    /**
     * Check collision for a specific tile
     * @param {number} tileX - Tile X position (in 8-pixel tiles)
     * @param {number} tileY - Tile Y position (in 8-pixel tiles)
     * @param {Object} currentMap - Current map data
     * @returns {boolean} - True if tile is walkable
     */
    checkTileCollision(tileX, tileY, currentMap) {
        // Convert tile position to block position
        const blockX = Math.floor(tileX / 4); // 4 tiles per block
        const blockY = Math.floor(tileY / 4);
        
        // Check block bounds
        if (blockX < 0 || blockY < 0 || blockX >= currentMap.width || blockY >= currentMap.height) {
            return false;
        }
        
        // Get block ID from map
        const blockIndex = blockY * currentMap.width + blockX;
        const blockId = currentMap.blockData[blockIndex];
        
        if (blockId === undefined) {
            console.warn(`[Player] ⚠️ No block at (${blockX}, ${blockY}), index ${blockIndex}`);
            return false;
        }
        
        // Get tile position within block (0-3 for each axis)
        const tileInBlockX = tileX % 4;
        const tileInBlockY = tileY % 4;
        
        // Get the actual tile ID from the block
        const tileId = this.tilesetManager.getTileInBlock(
            currentMap.tileset,
            blockId,
            tileInBlockY,
            tileInBlockX
        );
        
        if (tileId === null) {
            console.warn(`[Player] ⚠️ No tile at block(${blockX}, ${blockY})[${tileInBlockX}, ${tileInBlockY}]`);
            return false;
        }
        
        // Check for special tile types that are always walkable
        const isFlower = this.tilesetManager.isFlowerTile(currentMap.tileset, tileId);
        
        // Check if this tile position is a warp tile (convert 8px tile coords to 16px player coords)
        const playerX = Math.floor(tileX / 2);
        const playerY = Math.floor(tileY / 2);
        
        // Check warps on the map being tested (currentMap), not player's current map
        let isWarpTile = false;
        if (currentMap.objects && currentMap.objects.warps && currentMap.objects.warps.data) {
            for (const warp of currentMap.objects.warps.data) {
                if (warp.x === playerX && warp.y === playerY) {
                    isWarpTile = true;
                    break;
                }
            }
        }
        
        // Allow movement on warp tiles and flower tiles regardless of collision data
        if (isWarpTile || isFlower) {
            const tileType = isWarpTile ? '🚪warp' : '🌸flower';
            console.log(`[Player] 🔍 Tile(${tileX}, ${tileY}) = block(${blockX}, ${blockY})[${tileInBlockX}, ${tileInBlockY}] -> tileId:0x${tileId.toString(16).padStart(2, '0')} (${tileType}) on map ${currentMap.id} = ✅`);
            return true;
        }
        
        // Check if tile is passable
        const isPassable = this.tilesetManager.isTilePassable(currentMap.tileset, tileId);
        
        // Also allow grass and ledge tiles (these are walkable)
        const isGrass = this.tilesetManager.isGrassTile(currentMap.tileset, tileId);
        const isLedge = this.tilesetManager.isLedgeTile(tileId);
        
        // Tile is walkable if it's passable, grass, or a ledge
        const walkable = isPassable || isGrass || isLedge;
    
        return walkable;
    }
    
    /**
     * Check if a boundary position has a connected map
     * @param {number} x - X position in player units
     * @param {number} y - Y position in player units
     * @param {Object} currentMap - Current map data
     * @returns {boolean}
     */
    checkBoundaryConnection(x, y, currentMap) {
        if (!currentMap || !currentMap.connections) {
            return false;
        }
        
        const mapWidthPlayerUnits = currentMap.width * 2;
        const mapHeightPlayerUnits = currentMap.height * 2;
        
        // Check which boundary was crossed
        if (y < 0 && currentMap.connections.north) {
            return true;
        }
        if (y >= mapHeightPlayerUnits && currentMap.connections.south) {
            return true;
        }
        if (x < 0 && currentMap.connections.west) {
            return true;
        }
        if (x >= mapWidthPlayerUnits && currentMap.connections.east) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if player crossed a map boundary
     * @param {Object} currentMap - Current map data
     * @returns {Object|null} - Boundary crossing data or null
     */
    checkBoundaryCrossing(currentMap) {
        if (!currentMap) {
            return null;
        }
        
        const mapWidthPlayerUnits = currentMap.width * 2;
        const mapHeightPlayerUnits = currentMap.height * 2;
        const playerX = this.state.x;
        const playerY = this.state.y;
        
        // Check if player crossed any boundary
        if (playerY < 0 && currentMap.connections?.north && currentMap.connectionHeaders?.north) {
            console.log(`[Player] 🌐 Crossed NORTH boundary at (${playerX}, ${playerY})`);
            return {
                direction: 'north',
                connection: currentMap.connectionHeaders.north,
                playerX: playerX,
                playerY: playerY
            };
        }
        
        if (playerY >= mapHeightPlayerUnits && currentMap.connections?.south && currentMap.connectionHeaders?.south) {
            console.log(`[Player] 🌐 Crossed SOUTH boundary at (${playerX}, ${playerY})`);
            return {
                direction: 'south',
                connection: currentMap.connectionHeaders.south,
                playerX: playerX,
                playerY: playerY
            };
        }
        
        if (playerX < 0 && currentMap.connections?.west && currentMap.connectionHeaders?.west) {
            console.log(`[Player] 🌐 Crossed WEST boundary at (${playerX}, ${playerY})`);
            return {
                direction: 'west',
                connection: currentMap.connectionHeaders.west,
                playerX: playerX,
                playerY: playerY
            };
        }
        
        if (playerX >= mapWidthPlayerUnits && currentMap.connections?.east && currentMap.connectionHeaders?.east) {
            console.log(`[Player] 🌐 Crossed EAST boundary at (${playerX}, ${playerY})`);
            return {
                direction: 'east',
                connection: currentMap.connectionHeaders.east,
                playerX: playerX,
                playerY: playerY
            };
        }
        
        return null;
    }
    
    /**
     * Check if a position is on a warp tile
     * @param {number} x - X position in player units (local coordinates)
     * @param {number} y - Y position in player units (local coordinates)
     * @param {Object} currentMap - Current map data
     * @returns {boolean} - True if position is on a warp
     */
    isPositionOnWarp(x, y, currentMap) {
        // If we have MapCache and currentMapId, get the actual map the player is on
        if (this.mapCache && this.currentMapId !== null) {
            const actualMap = this.mapCache.getMap(this.currentMapId);
            if (actualMap && actualMap.objects && actualMap.objects.warps && actualMap.objects.warps.data) {
                for (const warp of actualMap.objects.warps.data) {
                    if (warp.x === x && warp.y === y) {
                        return true;
                    }
                }
            }
            return false;
        }
        
        // Fallback to passed currentMap
        if (!currentMap || !currentMap.objects || !currentMap.objects.warps || !currentMap.objects.warps.data) {
            return false;
        }
        
        for (const warp of currentMap.objects.warps.data) {
            if (warp.x === x && warp.y === y) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if player is standing on a warp tile
     * @param {Object} currentMap - Current map data (fallback if MapCache not available)
     * @returns {Object|null} - Warp data if on warp, null otherwise
     */
    getWarpAtPosition(currentMap) {
        // Get the actual map the player is currently on
        let mapToCheck = currentMap;
        
        if (this.mapCache && this.currentMapId !== null) {
            const actualMap = this.mapCache.getMap(this.currentMapId);
            if (actualMap) {
                mapToCheck = actualMap;
            }
        }
        
        if (!mapToCheck || !mapToCheck.objects || !mapToCheck.objects.warps || !mapToCheck.objects.warps.data) {
            return null;
        }
        
        // Check if player position matches any warp position
        const playerX = this.state.x;
        const playerY = this.state.y;
        
        for (const warp of mapToCheck.objects.warps.data) {
            // Warp coordinates from ROM are in PLAYER UNITS (same as player position)
            if (warp.x === playerX && warp.y === playerY) {
                console.log(`[Player.getWarpAtPosition] Found warp on map ${this.currentMapId} at (${playerX}, ${playerY})`);
                return warp;
            }
        }
        
        return null;
    }
    
    /**
     * Check if player should trigger a warp
     * @param {Object} currentMap - Current map data (fallback if MapCache not available)
     * @returns {Object|null} - Warp data if should warp, null otherwise
     */
    checkWarpTrigger(currentMap) {
        const warp = this.getWarpAtPosition(currentMap);
        
        if (!warp) {
            // Not on a warp, allow future warps
            if (this.lastWarpPosition) {
                this.canTriggerWarp = true;
                this.lastWarpPosition = null;
            }
            return null;
        }
        
        // On a warp tile - use currentMapId for tracking
        const mapId = this.currentMapId !== null ? this.currentMapId : (currentMap ? currentMap.mapId : 0);
        const currentWarpKey = `${warp.x},${warp.y},${mapId}`;
        const lastWarpKey = this.lastWarpPosition ? `${this.lastWarpPosition.x},${this.lastWarpPosition.y},${this.lastWarpPosition.mapId}` : null;
        
        // If this is the same warp we just came from and we can't trigger yet, don't warp
        if (currentWarpKey === lastWarpKey && !this.canTriggerWarp) {
            console.log(`[Player] 🔒 On spawn warp, not triggering yet`);
            return null;
        }
        
        // Trigger the warp!
        console.log(`[Player] 🚪 Triggering warp on map ${mapId} at (${warp.x}, ${warp.y})`);
        this.lastWarpPosition = { x: warp.x, y: warp.y, mapId: mapId };
        this.canTriggerWarp = false; // Don't re-trigger until we move off this warp
        
        return warp;
    }
    
    /**
     * Reset warp trigger after spawning on a warp tile
     * This prevents immediate re-warping after loading a new map
     * @param {number} x - Spawn X position
     * @param {number} y - Spawn Y position
     * @param {number} mapId - Map ID
     */
    setSpawnWarp(x, y, mapId) {
        this.lastWarpPosition = { x, y, mapId };
        this.canTriggerWarp = false;
        console.log(`[Player] 🔒 Spawn warp locked at (${x}, ${y}) on map ${mapId}`);
    }
    
    /**
     * Set a simple path for the player to follow (single map or global coordinates)
     * @param {Array} path - Array of {x, y} positions in player units
     * @param {boolean} isGlobalPath - Whether path uses global coordinates (default: false for backwards compatibility)
     */
    setPath(path, isGlobalPath = false) {
        if (!path || path.length === 0) {
            this.currentPath = null;
            this.pathIndex = 0;
            this.isGlobalPath = false;
            return;
        }
        
        this.currentPath = path;
        this.pathIndex = 0;
        this.isGlobalPath = isGlobalPath;
    }

    /**
     * Set a multi-map path using the new queue system
     * @param {Array} pathSegments - Array of path segments from MultiMapPathfinder
     */
    setMultiMapPath(pathSegments) {
        if (!pathSegments || pathSegments.length === 0) {
            console.warn('[Player] Cannot set empty multi-map path');
            return false;
        }

        // Initialize the movement queue
        const success = this.movementQueue.initialize(pathSegments);
        
        if (success) {
            // Clear legacy path tracking
            this.currentPath = null;
            this.pathIndex = 0;
            console.log('[Player] Multi-map movement queue activated');
        }
        
        return success;
    }

    /**
     * Clear the current path and movement queue
     */
    clearPath() {
        this.currentPath = null;
        this.pathIndex = 0;
        this.mapPathQueue = null;
        this.currentQueueIndex = 0;
        this.movementQueue.clear();
    }

    /**
     * Check if player is following a path (single map or queue)
     * @returns {boolean}
     */
    isFollowingPath() {
        // Check new queue system first
        if (this.movementQueue.isQueueActive()) {
            return true;
        }
        // Fallback to legacy system
        return this.currentPath !== null && this.pathIndex < this.currentPath.length;
    }

    /**
     * Get the current path (for rendering)
     * @returns {Array|null} - Array of {x, y} positions or null
     */
    getPath() {
        // Return queue path if active
        if (this.movementQueue.isQueueActive()) {
            return this.movementQueue.getCurrentPath();
        }
        // Fallback to legacy path
        return this.currentPath;
    }

    /**
     * Get current path index (for rendering)
     * @returns {number}
     */
    getPathIndex() {
        // Return queue index if active
        if (this.movementQueue.isQueueActive()) {
            return this.movementQueue.getCurrentPathIndex();
        }
        // Fallback to legacy index
        return this.pathIndex;
    }

    /**
     * Get the movement queue (for access from MapViewer)
     * @returns {MovementQueue}
     */
    getMovementQueue() {
        return this.movementQueue;
    }

    /**
     * Update player state
     * @param {Object} currentMap - Current map data
     * @param {PreferencesManager} preferences - Optional preferences manager to save state
     * @returns {Object|null} - Warp data if warp triggered, null otherwise
     */
    update(currentMap, preferences = null) {
        const now = performance.now();
        const delta = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;
        
        // Update movement if in progress
        if (this.state.isMoving) {
            this.state.updateMovement(delta, this.moveSpeed);
            this.state.updateAnimation(delta);
            
            // Update global pixel coordinates during smooth movement
            if (this.mapCache && this.mapCache.isReady()) {
                // Calculate global position from local pixel coordinates
                // Local pixel coords are interpolated, so we need to add them to the map's global offset
                const localPlayerUnitsX = this.state.pixelX / 16;
                const localPlayerUnitsY = this.state.pixelY / 16;
                const globalPos = this.mapCache.localToGlobal(currentMap.mapId, localPlayerUnitsX, localPlayerUnitsY);
                if (globalPos) {
                    this.globalX = globalPos.x;
                    this.globalY = globalPos.y;
                    this.globalPixelX = globalPos.x * 16;
                    this.globalPixelY = globalPos.y * 16;
                }
            }
            
            // Check for warp trigger after movement completes
            if (!this.state.isMoving) {
                // Save position after movement completes
                if (preferences) {
                    preferences.saveGameState(currentMap.mapId, this.state.x, this.state.y, this.state.facing);
                }
                
                // Check for boundary crossing first (takes priority over warps)
                const boundaryCrossing = this.checkBoundaryCrossing(currentMap);
                if (boundaryCrossing) {
                    return { type: 'boundary', ...boundaryCrossing };
                }
                
                const warp = this.checkWarpTrigger(currentMap);
                if (warp) {
                    return { type: 'warp', ...warp }; // Return warp data to trigger map transition
                }
            }
            return null;
        }
        
        // Don't process new movement if locked (during map transitions)
        if (this.isMovementLocked) {
            return null;
        }
        
        // Check for input and start new movement
        let newX = this.state.x;
        let newY = this.state.y;
        let newFacing = this.state.facing;
        let moveRequested = false;
        
        // Check if following a path (path movement has priority over keyboard)
        if (this.isFollowingPath()) {
            // NEW: Use MovementQueue if active
            if (this.movementQueue.isQueueActive()) {
                const nextStep = this.movementQueue.getCurrentStep();
                
                if (nextStep) {
                    // Calculate direction to next step
                    if (nextStep.x < this.state.x) {
                        newX = this.state.x - 1;
                        newFacing = 0x08; // LEFT
                        moveRequested = true;
                    } else if (nextStep.x > this.state.x) {
                        newX = this.state.x + 1;
                        newFacing = 0x0C; // RIGHT
                        moveRequested = true;
                    } else if (nextStep.y < this.state.y) {
                        newY = this.state.y - 1;
                        newFacing = 0x04; // UP
                        moveRequested = true;
                    } else if (nextStep.y > this.state.y) {
                        newY = this.state.y + 1;
                        newFacing = 0x00; // DOWN
                        moveRequested = true;
                    }
                    
                    // Advance to next step
                    this.movementQueue.advanceStep();
                } else {
                    // Reached end of current segment - check for border crossing
                    const borderCrossing = this.movementQueue.checkBorderCrossing();
                    
                    if (borderCrossing) {
                        const movement = this.movementQueue.getBorderCrossingMovement();
                        console.log(`[Player] 🗺️ Triggering border crossing ${borderCrossing.direction} to map ${borderCrossing.nextMapId}`);
                        
                        // Move in direction to trigger boundary crossing
                        newX = this.state.x + movement.dx;
                        newY = this.state.y + movement.dy;
                        
                        // Set facing direction
                        if (movement.dy < 0) newFacing = 0x04; // UP
                        else if (movement.dy > 0) newFacing = 0x00; // DOWN
                        else if (movement.dx < 0) newFacing = 0x08; // LEFT
                        else if (movement.dx > 0) newFacing = 0x0C; // RIGHT
                        
                        moveRequested = true;
                    } else {
                        // No more segments - path complete
                        console.log('[Player] ✅ Movement queue complete');
                        this.clearPath();
                    }
                }
            } 
            // LEGACY: Old path following system
            else if (this.currentPath) {
                const nextStep = this.currentPath[this.pathIndex];
                
                // If using global coordinates, get current global position
                let currentX, currentY;
                if (this.isGlobalPath) {
                    currentX = this.getGlobalX();
                    currentY = this.getGlobalY();
                } else {
                    currentX = this.state.x;
                    currentY = this.state.y;
                }
                
                // Calculate direction to next step
                if (nextStep.x < currentX) {
                    newX = this.state.x - 1;
                    newFacing = 0x08; // LEFT
                    moveRequested = true;
                } else if (nextStep.x > currentX) {
                    newX = this.state.x + 1;
                    newFacing = 0x0C; // RIGHT
                    moveRequested = true;
                } else if (nextStep.y < currentY) {
                    newY = this.state.y - 1;
                    newFacing = 0x04; // UP
                    moveRequested = true;
                } else if (nextStep.y > currentY) {
                    newY = this.state.y + 1;
                    newFacing = 0x00; // DOWN
                    moveRequested = true;
                }
                
                // Move to next step in path
                this.pathIndex++;
                
                // Check if reached end of current path
                if (this.pathIndex >= this.currentPath.length) {
                    // Check if we have more paths in the queue (legacy system)
                    if (this.mapPathQueue && this.currentQueueIndex < this.mapPathQueue.length - 1) {
                        const currentPathData = this.mapPathQueue[this.currentQueueIndex];
                        const nextPathData = this.mapPathQueue[this.currentQueueIndex + 1];
                        
                        // Get the direction to the next map from the current path data
                        const direction = currentPathData.direction;
                        
                        if (direction) {
                            // Automatically move in the direction of the next map to trigger boundary crossing
                            if (direction === 'north') {
                                newY = this.state.y - 1;
                                newFacing = 0x04; // UP
                                moveRequested = true;
                            } else if (direction === 'south') {
                                newY = this.state.y + 1;
                                newFacing = 0x00; // DOWN
                                moveRequested = true;
                            } else if (direction === 'west') {
                                newX = this.state.x - 1;
                                newFacing = 0x08; // LEFT
                                moveRequested = true;
                            } else if (direction === 'east') {
                                newX = this.state.x + 1;
                                newFacing = 0x0C; // RIGHT
                                moveRequested = true;
                            }
                            
                            // Clear current path - boundary transition will load next path from queue
                            this.currentPath = null;
                            this.pathIndex = 0;
                        } else {
                            this.clearPath();
                        }
                    } else if (this.navigationRoute && this.navigationRoute.length > 1) {
                        // Legacy fallback for old multi-hop system
                        const boundaryCrossing = this.checkBoundaryCrossing(currentMap);
                        this.clearPath();
                    } else {
                        // No boundary or no more paths to continue
                        this.clearPath();
                    }
                }
            }
        } else if (this.keys.up || this.keys.down || this.keys.left || this.keys.right) {
            // Manual keyboard movement (cancels any active path)
            this.clearPath();
            
            if (this.keys.up) {
                newY -= 1;
                newFacing = 0x04; // UP
                moveRequested = true;
            } else if (this.keys.down) {
                newY += 1;
                newFacing = 0x00; // DOWN
                moveRequested = true;
            } else if (this.keys.left) {
                newX -= 1;
                newFacing = 0x08; // LEFT
                moveRequested = true;
            } else if (this.keys.right) {
                newX += 1;
                newFacing = 0x0C; // RIGHT
                moveRequested = true;
            }
        }
        
        // Update facing direction
        if (moveRequested) {
            this.state.setFacing(newFacing);
            
            // Check if movement is valid
            if (this.isWalkable(newX, newY, currentMap)) {
                this.state.startMovement(newX, newY);
                
                // Update global coordinates in seamless world mode
                this.updateGlobalPosition(currentMap.mapId);
                
                // SEAMLESS WORLD: Check if we've moved to a different map
                const newMapId = this.checkMapTransition(currentMap);
                if (newMapId !== null && newMapId !== currentMap.mapId) {
                    // Return map transition info
                    return {
                        type: 'seamless-transition',
                        mapId: newMapId
                    };
                }
            }
        }
        
        // Update animation
        this.state.updateAnimation(delta);
        
        return null; // No warp triggered
    }
    
    /**
     * Update global position based on local position and map ID
     * @param {number} mapId - Current map ID
     */
    updateGlobalPosition(mapId) {
        if (this.mapCache && this.mapCache.isReady()) {
            const globalPos = this.mapCache.localToGlobal(mapId, this.state.x, this.state.y);
            if (globalPos) {
                this.globalX = globalPos.x;
                this.globalY = globalPos.y;
                this.globalPixelX = globalPos.x * 16;
                this.globalPixelY = globalPos.y * 16;
            }
        }
    }
    
    /**
     * Check if player has moved to a different map in seamless world
     * Updates currentMapId and local coordinates if needed
     * @param {Object} currentMap - Current map data
     */
    checkMapTransition(currentMap) {
        if (!this.mapStitcher || !currentMap) {
            return;
        }
        
        // Get current map position in global coordinates
        const mapPos = this.mapStitcher.getMapPosition(currentMap.mapId);
        if (!mapPos) {
            return;
        }
        
        // Calculate global player position
        const globalX = (mapPos.x * 2) + this.state.x;
        const globalY = (mapPos.y * 2) + this.state.y;
        
        // Find which map this position is actually on
        const targetMapInfo = this.mapStitcher.getMapAtPosition(
            Math.floor(globalX / 2),
            Math.floor(globalY / 2)
        );
        
        if (targetMapInfo && targetMapInfo.mapId !== currentMap.mapId) {
            // Player has moved to a different map!
            console.log(`[Player] 🗺️ Map transition: ${currentMap.mapId} → ${targetMapInfo.mapId}`);
            
            // Calculate new local coordinates for the target map
            const localX = globalX - (targetMapInfo.x * 2);
            const localY = globalY - (targetMapInfo.y * 2);
            
            // Update player state with new map and local coordinates
            this.currentMapId = targetMapInfo.mapId;
            this.state.x = localX;
            this.state.y = localY;
            this.state.pixelX = localX * 16;
            this.state.pixelY = localY * 16;
            
            console.log(`[Player] 📍 New position: local(${localX}, ${localY}), global(${globalX}, ${globalY})`);
            
            // Trigger map change event if needed
            return targetMapInfo.mapId;
        }
        
        return null;
    }
    
    /**
     * Render the player
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} offsetX - Camera offset X
     * @param {number} offsetY - Camera offset Y
     * @param {number} zoom - Zoom level
     */
    render(ctx, offsetX, offsetY, zoom) {
        const spriteImage = this.spriteManager.getSpriteImage(this.state.spriteId);
        
        if (!spriteImage) {
            console.warn('Player sprite not loaded:', this.state.spriteName);
            // Try to load it asynchronously
            this.spriteManager.loadSprite(this.state.spriteId);
            return;
        }
        
        // Calculate screen position
        // Use global pixel coordinates if available (for seamless world), otherwise use local coordinates
        const pixelX = (this.globalPixelX !== undefined) ? this.globalPixelX : this.state.pixelX;
        const pixelY = (this.globalPixelY !== undefined) ? this.globalPixelY : this.state.pixelY;
        const screenX = pixelX * zoom + offsetX;
        const screenY = pixelY * zoom + offsetY;
        
        // Get sprite frame based on facing direction
        const frameInfo = this.getSpriteFrame();
        
        // Player sprite is 16x16 pixels (2 tiles)
        const spriteWidth = 16;
        const spriteHeight = 16;
        
        // Save context state
        ctx.save();
        
        // Handle mirroring for right-facing
        if (frameInfo.mirror) {
            ctx.translate(screenX + spriteWidth * zoom, screenY);
            ctx.scale(-1, 1);
            ctx.drawImage(
                spriteImage,
                frameInfo.frameX, frameInfo.frameY,
                spriteWidth, spriteHeight,
                0, 0,
                spriteWidth * zoom, spriteHeight * zoom
            );
        } else {
            ctx.drawImage(
                spriteImage,
                frameInfo.frameX, frameInfo.frameY,
                spriteWidth, spriteHeight,
                screenX, screenY,
                spriteWidth * zoom, spriteHeight * zoom
            );
        }
        
        // Restore context state
        ctx.restore();
    }
    
    /**
     * Get sprite frame info based on facing direction
     * @returns {Object} - {frameX, frameY, mirror}
     */
    getSpriteFrame() {
        let frameX = 0, frameY = 0, mirror = false;
        
        // Map facing direction to sprite sheet position
        switch (this.state.facing) {
            case 0x00: // DOWN
                frameX = 0;
                break;
            case 0x04: // UP
                frameX = 16;
                break;
            case 0x08: // LEFT
                frameX = 32;
                break;
            case 0x0C: // RIGHT
                frameX = 32;
                mirror = true;
                break;
        }
        
        // Animation frame offset (0 or 1)
        if (this.state.isMoving && this.state.animFrame === 1) {
            frameY = 0; // Could add walking animation offset if sprite sheet supports it
        }
        
        return { frameX, frameY, mirror };
    }
    
    /**
     * Get player state
     * @returns {PlayerState}
     */
    getState() {
        return this.state;
    }
}
