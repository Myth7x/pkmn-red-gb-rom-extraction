// Overworld sprite loading and management
import { MIN_SPRITE_ID, MAX_SPRITE_ID } from '../core/Constants.js';
import { Logger } from '../utils/Logger.js';

export const MODULE_VERSION = '1.0.1';

export class SpriteManager {
    constructor(config) {
        this.config = config;
        this.spriteImages = {};
        this.spriteMetadata = null;
    }
    
    async loadSpriteMetadata() {
        if (this.spriteMetadata) {
            return this.spriteMetadata;
        }
        
        Logger.log('Loading overworld sprite metadata...');
        
        try {
            const response = await fetch(this.config.paths.spriteMetadata);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            this.spriteMetadata = await response.json();
            Logger.success(`Loaded metadata for ${this.spriteMetadata.sprites.length} sprites`);
            
            return this.spriteMetadata;
        } catch (error) {
            Logger.error('Failed to load sprite metadata:', error);
            throw error;
        }
    }
    
    async loadSprite(spriteId) {
        // Validate sprite ID
        if (spriteId < MIN_SPRITE_ID || spriteId > MAX_SPRITE_ID) {
            Logger.warn(`Sprite ID ${spriteId} out of valid range (${MIN_SPRITE_ID}-${MAX_SPRITE_ID})`);
            return null;
        }
        
        // Check if already loaded
        if (this.spriteImages[spriteId]) {
            return this.spriteImages[spriteId];
        }
        
        // Load metadata if not loaded
        if (!this.spriteMetadata) {
            await this.loadSpriteMetadata();
        }
        
        // Find sprite in metadata
        const sprite = this.spriteMetadata.sprites.find(s => s.id === spriteId);
        
        if (!sprite) {
            Logger.warn(`Sprite ${spriteId} not found in metadata`);
            return null;
        }
        
        const spritePath = this.config.getSpritePath(spriteId, sprite.name);
        
        return new Promise((resolve) => {
            const img = new Image();
            
            img.onload = () => {
                this.spriteImages[spriteId] = img;
                Logger.debug(`Sprite ${spriteId} (${sprite.name}) loaded`);
                resolve(img);
            };
            
            img.onerror = (error) => {
                Logger.warn(`Failed to load sprite ${spriteId}:`, error);
                resolve(null);
            };
            
            img.src = spritePath;
        });
    }
    
    async preloadSprites(spriteIds) {
        Logger.log(`Preloading ${spriteIds.length} sprites...`);
        
        const promises = spriteIds.map(id => 
            this.loadSprite(id).catch(err => {
                Logger.warn(`Failed to preload sprite ${id}:`, err);
                return null;
            })
        );
        
        await Promise.all(promises);
        Logger.success('Sprites preloaded');
    }
    
    getSpriteImage(spriteId) {
        return this.spriteImages[spriteId];
    }
    
    getSpriteMetadata(spriteId) {
        if (!this.spriteMetadata) {
            return null;
        }
        return this.spriteMetadata.sprites.find(s => s.id === spriteId);
    }
    
    hasSprite(spriteId) {
        return !!this.spriteImages[spriteId];
    }
}
