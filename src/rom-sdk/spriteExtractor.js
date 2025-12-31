/**
 * Sprite Extractor Module
 * 
 * Extracts sprite pointer data and metadata from Pokemon Red ROM base stats table.
 * The base stats table is stored in Pokedex order, but each entry contains the internal
 * index ID which determines which ROM bank contains that Pokemon's sprite data.
 */

import { findPattern, getBankRBY, ROM_PATTERNS } from './romReader.js';

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
  
  // Build Pokedex Number → Internal ID mapping from the Pokedex Order table
  const pokedexToInternalId = new Array(152).fill(0);
  for (let internalId = 1; internalId <= 190; internalId++) {
    const pokedexNum = rom[pokedexOrderPos + internalId - 1];
    if (pokedexNum > 0 && pokedexNum <= 151) {
      pokedexToInternalId[pokedexNum] = internalId;
    }
  }
  
  // Read sprite pointers
  console.log(`Reading ${spriteType} sprite pointers...`);
  const spritePointers = [];
  
  // Base stats are stored in POKEDEX ORDER (1-151)
  for (let pokedexNum = 1; pokedexNum <= 151; pokedexNum++) {
    const offset = baseStatsPos + (pokedexNum - 1) * 28;
    const storedPokedexNum = rom[offset]; // First byte confirms this is the right entry
    const spriteSize = rom[offset + 10];
    const frontPointer = rom.readUInt16LE(offset + 11);
    const backPointer = rom.readUInt16LE(offset + 13);
    
    // Look up the internal ID for this Pokedex number
    const internalId = pokedexToInternalId[pokedexNum];
    if (!internalId) {
      console.warn(`Warning: No internal ID found for Pokedex #${pokedexNum}`);
      continue;
    }
    
    // Use the internal ID to determine the bank
    const bank = getBankRBY(internalId);
    const base = (bank - 1) * 0x4000;
    
    // Calculate ROM file offsets
    const frontOffset = base + frontPointer;
    const backOffset = base + backPointer;
    
    // Choose front or back based on spriteType parameter
    const spriteOffset = spriteType === 'back' ? backOffset : frontOffset;
    
    spritePointers.push({
      pokedexNumber: pokedexNum,
      indexNumber: internalId, // Internal ID for reference
      frontOffset: frontOffset,
      backOffset: backOffset,
      spriteOffset: spriteOffset, // Current sprite type offset
      size: spriteSize,
      spriteType: spriteType
    });
  }
  
  // Handle Mew separately (Pokedex #151, always at the end)
  // Mew's sprite data is stored differently - uses direct ROM offsets
  if (mewStatsPos !== -1) {
    const offset = mewStatsPos;
    const spriteSize = rom[offset + 10];
    const frontPointer = rom.readUInt16LE(offset + 11);
    const backPointer = rom.readUInt16LE(offset + 13);
    
    // Mew uses internal ID 0x15 (21 decimal) and is in bank 0x01
    const indexNum = 21; // Mew's internal ID
    
    // Mew's sprite offsets are direct ROM addresses, not bank-relative
    const spriteOffset = spriteType === 'back' ? backPointer : frontPointer;
    
    // Replace the last entry (Mew)
    spritePointers[150] = {
      pokedexNumber: 151,
      indexNumber: indexNum,
      frontOffset: frontPointer,
      backOffset: backPointer,
      spriteOffset: spriteOffset,
      size: spriteSize,
      spriteType: spriteType
    };
  }
  
  return spritePointers;
}