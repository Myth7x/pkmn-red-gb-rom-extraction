import fs from 'fs';

const rom = fs.readFileSync('./rom/Pokemon - Red Version (USA, Europe).gb');

// Find base stats table
const baseStatsPattern = Buffer.from([1, 0x2D, 0x31, 0x31, 0x2D, 0x41]); // BULBASAUR_STATS
let baseStatsAddr = rom.indexOf(baseStatsPattern);
console.log(`Base stats found at: 0x${baseStatsAddr.toString(16)} (${baseStatsAddr})`);

// Read first 3 Pokemon base stats
for (let i = 0; i < 3; i++) {
  const offset = baseStatsAddr + (i * 28);
  const pokedexNum = rom[offset];
  const indexNum = rom[offset + 1]; // This should be the "index number"
  const hp = rom[offset + 2];
  const attack = rom[offset + 3];
  const defense = rom[offset + 4];
  const speed = rom[offset + 5];
  const special = rom[offset + 6];
  
  console.log(`\nPokedex #${pokedexNum}:`);
  console.log(`  Index number: ${indexNum} (0x${indexNum.toString(16)})`);
  console.log(`  Stats: HP=${hp} ATK=${attack} DEF=${defense} SPD=${speed} SPC=${special}`);
}
