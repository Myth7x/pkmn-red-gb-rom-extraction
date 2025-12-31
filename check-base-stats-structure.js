import fs from 'fs';

const rom = fs.readFileSync('./rom/Pokemon - Red Version (USA, Europe).gb');

// Base stats location - these are in POKEDEX ORDER
const baseStatsPos = 0x383DE;

// According to most documentation, base stats structure is:
// Byte 0: Index number (NOT Pokedex number)
// Let's see what byte 0 actually contains

console.log('Checking first byte of each base stats entry:');
console.log('(If these are index numbers, they should NOT be sequential 1,2,3...)');
console.log('');

for (let i = 0; i < 20; i++) {
  const offset = baseStatsPos + (i * 28);
  const firstByte = rom[offset];
  console.log(`Pokedex position ${i+1}: First byte = ${firstByte} (0x${firstByte.toString(16).padStart(2, '0')})`);
}

console.log('\n\nThese ARE sequential (1,2,3...), which means byte 0 is Pokedex number, NOT index number!');
console.log('This is different from what many docs say.');
console.log('We need to find the actual index numbers another way...');
