/**
 * Script Text Reader for Pokemon Red/Blue
 * 
 * Extracts script text from ROM based on text ID pointers.
 * Text scripts in Pokemon Red use a complex pointer table system with text commands.
 * 
 * For now, this extracts raw bytes as hex/ASCII for inspection.
 * Full text parsing would require implementing all text commands and character mapping.
 */

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
 * Read text pointer from text pointer table
 * @param {Buffer} rom - ROM buffer
 * @param {number} textPtrTableOffset - Offset of text pointer table
 * @param {number} textId - Text ID (0-based index into table)
 * @returns {number} - Pointer to text data
 */
function readTextPointer(rom, textPtrTableOffset, textId) {
  const offset = textPtrTableOffset + (textId * 2);
  return rom.readUInt16LE(offset);
}

/**
 * Extract raw script text bytes
 * @param {Buffer} rom - ROM buffer
 * @param {number} textPtr - Pointer to text data
 * @param {number} bank - Bank containing text data
 * @param {number} maxBytes - Maximum bytes to extract (default 256)
 * @returns {Object} - Raw text data with hex and ASCII representation
 */
function extractRawTextBytes(rom, textPtr, bank, maxBytes = 256) {
  const offset = bankPointerToOffset(bank, textPtr);
  
  // Text in Pokemon Red ends with 0x50 (text_end) or 0x57 (text_prompt) + 0x50
  const bytes = [];
  let foundEnd = false;
  
  for (let i = 0; i < maxBytes && offset + i < rom.length; i++) {
    const byte = rom[offset + i];
    bytes.push(byte);
    
    // Check for text_end (0x50)
    if (byte === 0x50) {
      foundEnd = true;
      break;
    }
  }
  
  // Convert to hex string
  const hexString = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  
  // Convert to ASCII (for printable chars, '.' for others)
  const asciiString = bytes.map(b => {
    if (b >= 0x20 && b <= 0x7E) {
      return String.fromCharCode(b);
    } else if (b === 0x50) {
      return '[END]';
    } else if (b === 0x4F) {
      return '[LINE]';
    } else if (b === 0x51) {
      return '[PARA]';
    } else if (b === 0x57) {
      return '[PROMPT]';
    } else {
      return '.';
    }
  }).join('');
  
  return {
    bytes,
    hexString,
    asciiString,
    foundEnd,
    length: bytes.length,
    romOffset: `0x${offset.toString(16).toUpperCase()}`
  };
}

/**
 * Extract script text for an NPC or sign
 * @param {Buffer} rom - ROM buffer
 * @param {Object} mapHeader - Map header with textPtr
 * @param {number} bank - Bank containing map data
 * @param {number} textId - Text ID from sprite or sign data
 * @returns {Object} - Text data with raw bytes
 */
export function extractScriptText(rom, mapHeader, bank, textId) {
  try {
    // Parse text pointer table address from map header
    const textPtrTableAddr = parseInt(mapHeader.textPtr, 16);
    const textPtrTableOffset = bankPointerToOffset(bank, textPtrTableAddr);
    
    // Get pointer to actual text data
    const textDataPtr = readTextPointer(rom, textPtrTableOffset, textId);
    
    // Extract raw text bytes
    const textData = extractRawTextBytes(rom, textDataPtr, bank);
    
    return {
      textId,
      textPtrTable: `0x${textPtrTableAddr.toString(16).toUpperCase()}`,
      textDataPtr: `0x${textDataPtr.toString(16).toUpperCase()}`,
      ...textData
    };
  } catch (error) {
    return {
      textId,
      error: error.message,
      bytes: [],
      hexString: '',
      asciiString: '[ERROR: Could not extract text]',
      foundEnd: false,
      length: 0
    };
  }
}

/**
 * Character map for Pokemon Red text decoding
 * This is a simplified version - full implementation would need all characters
 */
export const POKEMON_CHAR_MAP = {
  0x50: '[END]',
  0x4F: '\n',
  0x51: '\n\n',
  0x57: '[▼]',
  0x7F: ' ',
  0x80: 'A', 0x81: 'B', 0x82: 'C', 0x83: 'D', 0x84: 'E', 0x85: 'F', 0x86: 'G',
  0x87: 'H', 0x88: 'I', 0x89: 'J', 0x8A: 'K', 0x8B: 'L', 0x8C: 'M', 0x8D: 'N',
  0x8E: 'O', 0x8F: 'P', 0x90: 'Q', 0x91: 'R', 0x92: 'S', 0x93: 'T', 0x94: 'U',
  0x95: 'V', 0x96: 'W', 0x97: 'X', 0x98: 'Y', 0x99: 'Z',
  0xA0: 'a', 0xA1: 'b', 0xA2: 'c', 0xA3: 'd', 0xA4: 'e', 0xA5: 'f', 0xA6: 'g',
  0xA7: 'h', 0xA8: 'i', 0xA9: 'j', 0xAA: 'k', 0xAB: 'l', 0xAC: 'm', 0xAD: 'n',
  0xAE: 'o', 0xAF: 'p', 0xB0: 'q', 0xB1: 'r', 0xB2: 's', 0xB3: 't', 0xB4: 'u',
  0xB5: 'v', 0xB6: 'w', 0xB7: 'x', 0xB8: 'y', 0xB9: 'z',
};
