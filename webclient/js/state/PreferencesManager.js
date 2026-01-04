// LocalStorage preferences management
import { STORAGE_KEYS } from '../core/Constants.js';
import { Logger } from '../utils/Logger.js';

// Version: Update patch number for bug fixes, minor for new features, major for breaking changes
export const MODULE_VERSION = '1.1.0';

export class PreferencesManager {
    constructor(config = null) {
        this.config = config; // Optional Config instance to determine mode
    }
    
    /**
     * Check if currently in game mode
     * @returns {boolean}
     */
    isGameMode() {
        return this.config && this.config.isGameMode();
    }
    
    save(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch (error) {
            Logger.warn('Failed to save preference:', key, error);
        }
    }
    
    load(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value !== null ? value : defaultValue;
        } catch (error) {
            Logger.warn('Failed to load preference:', key, error);
            return defaultValue;
        }
    }
    
    loadBoolean(key, defaultValue = false) {
        const value = this.load(key);
        return value === 'true' ? true : (value === 'false' ? false : defaultValue);
    }
    
    loadNumber(key, defaultValue = 0) {
        const value = this.load(key);
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    
    // Zoom preferences
    saveZoom(zoom) {
        this.save(STORAGE_KEYS.ZOOM, zoom);
        Logger.log(`Saved zoom level: ${zoom}x`);
    }
    
    loadZoom(defaultZoom = 2) {
        const value = this.load(STORAGE_KEYS.ZOOM);
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultZoom : parsed;
    }
    
    // Current map preferences
    saveCurrentMap(mapId) {
        this.save(STORAGE_KEYS.CURRENT_MAP, mapId);
        Logger.log(`Saved map ${mapId} to localStorage`);
    }
    
    loadCurrentMap() {
        const mapId = this.loadNumber(STORAGE_KEYS.CURRENT_MAP, null);
        if (mapId) {
            Logger.log(`Restoring saved map: ${mapId}`);
        }
        return mapId;
    }
    
    // Previous map preferences (for elevator/warp returns)
    savePreviousMap(mapId) {
        this.save(STORAGE_KEYS.PREVIOUS_MAP, mapId);
    }
    
    loadPreviousMap() {
        return this.loadNumber(STORAGE_KEYS.PREVIOUS_MAP, null);
    }
    
    // Last overworld map (for warp 255 handling)
    saveLastOverworldMap(mapId, x = null, y = null) {
        this.save(STORAGE_KEYS.LAST_OVERWORLD_MAP, mapId);
        if (x !== null && y !== null) {
            this.save(STORAGE_KEYS.LAST_OVERWORLD_X, x);
            this.save(STORAGE_KEYS.LAST_OVERWORLD_Y, y);
        }
        Logger.log(`Saved last overworld map: ${mapId} (${x}, ${y})`);
    }
    
    loadLastOverworldMap() {
        const mapId = this.loadNumber(STORAGE_KEYS.LAST_OVERWORLD_MAP, null);
        const x = this.loadNumber(STORAGE_KEYS.LAST_OVERWORLD_X, null);
        const y = this.loadNumber(STORAGE_KEYS.LAST_OVERWORLD_Y, null);
        return { mapId, x, y };
    }
    
    // Overlay preferences
    saveOverlaySettings(showOverlays, showGrid, showCoordLabels) {
        this.save(STORAGE_KEYS.SHOW_OVERLAYS, showOverlays);
        this.save(STORAGE_KEYS.SHOW_GRID, showGrid);
        this.save(STORAGE_KEYS.SHOW_COORD_LABELS, showCoordLabels);
    }
    
    loadOverlaySettings() {
        return {
            showOverlays: this.loadBoolean(STORAGE_KEYS.SHOW_OVERLAYS, true),
            showGrid: this.loadBoolean(STORAGE_KEYS.SHOW_GRID, false),
            showCoordLabels: this.loadBoolean(STORAGE_KEYS.SHOW_COORD_LABELS, false),
            showTooltip: this.loadBoolean(STORAGE_KEYS.SHOW_TOOLTIP, true)
        };
    }
    
    saveShowOverlays(value) {
        this.save(STORAGE_KEYS.SHOW_OVERLAYS, value);
        Logger.log(`Overlays: ${value ? 'ON' : 'OFF'} (saved)`);
    }
    
    saveShowGrid(value) {
        this.save(STORAGE_KEYS.SHOW_GRID, value);
        Logger.log(`Grid: ${value ? 'ON' : 'OFF'} (saved)`);
    }
    
    saveShowCoordLabels(value) {
        this.save(STORAGE_KEYS.SHOW_COORD_LABELS, value);
        Logger.log(`Coordinates: ${value ? 'ON' : 'OFF'} (saved)`);
    }
    
    saveShowTooltip(value) {
        this.save(STORAGE_KEYS.SHOW_TOOLTIP, value);
        Logger.log(`Tooltip: ${value ? 'ON' : 'OFF'} (saved)`);
    }
    
    saveTileOptimization(value) {
        this.save(STORAGE_KEYS.TILE_OPTIMIZATION, value);
        Logger.log(`Tile Optimization: ${value ? 'ON' : 'OFF'} (saved)`);
    }
    
    loadTileOptimization() {
        return this.loadBoolean(STORAGE_KEYS.TILE_OPTIMIZATION, true); // Default to enabled
    }
    
    saveShowInteriorLayout(value) {
        this.save(STORAGE_KEYS.SHOW_INTERIOR_LAYOUT, value);
        Logger.log(`Interior Layout: ${value ? 'ON' : 'OFF'} (saved)`);
    }
    
    loadShowInteriorLayout() {
        return this.loadBoolean(STORAGE_KEYS.SHOW_INTERIOR_LAYOUT, true); // Default to enabled
    }
    
    // Alias for compatibility
    loadInteriorLayoutMode() {
        return this.loadShowInteriorLayout();
    }
    
    saveInteriorLayoutMode(value) {
        this.saveShowInteriorLayout(value);
    }
    
    // Sidebar preferences
    saveSidebarState(hidden) {
        this.save(STORAGE_KEYS.SIDEBAR_HIDDEN, hidden);
        Logger.log(`Sidebar: ${hidden ? 'HIDDEN' : 'VISIBLE'} (saved)`);
    }
    
    loadSidebarState() {
        return this.loadBoolean(STORAGE_KEYS.SIDEBAR_HIDDEN, true); // Default to hidden
    }
    
    // Panel collapse state preferences
    savePanelState(panelName, collapsed) {
        const key = `PANEL_${panelName.toUpperCase().replace(/-/g, '_')}`;
        if (STORAGE_KEYS[key]) {
            this.save(STORAGE_KEYS[key], collapsed);
        }
    }
    
    loadPanelState(panelName) {
        const key = `PANEL_${panelName.toUpperCase().replace(/-/g, '_')}`;
        if (STORAGE_KEYS[key]) {
            return this.loadBoolean(STORAGE_KEYS[key], true); // Default to collapsed
        }
        return true; // Default to collapsed if key not found
    }
    
    // ===== GAME MODE SPECIFIC METHODS =====
    // These use separate storage keys to not interfere with map-viewer mode
    
    /**
     * Save current game state (map, player position, facing)
     * Only used in game mode
     */
    saveGameState(mapId, playerX, playerY, facing = null) {
        this.save(STORAGE_KEYS.GAME_CURRENT_MAP, mapId);
        this.save(STORAGE_KEYS.GAME_PLAYER_X, playerX);
        this.save(STORAGE_KEYS.GAME_PLAYER_Y, playerY);
        if (facing !== null) {
            this.save(STORAGE_KEYS.GAME_PLAYER_FACING, facing);
        }
        Logger.log(`[Game] Saved state: Map ${mapId}, Position (${playerX}, ${playerY}), Facing ${facing}`);
    }
    
    /**
     * Load saved game state
     * Returns null if no saved state exists
     */
    loadGameState() {
        const mapId = this.loadNumber(STORAGE_KEYS.GAME_CURRENT_MAP, null);
        const playerX = this.loadNumber(STORAGE_KEYS.GAME_PLAYER_X, null);
        const playerY = this.loadNumber(STORAGE_KEYS.GAME_PLAYER_Y, null);
        const facing = this.loadNumber(STORAGE_KEYS.GAME_PLAYER_FACING, 0x00); // Default DOWN
        
        if (mapId !== null && playerX !== null && playerY !== null) {
            Logger.log(`[Game] Restored state: Map ${mapId}, Position (${playerX}, ${playerY}), Facing ${facing}`);
            return { mapId, playerX, playerY, facing };
        }
        
        return null;
    }
    
    /**
     * Save game mode zoom level
     */
    saveGameZoom(zoom) {
        this.save(STORAGE_KEYS.GAME_ZOOM, zoom);
        Logger.log(`[Game] Saved zoom level: ${zoom}x`);
    }
    
    /**
     * Load game mode zoom level
     */
    loadGameZoom(defaultZoom = 4) {
        const value = this.load(STORAGE_KEYS.GAME_ZOOM);
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultZoom : parsed;
    }
    
    /**
     * Save previous map for game mode (for warp returns)
     */
    saveGamePreviousMap(mapId) {
        this.save(STORAGE_KEYS.GAME_PREVIOUS_MAP, mapId);
    }
    
    /**
     * Load previous map for game mode
     */
    loadGamePreviousMap() {
        return this.loadNumber(STORAGE_KEYS.GAME_PREVIOUS_MAP, null);
    }
    
    /**
     * Save game mode collision debug state
     */
    saveGameCollisionDebug(value) {
        this.save(STORAGE_KEYS.GAME_SHOW_COLLISION_DEBUG, value);
        Logger.log(`[Game] Collision debug: ${value ? 'ON' : 'OFF'} (saved)`);
    }
    
    /**
     * Load game mode collision debug state
     */
    loadGameCollisionDebug() {
        return this.loadBoolean(STORAGE_KEYS.GAME_SHOW_COLLISION_DEBUG, false); // Default off
    }
    
    /**
     * Save game mode overlay settings
     */
    saveGameShowOverlays(value) {
        this.save(STORAGE_KEYS.GAME_SHOW_OVERLAYS, value);
        Logger.log(`[Game] Overlays: ${value ? 'ON' : 'OFF'} (saved)`);
    }
    
    /**
     * Load game mode overlay settings
     */
    loadGameShowOverlays() {
        return this.loadBoolean(STORAGE_KEYS.GAME_SHOW_OVERLAYS, false); // Default off
    }
    
    /**
     * Save game mode grid state
     */
    saveGameShowGrid(value) {
        this.save(STORAGE_KEYS.GAME_SHOW_GRID, value);
        Logger.log(`[Game] Grid: ${value ? 'ON' : 'OFF'} (saved)`);
    }
    
    /**
     * Load game mode grid state
     */
    loadGameShowGrid() {
        return this.loadBoolean(STORAGE_KEYS.GAME_SHOW_GRID, false); // Default off
    }
    
    /**
     * Save game mode coord labels state
     */
    saveGameShowCoordLabels(value) {
        this.save(STORAGE_KEYS.GAME_SHOW_COORD_LABELS, value);
        Logger.log(`[Game] Coord labels: ${value ? 'ON' : 'OFF'} (saved)`);
    }
    
    /**
     * Load game mode coord labels state
     */
    loadGameShowCoordLabels() {
        return this.loadBoolean(STORAGE_KEYS.GAME_SHOW_COORD_LABELS, false); // Default off
    }
    
    /**
     * Clear game state (e.g., on new game)
     */
    clearGameState() {
        localStorage.removeItem(STORAGE_KEYS.GAME_CURRENT_MAP);
        localStorage.removeItem(STORAGE_KEYS.GAME_PLAYER_X);
        localStorage.removeItem(STORAGE_KEYS.GAME_PLAYER_Y);
        localStorage.removeItem(STORAGE_KEYS.GAME_PLAYER_FACING);
        localStorage.removeItem(STORAGE_KEYS.GAME_ZOOM);
        localStorage.removeItem(STORAGE_KEYS.GAME_PREVIOUS_MAP);
        localStorage.removeItem(STORAGE_KEYS.GAME_SHOW_COLLISION_DEBUG);
        localStorage.removeItem(STORAGE_KEYS.GAME_SHOW_OVERLAYS);
        localStorage.removeItem(STORAGE_KEYS.GAME_SHOW_GRID);
        localStorage.removeItem(STORAGE_KEYS.GAME_SHOW_COORD_LABELS);
        Logger.log(`[Game] Cleared saved game state`);
    }
}
