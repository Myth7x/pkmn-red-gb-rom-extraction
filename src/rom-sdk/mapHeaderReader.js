/**
 * Map Header Reader for Pokemon Red/Blue
 * 
 * Reads map headers from ROM including dimensions, tileset, connections, and pointers.
 * Based on pret/pokered disassembly structure.
 */

import {
  MAP_HEADER_OFFSETS,
  CONNECTIONS,
  CONNECTION_HEADER_SIZE,
  CONNECTION_OFFSETS,
  MAP_NAMES,
  TILESET_NAMES,
  NUM_MAPS
} from './mapConstants.js';

// Known ROM offsets for map data (Pokemon Red USA)
// Source: https://datacrystal.tcrf.net/wiki/Pokémon_Red_and_Blue/ROM_map
const MAP_HEADER_BANKS_OFFSET = 0xC23D;  // Bank 3: C23D-C334 Indicates which banks maps are in
const MAP_HEADER_POINTERS_OFFSET = 0x01AE; // Bank 0: 01AE-0390 Map Header Pointers

/**
 * Read map header banks table
 * @param {Buffer} rom - ROM buffer
 * @returns {Uint8Array} - Array of bank IDs for each map
 */
export function readMapHeaderBanks(rom) {
  const banks = new Uint8Array(NUM_MAPS);
  for (let i = 0; i < NUM_MAPS; i++) {
    banks[i] = rom[MAP_HEADER_BANKS_OFFSET + i];
  }
  return banks;
}

/**
 * Read map header pointers table
 * @param {Buffer} rom - ROM buffer
 * @returns {Uint16Array} - Array of pointers (within their respective banks)
 */
export function readMapHeaderPointers(rom) {
  const pointers = new Uint16Array(NUM_MAPS);
  for (let i = 0; i < NUM_MAPS; i++) {
    const offset = MAP_HEADER_POINTERS_OFFSET + i * 2;
    pointers[i] = rom.readUInt16LE(offset);
  }
  return pointers;
}

/**
 * Convert bank + pointer to ROM offset
 * @param {number} bank - ROM bank number
 * @param {number} pointer - 16-bit pointer within bank
 * @returns {number} - Absolute ROM offset
 */
function bankPointerToOffset(bank, pointer) {
  // Game Boy banking: bank 0 is 0x0000-0x3FFF, banks 1+ are at (bank) * 0x4000
  // Pointers in range 0x4000-0x7FFF are bank-switchable region
  if (pointer >= 0x4000 && pointer < 0x8000) {
    // Pointer is in switchable bank region
    return (bank - 1) * 0x4000 + pointer;
  } else if (pointer < 0x4000) {
    // Pointer is in fixed bank 0 region
    return pointer;
  } else {
    // Invalid pointer
    throw new Error(`Invalid pointer: 0x${pointer.toString(16)}`);
  }
}

/**
 * Read connection header data
 * @param {Buffer} rom - ROM buffer
 * @param {number} offset - Start offset of connection header
 * @returns {Object} - Connection data
 */
function readConnectionHeader(rom, offset) {
  // Read alignment as signed bytes (they can be negative offsets)
  const yAlignmentByte = rom[offset + CONNECTION_OFFSETS.Y_ALIGNMENT];
  const xAlignmentByte = rom[offset + CONNECTION_OFFSETS.X_ALIGNMENT];
  
  return {
    connectedMap: rom[offset + CONNECTION_OFFSETS.CONNECTED_MAP],
    connectionStripSrc: rom.readUInt16LE(offset + CONNECTION_OFFSETS.CONNECTION_STRIP_SRC),
    connectionStripDest: rom.readUInt16LE(offset + CONNECTION_OFFSETS.CONNECTION_STRIP_DEST),
    connectionStripLength: rom[offset + CONNECTION_OFFSETS.CONNECTION_STRIP_LENGTH],
    connectedMapWidth: rom[offset + CONNECTION_OFFSETS.CONNECTED_MAP_WIDTH],
    // Convert to signed byte (two's complement)
    yAlignment: yAlignmentByte > 127 ? yAlignmentByte - 256 : yAlignmentByte,
    xAlignment: xAlignmentByte > 127 ? xAlignmentByte - 256 : xAlignmentByte,
    windowPtr: rom.readUInt16LE(offset + CONNECTION_OFFSETS.WINDOW_PTR)
  };
}

/**
 * Read a single map header
 * @param {Buffer} rom - ROM buffer
 * @param {number} mapId - Map ID (0-247)
 * @param {Uint8Array} banks - Map header banks array
 * @param {Uint16Array} pointers - Map header pointers array
 * @returns {Object} - Map header data
 */
export function readMapHeader(rom, mapId, banks, pointers) {
  const bank = banks[mapId];
  const pointer = pointers[mapId];
  const offset = bankPointerToOffset(bank, pointer);

  // Read basic header data
  const tileset = rom[offset + MAP_HEADER_OFFSETS.TILESET];
  const height = rom[offset + MAP_HEADER_OFFSETS.HEIGHT]; // in 4x4 tile blocks
  const width = rom[offset + MAP_HEADER_OFFSETS.WIDTH];   // in 4x4 tile blocks
  const blocksPtr = rom.readUInt16LE(offset + MAP_HEADER_OFFSETS.BLOCKS_PTR);
  const textPtr = rom.readUInt16LE(offset + MAP_HEADER_OFFSETS.TEXT_PTR);
  const scriptPtr = rom.readUInt16LE(offset + MAP_HEADER_OFFSETS.SCRIPT_PTR);
  const connectionsByte = rom[offset + MAP_HEADER_OFFSETS.CONNECTIONS];

  // Parse connections
  const connections = {
    north: !!(connectionsByte & CONNECTIONS.NORTH),
    south: !!(connectionsByte & CONNECTIONS.SOUTH),
    west: !!(connectionsByte & CONNECTIONS.WEST),
    east: !!(connectionsByte & CONNECTIONS.EAST)
  };

  // Read connection headers if present
  let connOffset = offset + MAP_HEADER_OFFSETS.CONNECTIONS + 1;
  const connectionHeaders = {};

  if (connections.north) {
    connectionHeaders.north = readConnectionHeader(rom, connOffset);
    connOffset += CONNECTION_HEADER_SIZE;
  }
  if (connections.south) {
    connectionHeaders.south = readConnectionHeader(rom, connOffset);
    connOffset += CONNECTION_HEADER_SIZE;
  }
  if (connections.west) {
    connectionHeaders.west = readConnectionHeader(rom, connOffset);
    connOffset += CONNECTION_HEADER_SIZE;
  }
  if (connections.east) {
    connectionHeaders.east = readConnectionHeader(rom, connOffset);
    connOffset += CONNECTION_HEADER_SIZE;
  }

  // Object data pointer is after connection headers
  const objectDataPtr = rom.readUInt16LE(connOffset);

  return {
    mapId,
    name: MAP_NAMES[mapId] || `Map ${mapId}`,
    bank,
    offset: `0x${offset.toString(16).toUpperCase()}`,
    tileset,
    tilesetName: TILESET_NAMES[tileset] || `Tileset ${tileset}`,
    width,
    height,
    widthPixels: width * 32, // 4 tiles * 8 pixels
    heightPixels: height * 32,
    blocksPtr: `0x${blocksPtr.toString(16).toUpperCase()}`,
    textPtr: `0x${textPtr.toString(16).toUpperCase()}`,
    scriptPtr: `0x${scriptPtr.toString(16).toUpperCase()}`,
    objectDataPtr: `0x${objectDataPtr.toString(16).toUpperCase()}`,
    connections,
    connectionHeaders
  };
}

/**
 * Read all map headers from ROM
 * @param {Buffer} rom - ROM buffer
 * @param {Array<number>} mapIds - Optional array of specific map IDs to read
 * @returns {Array<Object>} - Array of map header data
 */
export function readAllMapHeaders(rom, mapIds = null) {
  console.log('Reading map header banks and pointers...');
  const banks = readMapHeaderBanks(rom);
  const pointers = readMapHeaderPointers(rom);

  const mapsToRead = mapIds || Array.from({ length: NUM_MAPS }, (_, i) => i);
  const headers = [];

  console.log(`Reading ${mapsToRead.length} map headers...`);
  
  for (const mapId of mapsToRead) {
    try {
      const header = readMapHeader(rom, mapId, banks, pointers);
      headers.push(header);
    } catch (error) {
      console.warn(`[WARNING] Failed to read map ${mapId}: ${error.message}`);
    }
  }

  return headers;
}

/**
 * Extract map block data (the actual tile layout)
 * @param {Buffer} rom - ROM buffer
 * @param {Object} mapHeader - Map header object
 * @param {number} bank - Bank containing the block data
 * @returns {Uint8Array} - Map block data
 */
export function readMapBlockData(rom, mapHeader, bank) {
  // Parse the blocks pointer (it's a hex string)
  const blocksPtr = parseInt(mapHeader.blocksPtr, 16);
  const offset = bankPointerToOffset(bank, blocksPtr);
  const size = mapHeader.width * mapHeader.height;
  
  return rom.slice(offset, offset + size);
}
