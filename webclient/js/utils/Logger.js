// Logging utilities with emoji prefixes for better visibility

// Always update version after changes
export const MODULE_VERSION = '1.0.0';

export class Logger {
    static log(message, ...args) {
        console.log(`🎮 ${message}`, ...args);
    }
    
    static info(message, ...args) {
        console.log(`ℹ️ ${message}`, ...args);
    }
    
    static warn(message, ...args) {
        console.warn(`⚠️ ${message}`, ...args);
    }
    
    static error(message, ...args) {
        console.error(`❌ ${message}`, ...args);
    }
    
    static success(message, ...args) {
        console.log(`✅ ${message}`, ...args);
    }
    
    static debug(message, ...args) {
        if (this.debugMode) {
            console.log(`🐛 ${message}`, ...args);
        }
    }
}

Logger.debugMode = false; // Can be enabled for debugging
