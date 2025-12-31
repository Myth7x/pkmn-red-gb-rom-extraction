/**
 * Map Constants for Pokemon Red/Blue
 * 
 * Defines map IDs, tileset IDs, connection directions, and other map-related constants
 * based on the pret/pokered disassembly.
 */

// Map header structure offsets
export const MAP_HEADER_OFFSETS = {
  TILESET: 0,        // 1 byte - Tileset ID
  HEIGHT: 1,          // 1 byte - Map height in 4x4 tile blocks
  WIDTH: 2,           // 1 byte - Map width in 4x4 tile blocks
  BLOCKS_PTR: 3,      // 2 bytes - Pointer to block data
  TEXT_PTR: 5,        // 2 bytes - Pointer to text pointers
  SCRIPT_PTR: 7,      // 2 bytes - Pointer to script data
  CONNECTIONS: 9      // 1 byte - Connection bitfield
};

// Connection directions
export const CONNECTIONS = {
  NORTH: 0x08,
  SOUTH: 0x04,
  WEST: 0x02,
  EAST: 0x01
};

// Connection header structure (11 bytes each)
export const CONNECTION_HEADER_SIZE = 11;
export const CONNECTION_OFFSETS = {
  CONNECTED_MAP: 0,           // 1 byte
  CONNECTION_STRIP_SRC: 1,    // 2 bytes
  CONNECTION_STRIP_DEST: 3,   // 2 bytes
  CONNECTION_STRIP_LENGTH: 5, // 1 byte
  CONNECTED_MAP_WIDTH: 6,     // 1 byte
  Y_ALIGNMENT: 7,             // 1 byte
  X_ALIGNMENT: 8,             // 1 byte
  WINDOW_PTR: 9               // 2 bytes
};

// Tileset IDs
export const TILESET_IDS = {
  OVERWORLD: 0,
  REDS_HOUSE_1: 1,
  MART: 2,
  FOREST: 3,
  REDS_HOUSE_2: 4,
  DOJO: 5,
  POKECENTER: 6,
  GYM: 7,
  HOUSE: 8,
  FOREST_GATE: 9,
  MUSEUM: 10,
  UNDERGROUND: 11,
  GATE: 12,
  SHIP: 13,
  SHIP_PORT: 14,
  CEMETERY: 15,
  INTERIOR: 16,
  CAVERN: 17,
  LOBBY: 18,
  MANSION: 19,
  LAB: 20,
  CLUB: 21,
  FACILITY: 22,
  PLATEAU: 23
};

export const TILESET_NAMES = [
  'OVERWORLD',
  'REDS_HOUSE_1',
  'MART',
  'FOREST',
  'REDS_HOUSE_2',
  'DOJO',
  'POKECENTER',
  'GYM',
  'HOUSE',
  'FOREST_GATE',
  'MUSEUM',
  'UNDERGROUND',
  'GATE',
  'SHIP',
  'SHIP_PORT',
  'CEMETERY',
  'INTERIOR',
  'CAVERN',
  'LOBBY',
  'MANSION',
  'LAB',
  'CLUB',
  'FACILITY',
  'PLATEAU'
];

// Map IDs (first 50 maps - towns, routes, dungeons)
export const MAP_IDS = {
  PALLET_TOWN: 0,
  VIRIDIAN_CITY: 1,
  PEWTER_CITY: 2,
  CERULEAN_CITY: 3,
  LAVENDER_TOWN: 4,
  VERMILION_CITY: 5,
  CELADON_CITY: 6,
  FUCHSIA_CITY: 7,
  CINNABAR_ISLAND: 8,
  INDIGO_PLATEAU: 9,
  SAFFRON_CITY: 10,
  ROUTE_1: 12,
  ROUTE_2: 13,
  ROUTE_3: 14,
  ROUTE_4: 15,
  ROUTE_5: 16,
  ROUTE_6: 17,
  ROUTE_7: 18,
  ROUTE_8: 19,
  ROUTE_9: 20,
  ROUTE_10: 21,
  ROUTE_11: 22,
  ROUTE_12: 23,
  ROUTE_13: 24,
  ROUTE_14: 25,
  ROUTE_15: 26,
  ROUTE_16: 27,
  ROUTE_17: 28,
  ROUTE_18: 29,
  ROUTE_19: 30,
  ROUTE_20: 31,
  ROUTE_21: 32,
  ROUTE_22: 33,
  ROUTE_23: 34,
  ROUTE_24: 35,
  ROUTE_25: 36
};

export const MAP_NAMES = {
  0: 'Pallet Town',
  1: 'Viridian City',
  2: 'Pewter City',
  3: 'Cerulean City',
  4: 'Lavender Town',
  5: 'Vermilion City',
  6: 'Celadon City',
  7: 'Fuchsia City',
  8: 'Cinnabar Island',
  9: 'Indigo Plateau',
  10: 'Saffron City',
  12: 'Route 1',
  13: 'Route 2',
  14: 'Route 3',
  15: 'Route 4',
  16: 'Route 5',
  17: 'Route 6',
  18: 'Route 7',
  19: 'Route 8',
  20: 'Route 9',
  21: 'Route 10',
  22: 'Route 11',
  23: 'Route 12',
  24: 'Route 13',
  25: 'Route 14',
  26: 'Route 15',
  27: 'Route 16',
  28: 'Route 17',
  29: 'Route 18',
  30: 'Route 19',
  31: 'Route 20',
  32: 'Route 21',
  33: 'Route 22',
  34: 'Route 23',
  35: 'Route 24',
  36: 'Route 25'
};

// Total number of maps in Pokemon Red
export const NUM_MAPS = 248;

// Map dimensions are stored in 4x4 tile blocks
// Each block is 4x4 tiles, each tile is 8x8 pixels
export const BLOCK_SIZE = 4; // tiles
export const TILE_SIZE = 8;  // pixels
export const PIXELS_PER_BLOCK = BLOCK_SIZE * TILE_SIZE; // 32 pixels

// Maximum events per map
export const MAX_WARP_EVENTS = 32;
export const MAX_BG_EVENTS = 16;   // Signs
export const MAX_OBJECT_EVENTS = 16; // NPCs/Items
