import fs from 'fs';

const rom = fs.readFileSync('./rom/Pokemon - Red Version (USA, Europe).gb');

const pokemonNameStartByte = 115230; // 0x1C21E

// Character decoding map
const charMap = {
  127: ' ',
  128: 'A', 129: 'B', 130: 'C', 131: 'D', 132: 'E', 133: 'F', 134: 'G',
  135: 'H', 136: 'I', 137: 'J', 138: 'K', 139: 'L', 140: 'M', 141: 'N',
  142: 'O', 143: 'P', 144: 'Q', 145: 'R', 146: 'S', 147: 'T', 148: 'U',
  149: 'V', 150: 'W', 151: 'X', 152: 'Y', 153: 'Z',
  224: "'", 227: '-',
  239: 'M', // Male symbol
  245: 'F', // Female symbol
  80: '', // 0x50 = terminator
};

function readName(index) {
  const offset = pokemonNameStartByte + (index * 10);
  let name = '';
  for (let i = 0; i < 10; i++) {
    const byte = rom[offset + i];
    if (byte === 80 || byte === 0x50) break;
    name += charMap[byte] || '?';
  }
  return name;
}

console.log('Index 0 (should be Rhydon):', readName(0));
console.log('Index 111 (112-1, Pokedex#1 target):', readName(111));
console.log('Index 152 (153-1):', readName(152));
console.log('Index 8 (9-1):', readName(8));
