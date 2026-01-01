import fs from 'fs';

const rom = fs.readFileSync('rom/Pokemon - Red Version (USA, Europe).gb');

// SpriteSheetPointerTable format (4 bytes per entry):
// word: pointer to graphics
// byte: tile count
// byte: bank number

console.log('SpriteSheetPointerTable (at 0x4000):\n');
console.log('ID | Pointer | Tiles | Bank | ROM Offset');
console.log('---|---------|-------|------|------------');

for (let i = 0; i < 20; i++) {
    const tableOffset = 0x4000 + (i * 4);
    const ptr = rom.readUInt16LE(tableOffset);
    const tileCount = rom[tableOffset + 2];
    const bank = rom[tableOffset + 3];
    
    const romOffset = (bank * 0x4000) + (ptr - 0x4000);
    
    console.log(`${(i+1).toString().padStart(2)} | 0x${ptr.toString(16).padStart(4,'0')} | ${tileCount.toString().padStart(5)} | 0x${bank.toString(16).padStart(2,'0')} | 0x${romOffset.toString(16)}`);
}

console.log('\nNow extracting RED sprite with correct tile count:');
const redPtr = rom.readUInt16LE(0x4000);
const redTiles = rom[0x4002];
const redBank = rom[0x4003];
const redOffset = (redBank * 0x4000) + (redPtr - 0x4000);

console.log(`RED: ${redTiles} tiles at 0x${redOffset.toString(16)}`);
console.log(`Total bytes: ${redTiles * 16} bytes`);
