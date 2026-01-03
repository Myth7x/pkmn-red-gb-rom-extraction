// Generic caching with LRU (Least Recently Used) eviction
import { Logger } from '../utils/Logger.js';

// Always update version after changes
export const MODULE_VERSION = '1.0.0';

export class CacheManager {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    
    set(key, value) {
        // If key exists, delete it first to update position
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        
        // Add to end (most recently used)
        this.cache.set(key, value);
        
        // Evict oldest if over max size
        if (this.cache.size > this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            Logger.debug(`Cache evicted: ${firstKey}`);
        }
    }
    
    get(key) {
        if (!this.cache.has(key)) {
            return null;
        }
        
        // Move to end (mark as recently used)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        
        return value;
    }
    
    has(key) {
        return this.cache.has(key);
    }
    
    clear() {
        this.cache.clear();
        Logger.log('Cache cleared');
    }
    
    size() {
        return this.cache.size;
    }
}
