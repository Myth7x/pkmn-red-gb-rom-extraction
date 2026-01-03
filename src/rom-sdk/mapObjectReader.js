/**
 * Map Object Reader for Pokemon Red/Blue
 * 
 * Reads warp events, sign/bg events, and sprite/NPC data from maps.
 * Based on pret/pokered map object structure.
 */

import { MAX_WARP_EVENTS, MAX_BG_EVENTS, MAX_OBJECT_EVENTS } from './mapConstants.js';
import { decodeMovementType, decodeMovementDirection, getMovementDescription } from '../constants/movementTypes.js';

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
 * Read map object data (warps, signs, sprites)
 * @param {Buffer} rom - ROM buffer
 * @param {Object} mapHeader - Map header with objectDataPtr
 * @param {number} bank - Bank containing object data
 * @returns {Object} - Object data including warps, signs, and sprites
 */
export function readMapObjects(rom, mapHeader, bank) {
  // Parse the object data pointer
  const objectDataPtr = parseInt(mapHeader.objectDataPtr, 16);
  let offset = bankPointerToOffset(bank, objectDataPtr);

  // Structure:
  // 1 byte: Border block tile
  // 1 byte: Number of warps
  // N * 4 bytes: Warp data (Y, X, warp ID, map ID)
  // 1 byte: Number of signs
  // N * 3 bytes: Sign data (Y, X, text ID)
  // 1 byte: Number of sprites
  // N * 6 bytes: Sprite data (picture ID, Y, X, movement, text ID low, text ID high)

  const borderBlock = rom[offset++];
  
  // Read warps
  const numWarps = rom[offset++];
  const warps = [];
  for (let i = 0; i < Math.min(numWarps, MAX_WARP_EVENTS); i++) {
    warps.push({
      y: rom[offset++],
      x: rom[offset++],
      destWarpId: rom[offset++],  // Destination warp ID on target map
      mapId: rom[offset++]         // Destination map ID
    });
  }

  // Read signs/bg events
  const numSigns = rom[offset++];
  const signs = [];
  for (let i = 0; i < Math.min(numSigns, MAX_BG_EVENTS); i++) {
    signs.push({
      y: rom[offset++],
      x: rom[offset++],
      textId: rom[offset++]
    });
  }

  // Read sprites/NPCs
  const numSprites = rom[offset++];
  const sprites = [];
  for (let i = 0; i < Math.min(numSprites, MAX_OBJECT_EVENTS); i++) {
    const pictureId = rom[offset++];
    const y = rom[offset++];
    const x = rom[offset++];
    const movementByte = rom[offset++];
    const rangeByte = rom[offset++];  // range/direction byte
    const textIdByte = rom[offset++];
    
    // Decode movement bytes
    const movementType = decodeMovementType(movementByte);
    const movementDirection = decodeMovementDirection(movementType, rangeByte);
    const movementDescription = getMovementDescription(movementByte, rangeByte);
    
    // Check if this is a trainer or item
    const TRAINER_FLAG = 0x40;
    const ITEM_FLAG = 0x80;
    
    let textId = textIdByte;
    let trainerClass = null;
    let trainerNumber = null;
    let itemId = null;
    let type = 'npc';
    
    if (textIdByte & TRAINER_FLAG) {
      // This is a trainer
      type = 'trainer';
      textId = textIdByte & ~TRAINER_FLAG;  // Remove trainer flag
      trainerClass = rom[offset++];
      trainerNumber = rom[offset++];
    } else if (textIdByte & ITEM_FLAG) {
      // This is an item
      type = 'item';
      textId = textIdByte & ~ITEM_FLAG;  // Remove item flag
      itemId = rom[offset++];
    }
    
    sprites.push({
      pictureId,
      y: y - 4,  // Y is stored as Y+4
      x: x - 4,  // X is stored as X+4
      movement: {
        byte1: movementByte,
        byte2: rangeByte,
        type: movementType,
        direction: movementDirection,
        description: movementDescription
      },
      textId,
      type,
      ...(trainerClass !== null && { trainerClass, trainerNumber }),
      ...(itemId !== null && { itemId })
    });
  }

  return {
    borderBlock,
    warps: {
      count: numWarps,
      data: warps
    },
    signs: {
      count: numSigns,
      data: signs
    },
    sprites: {
      count: numSprites,
      data: sprites
    }
  };
}

/**
 * Get human-readable object summary
 * @param {Object} objects - Map objects from readMapObjects
 * @returns {Object} - Summary statistics
 */
export function getObjectSummary(objects) {
  const trainers = objects.sprites.data.filter(s => s.type === 'trainer').length;
  const items = objects.sprites.data.filter(s => s.type === 'item').length;
  const npcs = objects.sprites.data.filter(s => s.type === 'npc').length;

  return {
    totalWarps: objects.warps.count,
    totalSigns: objects.signs.count,
    totalSprites: objects.sprites.count,
    trainers,
    items,
    npcs
  };
}
