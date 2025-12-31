import fs from 'fs';

const rom = fs.readFileSync('./rom/Pokemon - Red Version (USA, Europe).gb');

const pokedexOrderAddr = 0x41024;

console.log('Reading Pokedex order table at 0x41024:');
console.log('First 20 bytes (should map Pokedex # 1-20 to index numbers):');

for (let i = 0; i < 20; i++) {
  const indexNum = rom[pokedexOrderAddr + i];
  console.log(`Byte ${i} (Pokedex #${i+1}?) → Index ${indexNum} (0x${indexNum.toString(16).padStart(2, '0')})`);
}
