import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decompressSprite } from '../src/rom-sdk/spriteDecompressor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const romPath = path.join(__dirname, '..', 'rom', 'Pokemon - Red Version (USA, Europe).gb');
const rom = fs.readFileSync(romPath);

console.log('Testing sprite decompression for large sprites\n');

// Test cases from the output that look suspicious
const testCases = [
  { pokedex: 136, name: 'FLAREON', expected: '56x56?', offset: 0x363E2 },
  { pokedex: 30, name: 'NIDORINA', expected: '56x56?', offset: 0x35B9E },
  { pokedex: 60, name: 'POLIWAG', expected: '40x40?', offset: 0x2EFEA },
  { pokedex: 5, name: 'CHARMELEON', expected: '64x64?', offset: 0x25F0C },
];

for (const test of testCases) {
  console.log(`\n${test.name} (Pokedex #${test.pokedex}):`);
  console.log(`  Expected dimensions: ${test.expected}`);
  console.log(`  Offset: 0x${test.offset.toString(16)}`);
  
  // Read first 20 bytes to examine
  const dataStart = rom.slice(test.offset, test.offset + 20);
  console.log(`  First 20 bytes: ${Array.from(dataStart).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
  
  // Read first byte and interpret as dimensions
  const firstByte = rom[test.offset];
  const firstNibbleWidth = (firstByte >> 4) & 0xF;
  const firstNibbleHeight = firstByte & 0xF;
  console.log(`  First byte: 0x${firstByte.toString(16)} (${firstByte.toString(2).padStart(8, '0')})`);
  console.log(`  If dimensions from first byte: ${firstNibbleWidth}x${firstNibbleHeight} tiles = ${firstNibbleWidth*8}x${firstNibbleHeight*8} pixels`);
  
  // Try to decompress
  try {
    const compressedData = rom.slice(test.offset, test.offset + 2000);
    const sprite = decompressSprite(compressedData);
    console.log(`  Actual decompressed: ${sprite.width}x${sprite.height} pixels`);
    
    if (sprite.width > 96 || sprite.height > 96) {
      console.log(`  ⚠️  WARNING: Dimensions seem too large!`);
    }
    if (sprite.width === 0 || sprite.height === 0) {
      console.log(`  ⚠️  ERROR: Zero dimension detected!`);
    }
    if (sprite.width !== sprite.height && Math.abs(sprite.width - sprite.height) > 40) {
      console.log(`  ⚠️  WARNING: Unusual aspect ratio!`);
    }
  } catch (error) {
    console.log(`  ❌ Decompression failed: ${error.message}`);
  }
}
