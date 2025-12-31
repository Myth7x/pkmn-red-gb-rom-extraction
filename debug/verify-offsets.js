import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const romPath = path.join(__dirname, '..', 'rom', 'Pokemon - Red Version (USA, Europe).gb');
const rom = fs.readFileSync(romPath);

console.log('Verifying sprite offset calculations\n');

const baseStatsPos = 0x383de;
const pokedexOrderPos = 0x41024;

// Build Pokedex → Internal ID mapping
const pokedexToInternalId = new Array(152).fill(0);
for (let internalId = 1; internalId <= 190; internalId++) {
  const pokedexNum = rom[pokedexOrderPos + internalId - 1];
  if (pokedexNum > 0 && pokedexNum <= 151) {
    pokedexToInternalId[pokedexNum] = internalId;
  }
}

function getBankRBY(n) {
  if (n < 0x1f) return 0x9;
  if (n < 0x4a) return 0xa;
  if (n < 0x74) return 0xb;
  if (n < 0x99) return 0xc;
  return 0xd;
}

// Check specific Pokemon with large dimensions
const testCases = [
  { pokedex: 136, name: 'FLAREON' },
  { pokedex: 60, name: 'POLIWAG' },
  { pokedex: 5, name: 'CHARMELEON' },
  { pokedex: 1, name: 'BULBASAUR' },
];

for (const test of testCases) {
  console.log(`\n${test.name} (Pokedex #${test.pokedex}):`);
  
  const offset = baseStatsPos + (test.pokedex - 1) * 28;
  const storedPokedexNum = rom[offset];
  const internalId = pokedexToInternalId[test.pokedex];
  const spriteSize = rom[offset + 10];
  const frontPointer = rom.readUInt16LE(offset + 11);
  const backPointer = rom.readUInt16LE(offset + 13);
  
  const bank = getBankRBY(internalId);
  const base = (bank - 1) * 0x4000;
  const frontOffset = base + frontPointer;
  const backOffset = base + backPointer;
  
  console.log(`  Stored Pokedex #: ${storedPokedexNum} (should be ${test.pokedex})`);
  console.log(`  Internal ID: ${internalId}`);
  console.log(`  Bank: 0x${bank.toString(16)}`);
  console.log(`  Base: 0x${base.toString(16)}`);
  console.log(`  Front Pointer: 0x${frontPointer.toString(16)}`);
  console.log(`  Front Offset: 0x${frontOffset.toString(16)}`);
  console.log(`  Sprite Size: ${spriteSize}`);
  
  // Check if pointer might wrap
  if (frontPointer < 0x4000) {
    console.log(`  ✓ Pointer is within bank`);
  } else {
    console.log(`  ⚠️  WARNING: Pointer >= 0x4000, might point to next bank!`);
  }
}
