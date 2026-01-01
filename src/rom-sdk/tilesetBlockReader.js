/**
 * Tileset Block Reader for Pokemon Red/Blue - CORRECT IMPLEMENTATION
 * 
 * Based on analysis of pret/pokered disassembly.
 * 
 * KEY INSIGHT: Collision is TILE-BASED, not block-based!
 * - Each tileset has a list of IMPASSABLE TILE IDs
 * - Blocks are just 4x4 arrangements of tiles for visual organization
 * - Collision is determined by checking if a tile ID is in the impassable list
 */

import { TILESET_NAMES } from './mapConstants.js';

// Tileset header structure (12 bytes)
const TILESET_HEADER_SIZE = 12;
const TILESET_HEADER_OFFSETS = {
  BANK: 0,           // 1 byte - ROM bank containing tileset graphics
  BLOCK_PTR: 1,      // 2 bytes - Pointer to block data
  GFX_PTR: 3,        // 2 bytes - Pointer to graphics data
  COLL_PTR: 5,       // 2 bytes - Pointer to collision data (LIST OF IMPASSABLE TILE IDs!)
  COUNTER_TILES: 7,  // 3 bytes - Counter tiles (for talking over)
  GRASS_TILE: 10,    // 1 byte - Grass tile ID
  ANIM: 11           // 1 byte - Animation type
};

// Known offset for tileset headers table in Pokemon Red
const TILESET_HEADERS_OFFSET = 0xC7BE;

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
 * Each block is 4x4 tiles = 16 bytes
 * Blocks define how tiles are arranged to form larger structures
 * 
 * @param {Buffer} rom - ROM buffer
 * @param {Object} tilesetHeader - Tileset header object
 * @param {number} numBlocks - Number of blocks to read (default 256)
 * @returns {Array<Object>} - Array of blocks with tile IDs
 */
export function readTilesetBlocks(rom, tilesetHeader, numBlocks = 256) {
  const blockPtr = parseInt(tilesetHeader.blockPtr, 16);
  const offset = bankPointerToOffset(tilesetHeader.bank, blockPtr);
  
  const blocks = [];
  for (let blockId = 0; blockId < numBlocks; blockId++) {
    const blockOffset = offset + (blockId * 16);
    const blockData = rom.slice(blockOffset, blockOffset + 16);
    
    // Parse block into 4x4 tile IDs
    const tiles = [];
    for (let row = 0; row < 4; row++) {
      const rowTiles = [];
      for (let col = 0; col < 4; col++) {
        const tileId = blockData[row * 4 + col];
        rowTiles.push(tileId);
      }
      tiles.push(rowTiles);
    }
    
    blocks.push({
      blockId,
      tiles, // 4x4 array of tile IDs
      rawData: Array.from(blockData) // Raw 16 bytes for debugging
    });
  }
  
  return blocks;
}

/**
 * Read collision data for a tileset (CORRECT METHOD)
 * 
 * The collision data is a LIST OF TILE IDs that are impassable,
 * terminated by 0xFF.
 * 
 * This is NOT 256 bytes of collision values! It's a variable-length list!
 * 
 * @param {Buffer} rom - ROM buffer
 * @param {Object} tilesetHeader - Tileset header object
 * @returns {Array<number>} - Array of impassable tile IDs
 */
export function readTilesetCollision(rom, tilesetHeader) {
  const collPtr = parseInt(tilesetHeader.collPtr, 16);
  const offset = bankPointerToOffset(tilesetHeader.bank, collPtr);
  
  const impassableTiles = [];
  let i = 0;
  
  // Read tile IDs until we hit 0xFF (end marker)
  while (true) {
    const tileId = rom[offset + i];
    if (tileId === 0xFF) {
      break; // End of list
    }
    impassableTiles.push(tileId);
    i++;
    
    // Safety check to prevent infinite loops
    if (i > 256) {
      console.warn(`[WARNING] Collision list for tileset ${tilesetHeader.name} is suspiciously long (>256 entries)`);
      break;
    }
  }
  
  return impassableTiles;
}

/**
 * Check if a tile ID is passable
 * @param {number} tileId - Tile ID to check
 * @param {Array<number>} impassableTiles - List of impassable tile IDs
 * @returns {boolean} - True if passable, false if impassable
 */
export function isTilePassable(tileId, impassableTiles) {
  return !impassableTiles.includes(tileId);
}

/**
 * Get tile collision properties
 * @param {number} tileId - Tile ID
 * @param {Object} tileset - Tileset data with impassableTiles, grassTile, etc.
 * @returns {Object} - Collision properties
 */
export function getTileCollisionInfo(tileId, tileset) {
  const walkable = !tileset.impassableTiles.includes(tileId);
  
  // Determine tile type
  let type = 'PASSABLE';
  let surfable = false;
  let description = 'Passable ground';
  
  if (!walkable) {
    type = 'WALL';
    description = 'Impassable tile';
  }
  
  // Check for grass
  if (tileId === tileset.grassTile) {
    type = 'GRASS';
    description = 'Tall grass (encounters)';
  }
  
  // Check for water tiles (common water tile IDs)
  const waterTiles = [0x14, 0x32, 0x48];
  if (waterTiles.includes(tileId)) {
    type = 'WATER';
    surfable = tileId === 0x14 || tileId === 0x48; // Some water is surfable
    description = surfable ? 'Water (surfable)' : 'Water (not surfable)';
  }
  
  // Check for ledge tiles (based on pret/pokered LedgeTiles data)
  const ledgeTiles = [0x27, 0x0D, 0x1D, 0x36, 0x37];
  if (ledgeTiles.includes(tileId)) {
    type = 'LEDGE';
    description = 'Ledge tile';
  }
  
  return {
    tileId,
    type,
    walkable,
    surfable,
    description
  };
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

/**
 * Read complete tileset data (header + blocks + collision + graphics)
 * @param {Buffer} rom - ROM buffer
 * @param {number} tilesetId - Tileset ID
 * @returns {Object} - Complete tileset data
 */
export function readCompleteTileset(rom, tilesetId) {
  const header = readTilesetHeader(rom, tilesetId);
  const blocks = readTilesetBlocks(rom, header);
  const impassableTiles = readTilesetCollision(rom, header);
  const graphics = readTilesetGraphics(rom, header);
  
  return {
    ...header,
    blocks,
    impassableTiles,
    graphicsData: graphics,
    // Helper data
    numBlocks: blocks.length,
    numImpassableTiles: impassableTiles.length
  };
}
