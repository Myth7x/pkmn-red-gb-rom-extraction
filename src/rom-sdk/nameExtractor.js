/**
 * Pokemon Name Extractor
 * 
 * Extracts Pokemon names directly from ROM data using the game's internal character encoding.
 * Names are stored at offset 0x1C21E (115230 decimal) in index number order, with each name
 * being exactly 10 bytes long and terminated with 0x50. Handles special characters including
 * spaces, apostrophes, hyphens, and gender symbols.
 */

// Character encoding dictionary for Pokemon Red/Blue
// Based on the game's internal character table
const CHAR_MAP = {
  127: ' ',
  128: 'A', 129: 'B', 130: 'C', 131: 'D', 132: 'E', 133: 'F', 134: 'G',
  135: 'H', 136: 'I', 137: 'J', 138: 'K', 139: 'L', 140: 'M', 141: 'N',
  142: 'O', 143: 'P', 144: 'Q', 145: 'R', 146: 'S', 147: 'T', 148: 'U',
  149: 'V', 150: 'W', 151: 'X', 152: 'Y', 153: 'Z',
  186: 'E',  // Special E
  224: "'",  // Apostrophe
  227: '-',  // Hyphen
  232: '.',  // Period
  239: 'M',  // Male symbol ♂
  245: 'F',  // Female symbol ♀
  246: '0', 247: '1', 248: '2', 249: '3', 250: '4',
  251: '5', 252: '6', 253: '7', 254: '8', 255: '9'
};

/**
 * Read a Pokemon name from ROM
 * @param {Buffer} rom - The ROM buffer
 * @param {number} offset - Starting offset
 * @returns {string} - Pokemon name
 */
function readPokemonName(rom, offset) {
  let name = '';
  
  for (let i = 0; i < 10; i++) { // Pokemon names are exactly 10 bytes
    const byte = rom[offset + i];
    
    // 0x50 is the terminator - end of name
    if (byte === 0x50) {
      break;
    }
    
    // Map byte to character
    if (CHAR_MAP[byte]) {
      name += CHAR_MAP[byte];
    }
  }
  
  return name.trim() || 'UNKNOWN';
}


/**
 * Extract all Pokemon names from ROM (in internal ID order)
 * Names are stored at 0x1C21E (115230 decimal) in internal ID order
 * Each name is exactly 10 bytes
 * @param {Buffer} rom - The ROM buffer
 * @returns {Array<string>} - Array of Pokemon names (index 0-189 for internal IDs)
 */
export function extractPokemonNames(rom) {
  const pokemonNameStartByte = 115230; // 0x1C21E - Pokemon names start here
  const names = [];
  
  // Read 190 names (190 internal IDs in Gen 1)
  for (let i = 0; i < 190; i++) {
    const offset = pokemonNameStartByte + (i * 10);
    const name = readPokemonName(rom, offset);
    names.push(name);
  }
  
  return names;
}

/**
 * Get Pokemon name by internal ID
 * @param {Array<string>} names - Names array from extractPokemonNames
 * @param {number} internalId - Internal ID (1-190)
 * @returns {string} - Pokemon name
 */
export function getPokemonNameByInternalId(names, internalId) {
  if (internalId < 1 || internalId > names.length) {
    return `UNKNOWN_${internalId}`;
  }
  return names[internalId - 1] || `UNKNOWN_${internalId}`;
}
