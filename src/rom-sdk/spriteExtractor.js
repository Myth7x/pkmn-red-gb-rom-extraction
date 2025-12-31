/**
 * Sprite Extractor Module
 * 
 * Extracts sprite pointer data and metadata from Pokemon Red ROM base stats table.
 * The base stats table is stored in Pokedex order, but sprites are organized by index numbers
 * across different ROM banks. This module maps Pokedex numbers to index numbers and calculates
 * the correct ROM offsets for both front and back sprite data.
 */

import { findPattern, getBankRBY, ROM_PATTERNS } from './romReader.js';

// Mapping from Pokedex number (1-151) to index number (1-190)
// Index numbers determine which ROM bank contains each Pokemon's sprite data
const POKEDEX_TO_INDEX = [
  153, 9, 154, 176, 178, 180, 177, 179, 28, 123,
  124, 125, 112, 113, 114, 36, 150, 151, 165, 166,
  5, 35, 108, 45, 84, 85, 96, 97, 15, 168,
  16, 3, 167, 7, 4, 142, 82, 83, 100, 101,
  107, 130, 185, 186, 187, 109, 46, 65, 119, 59,
  118, 77, 144, 47, 128, 57, 117, 33, 20, 71,
  110, 111, 148, 38, 149, 106, 41, 126, 188, 189,
  190, 24, 155, 169, 39, 49, 163, 164, 37, 8,
  173, 54, 64, 70, 116, 58, 120, 13, 136, 23,
  139, 25, 147, 14, 34, 48, 129, 78, 138, 6,
  141, 12, 10, 17, 145, 43, 44, 11, 55, 143,
  18, 1, 40, 30, 2, 92, 93, 157, 158, 27,
  152, 42, 26, 72, 53, 51, 29, 60, 133, 22,
  19, 76, 102, 105, 104, 103, 170, 98, 99, 90,
  91, 171, 132, 74, 75, 73, 88, 89, 66, 131,
  21
];

/**
 * Extract sprite pointers and metadata from ROM
 * @param {Buffer} rom - ROM data
 * @param {String} spriteType - 'front' or 'back'
 * @returns {Array} Array of sprite data objects
 */
export function extractSpriteData(rom, spriteType = 'front') {
  console.log('Finding sprite data in ROM...');
  
  // Find base stats
  const baseStatsPos = findPattern(rom, ROM_PATTERNS.BULBASAUR_STATS);
  if (baseStatsPos === -1) {
    throw new Error('Could not find Bulbasaur stats');
  }
  console.log(`Base stats found at: 0x${baseStatsPos.toString(16)}`);
  
  // Find Mew stats (optional)
  const mewStatsPos = findPattern(rom, ROM_PATTERNS.MEW_STATS);
  if (mewStatsPos !== -1) {
    console.log(`Mew stats found at: 0x${mewStatsPos.toString(16)}`);
  }
  
  // Find pokedex order
  const pokedexOrderPos = findPattern(rom, ROM_PATTERNS.POKEDEX_ORDER_BYTES);
  if (pokedexOrderPos === -1) {
    throw new Error('Could not find pokedex order');
  }
  console.log(`Pokedex order found at: 0x${pokedexOrderPos.toString(16)}`);
  
  // Read sprite pointers
  console.log(`Reading ${spriteType} sprite pointers...`);
  const spritePointers = [];
  
  // Base stats are stored in POKEDEX ORDER (1-151)
  for (let pokedexNum = 1; pokedexNum <= 151; pokedexNum++) {
    const offset = baseStatsPos + (pokedexNum - 1) * 28;
    const storedPokedexNum = rom[offset]; // This should match pokedexNum
    const spriteSize = rom[offset + 10];
    const frontPointer = rom.readUInt16LE(offset + 11);
    const backPointer = rom.readUInt16LE(offset + 13);
    
    // Get the index number for this pokedex number
    // The index number determines which ROM bank contains the sprite
    const indexNum = POKEDEX_TO_INDEX[pokedexNum - 1];
    const bank = getBankRBY(indexNum);
    const base = (bank - 1) * 0x4000;
    
    // Choose front or back based on spriteType parameter
    const spriteOffset = spriteType === 'back' ? (base + backPointer) : (base + frontPointer);
    
    spritePointers.push({
      pokedexNumber: pokedexNum,
      indexNumber: indexNum,
      frontOffset: base + frontPointer,
      backOffset: base + backPointer,
      spriteOffset: spriteOffset, // Current sprite type offset
      size: spriteSize,
      spriteType: spriteType
    });
  }
  
  // Handle Mew separately (Pokedex #151, always at the end)
  if (mewStatsPos !== -1) {
    const offset = mewStatsPos;
    const spriteSize = rom[offset + 10];
    const frontPointer = rom.readUInt16LE(offset + 11);
    const backPointer = rom.readUInt16LE(offset + 13);
    
    const indexNum = POKEDEX_TO_INDEX[150]; // Mew = Pokedex #151, array index 150
    const bank = getBankRBY(indexNum);
    const base = (bank - 1) * 0x4000;
    
    const spriteOffset = spriteType === 'back' ? (base + backPointer) : (base + frontPointer);
    
    // Replace the last entry (Mew)
    spritePointers[150] = {
      pokedexNumber: 151,
      indexNumber: indexNum,
      frontOffset: base + frontPointer,
      backOffset: base + backPointer,
      spriteOffset: spriteOffset,
      size: spriteSize,
      spriteType: spriteType
    };
  }
  
  return spritePointers;
}