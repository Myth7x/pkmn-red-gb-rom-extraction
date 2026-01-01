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
 * @param {number} textId - Text ID from sprite or sign data (may have flags)
 * @returns {Object} - Text data with raw bytes and decoded text
 */
export function extractScriptText(rom, mapHeader, bank, textId) {
  try {
    // Constants from pret/pokered
    const BIT_TRAINER = 6;
    const BIT_ITEM = 7;
    const TRAINER_FLAG = 1 << BIT_TRAINER; // 0x40
    const ITEM_FLAG = 1 << BIT_ITEM;       // 0x80
    
    // Check if this is a trainer sprite
    if (textId & TRAINER_FLAG) {
      return {
        textId,
        isTrainer: true,
        decodedText: '[Trainer]',
        bytes: [],
        hexString: '',
        asciiString: '',
        foundEnd: true,
        length: 0
      };
    }
    
    // Check if this is an item sprite  
    if (textId & ITEM_FLAG) {
      return {
        textId,
        isItem: true,
        decodedText: '[Item]',
        bytes: [],
        hexString: '',
        asciiString: '',
        foundEnd: true,
        length: 0
      };
    }
    
    // Special text IDs that are script handlers, not actual text
    // These IDs point to code routines like Pokecenter Nurse, Mart, PC, etc.
    const SPECIAL_SCRIPT_IDS = [
      0x00, // TX_SCRIPT_MART
      0x01, // TX_SCRIPT_POKECENTER_NURSE  
      0x02, // TX_SCRIPT_PLAYERS_PC
      0x03, // TX_SCRIPT_BILLS_PC
      0x04, // TX_SCRIPT_POKECENTER_PC
      0x05, // TX_SCRIPT_INTRO_NIDORINO
      0x06, // TX_SCRIPT_VENDING_MACHINE
      0x07, // TX_SCRIPT_PRIZE_VENDOR
      0x08, // TX_SCRIPT_CABLE_CLUB_RECEPTIONIST
    ];
    
    // Check if this is a special script handler
    if (textId < 0x09) {
      const scriptNames = [
        'Pokémart', 'Pokécenter Nurse', 'Player PC', 'Bill PC', 'Pokécenter PC',
        'Intro (Nidorino)', 'Vending Machine', 'Prize Vendor', 'Cable Club'
      ];
      return {
        textId,
        isSpecialScript: true,
        scriptType: scriptNames[textId] || `Special Handler 0x${textId.toString(16)}`,
        decodedText: `[${scriptNames[textId] || 'Special Script'}]`,
        bytes: [],
        hexString: '',
        asciiString: '',
        foundEnd: true,
        length: 0
      };
    }
    
    // Text ID 0 is also invalid  
    if (textId === 0) {
      return {
        textId: 0,
        isEmpty: true,
        decodedText: '',
        bytes: [],
        hexString: '',
        asciiString: '',
        foundEnd: true,
        length: 0
      };
    }
    
    // Parse text pointer table address from map header
    const textPtrTableAddr = parseInt(mapHeader.textPtr, 16);
    const textPtrTableOffset = bankPointerToOffset(bank, textPtrTableAddr);
    
    // Text IDs are 1-indexed in the table, so subtract 1
    // This matches the "dec a" operation in DisplayTextID (text_script.asm line 53)
    const tableIndex = textId - 1;
    
    // Get pointer to actual text data
    const textDataPtr = readTextPointer(rom, textPtrTableOffset, tableIndex);
    
    // Validate pointer range before extracting
    // Valid pointers should be in ROM bank range (0x4000-0x7FFF) or low RAM (0x0000-0x3FFF)
    if (textDataPtr >= 0x8000) {
      return {
        textId,
        isInvalidPointer: true,
        textDataPtr: `0x${textDataPtr.toString(16).toUpperCase()}`,
        decodedText: '[Invalid Text Pointer]',
        bytes: [],
        hexString: '',
        asciiString: '',
        foundEnd: false,
        length: 0
      };
    }
    
    // Extract raw text bytes
    const textData = extractRawTextBytes(rom, textDataPtr, bank);
    
    // Decode text to readable string (passing ROM so we can follow TX_FAR commands)
    const textDataOffset = bankPointerToOffset(bank, textDataPtr);
    const decodedText = decodeText(textData.bytes, rom, textDataOffset);
    
    return {
      textId,
      textPtrTable: `0x${textPtrTableAddr.toString(16).toUpperCase()}`,
      textDataPtr: `0x${textDataPtr.toString(16).toUpperCase()}`,
      decodedText,
      ...textData
    };
  } catch (error) {
    return {
      textId,
      error: error.message,
      bytes: [],
      hexString: '',
      asciiString: '',
      decodedText: '[Error]',
      foundEnd: false,
      length: 0
    };
  }
}

/**
 * Complete character map for Pokemon Red text decoding
 * Based on charmap.asm from pret/pokered
 */
export const POKEMON_CHAR_MAP = {
  // Control characters
  0x00: '[NULL]',
  0x49: '[PAGE]',
  0x4E: '[NEXT]',
  0x4F: '\n',           // LINE
  0x50: '',             // END (terminator, no display)
  0x51: '\n\n',         // PARA
  0x52: '[PLAYER]',
  0x53: '[RIVAL]',
  0x54: 'POKé',
  0x55: '[CONT]',
  0x56: '……',
  0x57: '▼',            // PROMPT
  0x58: '[TARGET]',
  0x59: '[USER]',
  0x5B: 'PC',
  0x5C: 'TM',
  0x5D: 'TRAINER',
  0x5E: 'ROCKET',
  0x5F: '[DEXEND]',
  
  // Special characters
  0x6D: ':',
  0x70: '\u2018',       // opening single quote
  0x71: '\u2019',       // closing single quote
  0x72: '\u201C',       // opening double quote
  0x73: '\u201D',       // closing double quote
  0x74: '·',
  0x75: '…',
  0x79: '┌',
  0x7A: '─',
  0x7B: '┐',
  0x7C: '│',
  0x7D: '└',
  0x7E: '┘',
  0x7F: ' ',
  
  // Uppercase letters
  0x80: 'A', 0x81: 'B', 0x82: 'C', 0x83: 'D', 0x84: 'E', 0x85: 'F', 0x86: 'G',
  0x87: 'H', 0x88: 'I', 0x89: 'J', 0x8A: 'K', 0x8B: 'L', 0x8C: 'M', 0x8D: 'N',
  0x8E: 'O', 0x8F: 'P', 0x90: 'Q', 0x91: 'R', 0x92: 'S', 0x93: 'T', 0x94: 'U',
  0x95: 'V', 0x96: 'W', 0x97: 'X', 0x98: 'Y', 0x99: 'Z',
  
  // Punctuation
  0x9A: '(', 0x9B: ')', 0x9C: ':', 0x9D: ';', 0x9E: '[', 0x9F: ']',
  
  // Lowercase letters
  0xA0: 'a', 0xA1: 'b', 0xA2: 'c', 0xA3: 'd', 0xA4: 'e', 0xA5: 'f', 0xA6: 'g',
  0xA7: 'h', 0xA8: 'i', 0xA9: 'j', 0xAA: 'k', 0xAB: 'l', 0xAC: 'm', 0xAD: 'n',
  0xAE: 'o', 0xAF: 'p', 0xB0: 'q', 0xB1: 'r', 0xB2: 's', 0xB3: 't', 0xB4: 'u',
  0xB5: 'v', 0xB6: 'w', 0xB7: 'x', 0xB8: 'y', 0xB9: 'z',
  
  // Lowercase contractions
  0xBA: 'é', 0xBB: "'d", 0xBC: "'l", 0xBD: "'s", 0xBE: "'t", 0xBF: "'v",
  
  // More special characters
  0xE0: "'", 0xE1: 'PK', 0xE2: 'MN', 0xE3: '-',
  0xE4: "'r", 0xE5: "'m",
  0xE6: '?', 0xE7: '!', 0xE8: '.',
  0xEC: '▷', 0xED: '▶', 0xEE: '▼', 0xEF: '♂',
  0xF0: '¥', 0xF1: '×', 0xF2: '.', 0xF3: '/', 0xF4: ',', 0xF5: '♀',
  
  // Numbers
  0xF6: '0', 0xF7: '1', 0xF8: '2', 0xF9: '3', 0xFA: '4',
  0xFB: '5', 0xFC: '6', 0xFD: '7', 0xFE: '8', 0xFF: '9',
};

/**
 * Decode Pokemon Red text bytes to readable string
 * Handles text commands like TX_FAR, TX_START, etc.
 * @param {Buffer} rom - ROM buffer for following TX_FAR pointers
 * @param {Array<number>} bytes - Array of text bytes
 * @param {number} romOffset - ROM offset of this text (for TX_FAR resolution)
 * @returns {string} - Decoded text
 */
export function decodeText(bytes, rom = null, romOffset = 0) {
  let result = '';
  let i = 0;
  const MAX_RECURSION = 5;
  let recursionDepth = 0;
  
  // Text command constants
  const TX_START = 0x00;
  const TX_RAM = 0x01;
  const TX_BCD = 0x02;
  const TX_MOVE = 0x03;
  const TX_BOX = 0x04;
  const TX_LOW = 0x05;
  const TX_PROMPT_BUTTON = 0x06;
  const TX_SCROLL = 0x07;
  const TX_START_ASM = 0x08;
  const TX_NUM = 0x09;
  const TX_PAUSE = 0x0A;
  const TX_SOUND = 0x0B;
  const TX_DOTS = 0x0C;
  const TX_WAIT_BUTTON = 0x0D;
  const TX_FAR = 0x17;
  const TX_END = 0x50;
  
  while (i < bytes.length) {
    const byte = bytes[i++];
    
    // Text terminator
    if (byte === TX_END) {
      break;
    }
    
    // TX_FAR command - read text from different bank (3 bytes: ptr_low, ptr_high, bank)
    if (byte === TX_FAR) {
      if (i + 2 < bytes.length && rom && recursionDepth < MAX_RECURSION) {
        const ptrLow = bytes[i++];
        const ptrHigh = bytes[i++];
        const bank = bytes[i++];
        const farPtr = ptrLow | (ptrHigh << 8);
        
        // Calculate ROM offset from bank + pointer
        let farOffset = null;
        if (farPtr >= 0x4000 && farPtr < 0x8000) {
          farOffset = (bank - 1) * 0x4000 + farPtr;
        } else if (farPtr < 0x4000) {
          farOffset = farPtr;
        }
        
        if (farOffset !== null && farOffset < rom.length) {
          // Read and decode the far text recursively
          const farBytes = [];
          for (let j = farOffset; j < rom.length && farBytes.length < 1000; j++) {
            const b = rom[j];
            farBytes.push(b);
            if (b === TX_END) break;
          }
          recursionDepth++;
          result += decodeText(farBytes, rom, farOffset);
          recursionDepth--;
        } else {
          result += `[BAD_FAR:${farPtr.toString(16)}@${bank}]`;
        }
      } else {
        result += `[TX_FAR]`;
        i += 3; // Skip the 3 parameter bytes
      }
      continue;
    }
    
    // TX_START command - inline text follows until 0x50
    if (byte === TX_START) {
      while (i < bytes.length) {
        const ch = bytes[i++];
        if (ch === TX_END) break;
        result += POKEMON_CHAR_MAP[ch] || `[${ch.toString(16).toUpperCase().padStart(2, '0')}]`;
      }
      continue;
    }
    
    // TX_RAM - variable placeholder
    if (byte === TX_RAM) {
      result += '[VAR]';
      i += 2; // Skip 2-byte address
      continue;
    }
    
    // TX_NUM - number placeholder
    if (byte === TX_NUM) {
      result += '[NUM]';
      i += 3; // Skip address (2) + flags (1)
      continue;
    }
    
    // TX_BCD - BCD number
    if (byte === TX_BCD) {
      result += '[BCD]';
      i += 3; // Skip address (2) + flags (1)
      continue;
    }
    
    // TX_MOVE - reposition cursor
    if (byte === TX_MOVE) {
      i += 2; // Skip 2-byte destination
      continue;
    }
    
    // TX_BOX - draw text box
    if (byte === TX_BOX) {
      i += 4; // Skip address (2) + height (1) + width (1)
      continue;
    }
    
    // TX_SCROLL - scroll text up
    if (byte === TX_SCROLL) {
      result += '\n';
      continue;
    }
    
    // TX_LOW, TX_PROMPT_BUTTON, TX_PAUSE, TX_WAIT_BUTTON - no parameters, just formatting
    if ([TX_LOW, TX_PROMPT_BUTTON, TX_PAUSE, TX_WAIT_BUTTON].includes(byte)) {
      continue;
    }
    
    // TX_START_ASM - assembly code follows (can't parse)
    if (byte === TX_START_ASM) {
      result += '[ASM]';
      break;
    }
    
    // TX_DOTS - print N dots
    if (byte === TX_DOTS) {
      const count = i < bytes.length ? bytes[i++] : 3;
      result += '…'.repeat(count || 3);
      continue;
    }
    
    // TX_SOUND - sound effect (1 byte parameter)
    if (byte >= TX_SOUND && byte <= 0x16) {
      i++; // Skip sound ID
      continue;
    }
    
    // Regular character
    if (POKEMON_CHAR_MAP.hasOwnProperty(byte)) {
      result += POKEMON_CHAR_MAP[byte];
    } else {
      // Unknown character - show as hex
      result += `[${byte.toString(16).toUpperCase().padStart(2, '0')}]`;
    }
  }
  
  return result;
}
