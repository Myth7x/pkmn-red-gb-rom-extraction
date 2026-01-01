// Constants for Pokemon Red Map Viewer
// Core game constants and configuration values

export const MODULE_VERSION = '1.0.0';

export const TILE_SIZE = 8; // Each tile is 8x8 pixels
export const BLOCK_SIZE = 4; // Each block is 4x4 tiles (32x32 pixels)

export const MAP_VIEWER_VERSION = '3.0.2';
export const MAP_VIEWER_BUILD_DATE = '2026-01-01T03:00:00Z';
export const BUILD_TIMESTAMP = 1735704000000; // Update manually or via build script

// Module versions for tracking
export const MODULE_VERSIONS = {
    CONSTANTS: '1.0.0',
    CONFIG: '1.0.0',
    MAP_VIEWER: '1.0.0',
    LOGGER: '1.0.0',
    ERROR_HANDLER: '1.0.0',
    VIEWPORT_STATE: '1.0.0',
    MAP_STATE: '1.0.1',
    PREFERENCES_MANAGER: '1.0.0',
    CACHE_MANAGER: '1.0.0',
    MAP_DATA_MANAGER: '1.0.0',
    TILESET_MANAGER: '1.0.1',
    SPRITE_MANAGER: '1.0.1',
    CANVAS_RENDERER: '1.0.0'
};

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
export const DEFAULT_ZOOM = 2;

export const DEFAULT_OFFSET_X = 50;
export const DEFAULT_OFFSET_Y = 50;

// Sprite ID validation
export const MIN_SPRITE_ID = 1;
export const MAX_SPRITE_ID = 72;

// Overlay colors and styling
export const OVERLAY_COLORS = {
    WARP: '#00ffff',      // Cyan
    SIGN: '#ffff00',      // Yellow
    SPRITE: '#ff00ff',    // Magenta
    SCRIPT: '#00ff00',    // Green
    ITEM: '#ff8800'       // Orange
};

export const INDICATOR_ALPHA = 0.36;

// NPC Movement type constants (based on pokered decompilation)
// See: constants/map_object_constants.asm
export const MOVEMENT_TYPES = {
    0: { name: 'Static', description: 'Stays in place, does not move', direction: 'ANY_DIR' },
    1: { name: 'Walk Randomly', description: 'Wanders randomly in any direction', direction: 'ANY_DIR' },
    2: { name: 'Walk Up/Down', description: 'Walks vertically up and down', direction: 'UP_DOWN' },
    3: { name: 'Walk Left/Right', description: 'Walks horizontally left and right', direction: 'LEFT_RIGHT' },
    0xD0: { name: 'Face Down', description: 'Always faces downward', direction: 'DOWN' },
    0xD1: { name: 'Face Up', description: 'Always faces upward', direction: 'UP' },
    0xD2: { name: 'Face Left', description: 'Always faces left', direction: 'LEFT' },
    0xD3: { name: 'Face Right', description: 'Always faces right', direction: 'RIGHT' },
    254: { name: 'Look Around', description: 'Stands still but changes facing direction', direction: 'ANY_DIR' },
    255: { name: 'Stand Still', description: 'Completely stationary, never moves or turns', direction: 'NONE' }
};

// Get movement type info
export function getMovementInfo(movementValue) {
    return MOVEMENT_TYPES[movementValue] || {
        name: `Unknown (0x${movementValue.toString(16).toUpperCase()})`,
        description: 'Unknown movement pattern',
        direction: 'UNKNOWN'
    };
}
export const GRID_ALPHA = 0.15;
export const GRID_COLOR = 'rgba(255, 255, 255, 0.15)';

// LocalStorage keys
export const STORAGE_KEYS = {
    ZOOM: 'mapViewerZoom',
    CURRENT_MAP: 'mapViewerCurrentMap',
    PREVIOUS_MAP: 'mapViewerPreviousMap',
    SHOW_OVERLAYS: 'mapViewerShowOverlays',
    SHOW_GRID: 'mapViewerShowGrid',
    SHOW_COORD_LABELS: 'mapViewerShowCoordLabels',
    SHOW_TOOLTIP: 'mapViewerShowTooltip',
    SIDEBAR_HIDDEN: 'mapViewerSidebarHidden',
    LAST_OVERWORLD_MAP: 'mapViewerLastOverworldMap',
    LAST_OVERWORLD_X: 'mapViewerLastOverworldX',
    LAST_OVERWORLD_Y: 'mapViewerLastOverworldY'
};
