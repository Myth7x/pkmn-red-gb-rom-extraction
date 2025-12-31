import fs from 'fs';

const rom = fs.readFileSync('./rom/Pokemon - Red Version (USA, Europe).gb');

// Find base stats table
const baseStatsPattern = Buffer.from([1, 0x2D, 0x31, 0x31, 0x2D, 0x41]); // BULBASAUR_STATS
let baseStatsAddr = rom.indexOf(baseStatsPattern);
console.log(`Base stats found at: 0x${baseStatsAddr.toString(16)} (${baseStatsAddr})`);

// Read first 3 Pokemon - print all 28 bytes
for (let i = 0; i < 3; i++) {
  const offset = baseStatsAddr + (i * 28);
  const bytes = [];
  for (let j = 0; j < 28; j++) {
    bytes.push(`0x${rom[offset + j].toString(16).padStart(2, '0')}`);
  }
  console.log(`\nPokedex #${i+1} (28 bytes):`);
  console.log(bytes.join(' '));
}

// Also check what the Pokedex order table says
console.log('\n\nPokedex order table at 0x41024:');
const pokedexOrderAddr = 0x41024;
for (let i = 0; i < 3; i++) {
  const indexNum = rom[pokedexOrderAddr + i];
  console.log(`Pokedex #${i+1} → Index ${indexNum} (0x${indexNum.toString(16)})`);
}
