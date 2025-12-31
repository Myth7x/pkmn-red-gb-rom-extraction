/**
 * Tileset Extractor for Pokemon Red/Blue
 * 
 * Extracts map tileset graphics from ROM in 2bpp (2 bits per pixel) format.
 * Pokemon Red/Blue store 24 different tilesets for various map environments
 * (towns, routes, dungeons, etc.). Each tileset consists of 8x8 pixel tiles
 * stored as interleaved bitplanes. This module locates, extracts, and converts
 * these tiles into usable image data.
 */

import { findPattern } from './romReader.js';

// Tileset IDs from Pokemon Red/Blue
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

// Tileset header structure (12 bytes each)
// Each tileset header contains:
// - Bank (1 byte)
// - Block pointer (2 bytes)
// - GFX pointer (2 bytes)
// - Collision pointer (2 bytes)
// - Counter tiles (3 bytes)
// - Grass tile (1 byte)
// - Animation (1 byte)

/**
 * Find the tileset headers table in ROM
 * @param {Buffer} rom - The ROM buffer
 * @returns {number|null} - Offset of tileset headers table
 */
function findTilesetHeaders(rom) {
  // Search for a distinctive pattern in tileset headers
  // The first tileset (OVERWORLD) typically has specific values
  // Bank 0x0C or 0x0D, followed by block and gfx pointers
  
  // We'll search for the overworld tileset pattern
  // Looking for sequences that match tileset header structure
  const possibleOffsets = [];
  
  // Scan ROM for tileset header table
  // Tileset headers are typically in a fixed bank
  for (let i = 0; i < rom.length - 288; i++) { // 24 tilesets * 12 bytes = 288
    // Check if this looks like a tileset header table
    const bank = rom[i];
    
    // Banks should be in reasonable range (0x0C - 0x1F typically)
    if (bank >= 0x0C && bank <= 0x1F) {
      // Check if next entries also have valid bank values
      let validCount = 0;
      for (let j = 0; j < 24 && i + j * 12 < rom.length; j++) {
        const entryBank = rom[i + j * 12];
        if (entryBank >= 0x0C && entryBank <= 0x1F) {
          validCount++;
        }
      }
      
      if (validCount >= 20) { // Most tilesets should have valid banks
        possibleOffsets.push(i);
      }
    }
  }
  
  // Return the first reasonable match
  return possibleOffsets.length > 0 ? possibleOffsets[0] : null;
}

/**
 * Read tileset header from ROM
 * @param {Buffer} rom - The ROM buffer
 * @param {number} headerOffset - Offset to tileset headers table
 * @param {number} tilesetId - ID of the tileset (0-23)
 * @returns {Object} - Tileset header data
 */
function readTilesetHeader(rom, headerOffset, tilesetId) {
  const offset = headerOffset + (tilesetId * 12);
  
  if (offset + 12 > rom.length) {
    return null;
  }
  
  return {
    bank: rom[offset],
    blockPtr: rom.readUInt16LE(offset + 1),
    gfxPtr: rom.readUInt16LE(offset + 3),
    collPtr: rom.readUInt16LE(offset + 5),
    counterTiles: [rom[offset + 7], rom[offset + 8], rom[offset + 9]],
    grassTile: rom[offset + 10],
    animation: rom[offset + 11]
  };
}

/**
 * Convert ROM bank and pointer to absolute ROM offset
 * @param {number} bank - ROM bank number
 * @param {number} pointer - 16-bit pointer
 * @returns {number} - Absolute ROM offset
 */
function getAbsoluteOffset(bank, pointer) {
  if (bank === 0) {
    return pointer;
  }
  
  // Banks 1+ are mapped to 0x4000-0x7FFF
  // Bank N starts at (N - 1) * 0x4000
  const bankStart = (bank - 1) * 0x4000;
  const localOffset = pointer >= 0x4000 ? pointer - 0x4000 : pointer;
  return bankStart + localOffset;
}

/**
 * Decode 2bpp tile data into pixel array
 * Game Boy tiles are 8x8 pixels, 2 bits per pixel
 * Each tile is 16 bytes (8 rows * 2 bytes per row)
 * @param {Buffer} data - Raw 2bpp tile data
 * @param {number} numTiles - Number of tiles to decode
 * @returns {Array} - Array of tiles, each tile is 64 pixels (8x8)
 */
export function decode2bpp(data, numTiles) {
  const tiles = [];
  
  for (let tileIdx = 0; tileIdx < numTiles; tileIdx++) {
    const tileOffset = tileIdx * 16;
    if (tileOffset + 16 > data.length) break;
    
    const pixels = [];
    
    // Each tile is 8 rows
    for (let row = 0; row < 8; row++) {
      const byte1 = data[tileOffset + row * 2];     // Low bits
      const byte2 = data[tileOffset + row * 2 + 1]; // High bits
      
      // Each row is 8 pixels
      for (let col = 0; col < 8; col++) {
        const bitPos = 7 - col;
        const lowBit = (byte1 >> bitPos) & 1;
        const highBit = (byte2 >> bitPos) & 1;
        const pixel = (highBit << 1) | lowBit;
        pixels.push(pixel);
      }
    }
    
    tiles.push(pixels);
  }
  
  return tiles;
}

/**
 * Extract tileset graphics from ROM
 * @param {Buffer} rom - The ROM buffer
 * @param {number} tilesetId - ID of the tileset to extract
 * @returns {Object|null} - Tileset data or null if not found
 */
export function extractTileset(rom, tilesetId) {
  if (tilesetId < 0 || tilesetId >= TILESET_NAMES.length) {
    throw new Error(`Invalid tileset ID: ${tilesetId}`);
  }
  
  // Find tileset headers table
  const headerOffset = findTilesetHeaders(rom);
  if (!headerOffset) {
    throw new Error('Could not find tileset headers in ROM');
  }
  
  // Read header for this tileset
  const header = readTilesetHeader(rom, headerOffset, tilesetId);
  if (!header) {
    throw new Error(`Could not read header for tileset ${tilesetId}`);
  }
  
  // Calculate absolute offset for graphics data
  const gfxOffset = getAbsoluteOffset(header.bank, header.gfxPtr);
  
  // Tileset graphics are typically 128 tiles (0x600 bytes = 96 tiles for main, 32 for shared)
  // Main tileset: 96 tiles (0x600 bytes)
  const mainTileCount = 96;
  const tileDataSize = mainTileCount * 16; // 16 bytes per tile
  
  if (gfxOffset + tileDataSize > rom.length) {
    throw new Error(`Tileset graphics extend beyond ROM for tileset ${tilesetId}`);
  }
  
  // Extract graphics data
  const gfxData = rom.slice(gfxOffset, gfxOffset + tileDataSize);
  
  return {
    id: tilesetId,
    name: TILESET_NAMES[tilesetId],
    header: header,
    gfxOffset: gfxOffset,
    gfxData: gfxData,
    tiles: decode2bpp(gfxData, mainTileCount)
  };
}

/**
 * Extract all tilesets from ROM
 * @param {Buffer} rom - The ROM buffer
 * @returns {Array} - Array of tileset objects
 */
export function extractAllTilesets(rom) {
  const tilesets = [];
  const errors = [];
  
  for (let i = 0; i < TILESET_NAMES.length; i++) {
    try {
      const tileset = extractTileset(rom, i);
      if (tileset) {
        tilesets.push(tileset);
      }
    } catch (error) {
      errors.push({ tilesetId: i, name: TILESET_NAMES[i], error: error.message });
    }
  }
  
  return { tilesets, errors };
}
