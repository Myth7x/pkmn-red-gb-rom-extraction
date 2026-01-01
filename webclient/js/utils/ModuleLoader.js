// Module loader with automatic cache busting
// This utility ensures all ES6 modules are loaded fresh

export const MODULE_VERSION = '1.0.0';

export class ModuleLoader {
    constructor() {
        this.cacheBuster = Date.now();
        this.loadedModules = new Set();
    }
    
    /**
     * Add cache buster parameter to module URL
     */
    addCacheBuster(url) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}v=${this.cacheBuster}`;
    }
    
    /**
     * Dynamic import with cache busting
     */
    async importModule(modulePath) {
        const cachedPath = this.addCacheBuster(modulePath);
        this.loadedModules.add(modulePath);
        return await import(cachedPath);
    }
    
    /**
     * Get all module paths that need cache busting
     */
    getModulePaths() {
        return [
            './js/core/Constants.js',
            './js/core/Config.js',
            './js/core/MapViewer.js',
            './js/utils/Logger.js',
            './js/utils/ErrorHandler.js',
            './js/state/ViewportState.js',
            './js/state/MapState.js',
            './js/state/PreferencesManager.js',
            './js/data/CacheManager.js',
            './js/data/MapDataManager.js',
            './js/data/TilesetManager.js',
            './js/data/SpriteManager.js',
            './js/rendering/CanvasRenderer.js'
        ];
    }
    
    /**
     * Create import map with cache busting for all modules
     */
    createImportMap() {
        const imports = {};
        const modulePaths = this.getModulePaths();
        
        for (const path of modulePaths) {
            const moduleName = path.replace('./js/', '').replace('.js', '');
            imports[moduleName] = this.addCacheBuster(path);
        }
        
        return {
            imports
        };
    }
    
    /**
     * Inject cache-busted script imports into the document
     */
    injectCacheBustedImports() {
        // Create import map
        const importMap = this.createImportMap();
        const importMapScript = document.createElement('script');
        importMapScript.type = 'importmap';
        importMapScript.textContent = JSON.stringify(importMap, null, 2);
        
        // Insert before any module scripts
        const firstScript = document.querySelector('script[type="module"]');
        if (firstScript) {
            firstScript.parentNode.insertBefore(importMapScript, firstScript);
        } else {
            document.head.appendChild(importMapScript);
        }
    }
}
