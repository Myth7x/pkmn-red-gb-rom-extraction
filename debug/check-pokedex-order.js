import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const romPath = path.join(__dirname, '..', 'rom', 'Pokemon - Red Version (USA, Europe).gb');
const rom = fs.readFileSync(romPath);

console.log('ROM loaded:', rom.length, 'bytes\n');

// Pokedex order location
const pokedexOrderPos = 0x41024;
const baseStatsPos = 0x383de;

console.log('Pokedex Order Table (first 20 entries):');
console.log('Index -> Pokedex Number');
for (let i = 0; i < 20; i++) {
  const pokedexNum = rom[pokedexOrderPos + i];
  console.log(`  Index ${i + 1}: Pokedex #${pokedexNum}`);
}

console.log('\nBase Stats Table (first 10 entries):');
console.log('Entry -> First Byte (Pokedex #)');
for (let i = 0; i < 10; i++) {
  const offset = baseStatsPos + i * 28;
  const firstByte = rom[offset];
  console.log(`  Entry ${i + 1}: ${firstByte} (Pokedex #${firstByte})`);
}

console.log('\nInternal ID lookup:');
console.log('Creating mapping from Pokedex Number to Internal ID...');
const pokedexToInternalId = new Array(152).fill(0);
for (let internalId = 1; internalId <= 190; internalId++) {
  const pokedexNum = rom[pokedexOrderPos + internalId - 1];
  if (pokedexNum > 0 && pokedexNum <= 151) {
    pokedexToInternalId[pokedexNum] = internalId;
  }
}

console.log('\nFirst 10 Pokedex numbers to Internal IDs:');
for (let pokedex = 1; pokedex <= 10; pokedex++) {
  const internalId = pokedexToInternalId[pokedex];
  console.log(`  Pokedex #${pokedex}: Internal ID ${internalId}`);
}
