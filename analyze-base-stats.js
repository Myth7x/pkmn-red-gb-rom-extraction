import fs from 'fs';

const rom = fs.readFileSync('./rom/Pokemon - Red Version (USA, Europe).gb');

// Base stats location
const baseStatsPos = 0x383DE;

// Read first 3 Pokemon's base stats (28 bytes each)
for (let i = 0; i < 3; i++) {
  const offset = baseStatsPos + (i * 28);
  console.log(`\nPokedex #${i+1} base stats (28 bytes):`);
  
  const bytes = [];
  for (let j = 0; j < 28; j++) {
    bytes.push(rom[offset + j].toString(16).padStart(2, '0'));
  }
  
  // Parse structure
  console.log('  Pokedex#:', rom[offset]);
  console.log('  HP/Atk/Def/Spd/Spc:', rom[offset+1], rom[offset+2], rom[offset+3], rom[offset+4], rom[offset+5]);
  console.log('  Sprite dimensions:', '0x' + rom[offset+10].toString(16));
  console.log('  Front pointer:', '0x' + rom.readUInt16LE(offset+11).toString(16));
  console.log('  Back pointer:', '0x' + rom.readUInt16LE(offset+13).toString(16));
  console.log('  All bytes:', bytes.join(' '));
}
