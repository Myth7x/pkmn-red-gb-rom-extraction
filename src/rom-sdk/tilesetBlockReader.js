/**
 * Tileset Block Reader for Pokemon Red/Blue
 * 
 * Reads tileset block data (4x4 tile metatiles) and collision data.
 * Blocks are the building blocks of maps - each block is a 4x4 arrangement of 8x8 tiles.
 */

import { TILESET_NAMES } from './mapConstants.js';

// Tileset header structure (12 bytes)
const TILESET_HEADER_SIZE = 12;
const TILESET_HEADER_OFFSETS = {
  BANK: 0,           // 1 byte - ROM bank containing tileset graphics
  BLOCK_PTR: 1,      // 2 bytes - Pointer to block data
  GFX_PTR: 3,        // 2 bytes - Pointer to graphics data
  COLL_PTR: 5,       // 2 bytes - Pointer to collision data
  COUNTER_TILES: 7,  // 3 bytes - Counter tiles (for animated tiles)
  GRASS_TILE: 10,    // 1 byte - Grass tile ID
  ANIM: 11           // 1 byte - Animation type
};

// Known offset for tileset headers table
const TILESET_HEADERS_OFFSET = 0xC7BE; // Tilesets table in Pokemon Red

/**
 * Convert bank + pointer to ROM offset
 * @param {number} bank - ROM bank number
 * @param {number} pointer - 16-bit pointer within bank
 * @returns {number} - Absolute ROM offset
 */
function bankPointerToOffset(bank, pointer) {
  if (pointer >= 0x4000 && pointer < 0x8000) {
    return (bank - 1) * 0x4000 + pointer;
  } else if (pointer < 0x4000) {
    return pointer;
  } else {
    throw new Error(`Invalid pointer: 0x${pointer.toString(16)}`);
  }
}

/**
 * Read tileset header
 * @param {Buffer} rom - ROM buffer
 * @param {number} tilesetId - Tileset ID (0-23)
 * @returns {Object} - Tileset header data
 */
export function readTilesetHeader(rom, tilesetId) {
  const offset = TILESET_HEADERS_OFFSET + (tilesetId * TILESET_HEADER_SIZE);
  
  const bank = rom[offset + TILESET_HEADER_OFFSETS.BANK];
  const blockPtr = rom.readUInt16LE(offset + TILESET_HEADER_OFFSETS.BLOCK_PTR);
  const gfxPtr = rom.readUInt16LE(offset + TILESET_HEADER_OFFSETS.GFX_PTR);
  const collPtr = rom.readUInt16LE(offset + TILESET_HEADER_OFFSETS.COLL_PTR);
  const counterTile1 = rom[offset + TILESET_HEADER_OFFSETS.COUNTER_TILES];
  const counterTile2 = rom[offset + TILESET_HEADER_OFFSETS.COUNTER_TILES + 1];
  const counterTile3 = rom[offset + TILESET_HEADER_OFFSETS.COUNTER_TILES + 2];
  const grassTile = rom[offset + TILESET_HEADER_OFFSETS.GRASS_TILE];
  const anim = rom[offset + TILESET_HEADER_OFFSETS.ANIM];

  return {
    tilesetId,
    name: TILESET_NAMES[tilesetId] || `Tileset_${tilesetId}`,
    bank,
    blockPtr: `0x${blockPtr.toString(16).toUpperCase()}`,
    gfxPtr: `0x${gfxPtr.toString(16).toUpperCase()}`,
    collPtr: `0x${collPtr.toString(16).toUpperCase()}`,
    counterTiles: [counterTile1, counterTile2, counterTile3].filter(t => t !== 0xFF),
    grassTile: grassTile === 0xFF ? null : grassTile,
    animation: anim,
    animationName: getAnimationName(anim)
  };
}

/**
 * Get animation type name
 * @param {number} anim - Animation byte
 * @returns {string} - Animation name
 */
function getAnimationName(anim) {
  const names = ['NONE', 'WATER', 'WATER_FLOWER'];
  return names[anim] || 'UNKNOWN';
}

/**
 * Read block data for a tileset
 * A block is 4x4 tiles = 16 bytes
 * Blocks define how tiles are arranged to form larger structures
 * 
 * @param {Buffer} rom - ROM buffer
 * @param {Object} tilesetHeader - Tileset header object
 * @param {number} numBlocks - Number of blocks to read (default 256)
 * @returns {Array<Uint8Array>} - Array of blocks, each is 16 bytes (4x4 tiles)
 */
export function readTilesetBlocks(rom, tilesetHeader, numBlocks = 256) {
  const blockPtr = parseInt(tilesetHeader.blockPtr, 16);
  const offset = bankPointerToOffset(tilesetHeader.bank, blockPtr);
  
  const blocks = [];
  for (let i = 0; i < numBlocks; i++) {
    const blockOffset = offset + (i * 16);
    const blockData = rom.slice(blockOffset, blockOffset + 16);
    blocks.push(blockData);
  }
  
  return blocks;
}

/**
 * Read collision data for a tileset
 * Each tile has collision properties (walkable, surfable, etc.)
 * 
 * @param {Buffer} rom - ROM buffer
 * @param {Object} tilesetHeader - Tileset header object
 * @param {number} numTiles - Number of tiles to read collision for (default 256)
 * @returns {Uint8Array} - Collision data
 */
export function readTilesetCollision(rom, tilesetHeader, numTiles = 256) {
  const collPtr = parseInt(tilesetHeader.collPtr, 16);
  const offset = bankPointerToOffset(tilesetHeader.bank, collPtr);
  
  return rom.slice(offset, offset + numTiles);
}

/**
 * Read raw tile graphics data (2bpp format)
 * Each tile is 8x8 pixels, 2 bits per pixel = 16 bytes per tile
 * 
 * @param {Buffer} rom - ROM buffer
 * @param {Object} tilesetHeader - Tileset header object
 * @param {number} numTiles - Number of tiles to read (default 256)
 * @returns {Uint8Array} - Raw 2bpp tile data
 */
export function readTilesetGraphics(rom, tilesetHeader, numTiles = 256) {
  const gfxPtr = parseInt(tilesetHeader.gfxPtr, 16);
  const offset = bankPointerToOffset(tilesetHeader.bank, gfxPtr);
  const size = numTiles * 16; // 16 bytes per 8x8 tile
  
  return rom.slice(offset, offset + size);
}

/**
 * Decode a single tile from 2bpp format to pixel array
 * @param {Uint8Array} tileData - 16 bytes of 2bpp data
 * @returns {Uint8Array} - 64 pixels (8x8), each pixel is 0-3
 */
export function decode2bppTile(tileData) {
  const pixels = new Uint8Array(64);
  
  for (let row = 0; row < 8; row++) {
    const byte1 = tileData[row * 2];
    const byte2 = tileData[row * 2 + 1];
    
    for (let col = 0; col < 8; col++) {
      const bit = 7 - col;
      const pixel1 = (byte1 >> bit) & 1;
      const pixel2 = (byte2 >> bit) & 1;
      pixels[row * 8 + col] = pixel1 | (pixel2 << 1);
    }
  }
  
  return pixels;
}

/**
 * Get collision type name
 * @param {number} collision - Collision byte
 * @returns {string} - Collision type description
 */
/**
 * Get collision type from collision value
 * Based on Pokemon Red/Blue collision system
 * 
 * @param {number} collision - Collision byte value
 * @returns {Object} - Collision type info
 */
export function getCollisionType(collision) {
  // Collision type mapping based on Pokemon Red disassembly
  const types = {
    // Movement permissions
    0x00: { type: 'PASSABLE', walkable: true, surfable: false, description: 'Normal walkable ground' },
    0x01: { type: 'WALL', walkable: false, surfable: false, description: 'Solid wall' },
    0x0C: { type: 'DOOR', walkable: false, surfable: false, description: 'Door tile' },
    0x0D: { type: 'DOOR_2', walkable: false, surfable: false, description: 'Door tile variant' },
    0x0F: { type: 'BLOCK', walkable: false, surfable: false, description: 'Blocking tile' },
    
    // Water tiles
    0x14: { type: 'WATER', walkable: false, surfable: true, description: 'Water (surfable)' },
    0x32: { type: 'WATER_BLOCK', walkable: false, surfable: false, description: 'Impassable water' },
    
    // Grass and special tiles
    0x15: { type: 'GRASS', walkable: true, surfable: false, description: 'Tall grass (encounters)' },
    0x52: { type: 'GRASS_2', walkable: true, surfable: false, description: 'Grass variant' },
    
    // Warp tiles
    0x20: { type: 'WARP', walkable: true, surfable: false, description: 'Warp tile' },
    0x60: { type: 'WARP_PAD', walkable: true, surfable: false, description: 'Warp pad' },
    
    // Ledges (one-way)
    0x16: { type: 'LEDGE_DOWN', walkable: true, surfable: false, description: 'Ledge (jump down)' },
    0x17: { type: 'LEDGE_RIGHT', walkable: true, surfable: false, description: 'Ledge (jump right)' },
    0x18: { type: 'LEDGE_LEFT', walkable: true, surfable: false, description: 'Ledge (jump left)' },
    
    // Counter tiles (can talk over)
    0x50: { type: 'COUNTER', walkable: false, surfable: false, description: 'Counter (can talk over)' },
    
    // Special movement
    0x3C: { type: 'DOOR_WARP', walkable: false, surfable: false, description: 'Door with warp' },
    0x3D: { type: 'WARP_DOWN', walkable: true, surfable: false, description: 'Downward warp' },
    
    // Unknown/Wall types
    0x10: { type: 'WALL_10', walkable: false, surfable: false, description: 'Wall variant' },
    0x11: { type: 'WALL_11', walkable: false, surfable: false, description: 'Wall variant' },
    0x1B: { type: 'WALL_1B', walkable: false, surfable: false, description: 'Wall variant' },
    0x21: { type: 'WALL_21', walkable: false, surfable: false, description: 'Wall variant' }
  };

  // Return known type or classify as wall/unknown
  if (types[collision]) {
    return types[collision];
  }
  
  // Classify unknown values
  if (collision >= 0x01 && collision <= 0x0F) {
    return { type: 'WALL', walkable: false, surfable: false, description: `Wall type 0x${collision.toString(16).toUpperCase()}` };
  }
  
  return { 
    type: 'UNKNOWN', 
    walkable: false, 
    surfable: false, 
    description: `Unknown collision 0x${collision.toString(16).toUpperCase()}` 
  };
}

/**
 * Read all tileset headers
 * @param {Buffer} rom - ROM buffer
 * @param {number} numTilesets - Number of tilesets (default 24)
 * @returns {Array<Object>} - Array of tileset headers
 */
export function readAllTilesetHeaders(rom, numTilesets = 24) {
  const headers = [];
  for (let i = 0; i < numTilesets; i++) {
    try {
      const header = readTilesetHeader(rom, i);
      headers.push(header);
    } catch (error) {
      console.warn(`[WARNING] Failed to read tileset ${i}: ${error.message}`);
    }
  }
  return headers;
}
