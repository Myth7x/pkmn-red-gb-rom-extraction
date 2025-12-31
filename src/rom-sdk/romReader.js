/**
 * ROM Reader Module
 * 
 * Core module for reading and parsing Pokemon Red/Blue ROM files.
 * Provides utilities for pattern matching to locate data structures,
 * bank address calculations for the Game Boy's memory-mapped banking system,
 * and ROM file loading with header validation. Essential for all ROM extraction operations.
 */

import fs from 'fs';

/**
 * Search for a byte pattern in ROM data
 */
export function findPattern(rom, pattern) {
  for (let i = 0; i <= rom.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (rom[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * Get the bank number for a Pokemon by internal ID
 */
export function getBankRBY(n) {
  if (n < 0x1F) return 0x09;
  if (n < 0x4A) return 0x0A;
  if (n < 0x74) return 0x0B;
  if (n < 0x99) return 0x0C;
  return 0x0D;
}

/**
 * Load a ROM file
 */
export function loadROM(romPath) {
  const rom = fs.readFileSync(romPath);
  
  console.log(`ROM loaded: ${rom.length} bytes`);
  
  // Read ROM header
  const title = rom.slice(0x134, 0x143).toString('ascii').replace(/\0/g, '');
  console.log(`ROM Title: ${title}`);
  
  return rom;
}

/**
 * ROM Constants
 */
export const ROM_PATTERNS = {
  BULBASAUR_STATS: Buffer.from([1, 0x2D, 0x31, 0x31, 0x2D, 0x41]),
  MEW_STATS: Buffer.from([151, 100, 100, 100, 100, 100]),
  POKEDEX_ORDER_BYTES: Buffer.from([0x70, 0x73, 0x20, 0x23, 0x15, 0x64, 0x22, 0x50]),
  PALETTE_MAP_BYTES: Buffer.from([16, 22, 22, 22, 18, 18, 18, 19, 19, 19])
};
