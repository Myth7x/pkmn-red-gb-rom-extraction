// Map navigation state management
import { Logger } from '../utils/Logger.js';

export const MODULE_VERSION = '1.0.1';

export class MapState {
    constructor() {
        this.currentMap = null;
        this.previousMapId = null;
        this.navigationHistory = [];
    }
    
    setCurrentMap(mapData) {
        // Track previous map for map 255 warps
        if (this.currentMap && this.currentMap.mapId !== mapData.mapId) {
            this.previousMapId = this.currentMap.mapId;
            Logger.log(`Previous map tracked: ${this.previousMapId}`);
        }
        
        this.currentMap = mapData;
        
        // Add to history
        this.pushHistory(mapData.mapId);
    }
    
    getCurrentMap() {
        return this.currentMap;
    }
    
    pushHistory(mapId) {
        // Avoid duplicates if same map loaded twice in a row
        if (this.navigationHistory.length === 0 || 
            this.navigationHistory[this.navigationHistory.length - 1] !== mapId) {
            this.navigationHistory.push(mapId);
            
            // Limit history size
            if (this.navigationHistory.length > 50) {
                this.navigationHistory.shift();
            }
        }
    }
    
    getHistory() {
        return [...this.navigationHistory];
    }
    
    canGoBack() {
        return this.navigationHistory.length > 1;
    }
    
    getPreviousMapId() {
        if (this.navigationHistory.length > 1) {
            return this.navigationHistory[this.navigationHistory.length - 2];
        }
        return null;
    }
}
