import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const romPath = path.join(__dirname, '..', 'rom', 'Pokemon - Red Version (USA, Europe).gb');
const rom = fs.readFileSync(romPath);

console.log('ROM loaded:', rom.length, 'bytes\n');

// Base stats location
const baseStatsPos = 0x383de;

// Check specific Pokemon
const checkPokemon = [13, 15, 17, 23, 25]; // Weedle, Beedrill, Pidgeotto, Ekans, Pikachu

function getBankRBY(n) {
  if (n < 0x1f) return 0x9;
  if (n < 0x4a) return 0xa;
  if (n < 0x74) return 0xb;
  if (n < 0x99) return 0xc;
  return 0xd;
}

console.log('Checking sprite offsets for Pokemon with dimension issues:\n');

for (const pokedexNum of checkPokemon) {
  const offset = baseStatsPos + (pokedexNum - 1) * 28;
  const internalId = rom[offset];
  const spriteSize = rom[offset + 10];
  const frontPointer = rom.readUInt16LE(offset + 11);
  const backPointer = rom.readUInt16LE(offset + 13);
  
  const bank = getBankRBY(internalId);
  const base = (bank - 1) * 0x4000;
  const frontOffset = base + frontPointer;
  const backOffset = base + backPointer;
  
  console.log(`Pokedex #${pokedexNum}:`);
  console.log(`  Internal ID: ${internalId} (0x${internalId.toString(16)})`);
  console.log(`  Bank: 0x${bank.toString(16)}`);
  console.log(`  Sprite Size: ${spriteSize}`);
  console.log(`  Front Pointer: 0x${frontPointer.toString(16)}`);
  console.log(`  Back Pointer: 0x${backPointer.toString(16)}`);
  console.log(`  Front Offset: 0x${frontOffset.toString(16)}`);
  console.log(`  Back Offset: 0x${backOffset.toString(16)}`);
  
  // Read first few bytes at front offset
  const dataAtOffset = rom.slice(frontOffset, frontOffset + 10);
  console.log(`  First 10 bytes at front offset: ${Array.from(dataAtOffset).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
  
  // Try to read dimensions from compressed data
  const firstByte = rom[frontOffset];
  const width = (firstByte >> 4) & 0xF;
  const height = firstByte & 0xF;
  console.log(`  Dimensions from first byte: width=${width} (${width*8}px), height=${height} (${height*8}px)`);
  console.log('');
}
