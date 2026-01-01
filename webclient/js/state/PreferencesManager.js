// LocalStorage preferences management
import { STORAGE_KEYS } from '../core/Constants.js';
import { Logger } from '../utils/Logger.js';

export const MODULE_VERSION = '1.0.0';

export class PreferencesManager {
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
        return this.loadNumber(STORAGE_KEYS.ZOOM, defaultZoom);
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
    
    // Sidebar preferences
    saveSidebarState(hidden) {
        this.save(STORAGE_KEYS.SIDEBAR_HIDDEN, hidden);
        Logger.log(`Sidebar: ${hidden ? 'HIDDEN' : 'VISIBLE'} (saved)`);
    }
    
    loadSidebarState() {
        return this.loadBoolean(STORAGE_KEYS.SIDEBAR_HIDDEN, false);
    }
}
