import fs from 'fs';

// Manually decode first tile of RED sprite
const rom = fs.readFileSync('rom/Pokemon - Red Version (USA, Europe).gb');
const ptr = rom.readUInt16LE(0x4000);
const offset = 0x4C000 + (ptr - 0x4000);

console.log('RED sprite offset:', '0x' + offset.toString(16));

// Read first tile (16 bytes)
const tileData = rom.slice(offset, offset + 16);
console.log('First tile raw data:', tileData.toString('hex'));

// Decode using the Game Boy 2bpp format
// Each row is 2 bytes, bit 0 from byte 1, bit 1 from byte 2
console.log('\nDecoding tile (8x8 pixels):');
for (let y = 0; y < 8; y++) {
    const byte1 = tileData[y * 2];
    const byte2 = tileData[y * 2 + 1];
    let row = '';
    
    for (let x = 0; x < 8; x++) {
        const mask = 1 << (7 - x);
        const bit1 = (byte1 & mask) ? 1 : 0;
        const bit2 = (byte2 & mask) ? 2 : 0;
        const colorIndex = bit1 | bit2;
        
        // Visual representation
        const chars = [' ', '░', '▒', '█'];
        row += chars[colorIndex];
    }
    console.log(`Row ${y}: ${row} | Bytes: ${byte1.toString(16).padStart(2,'0')} ${byte2.toString(16).padStart(2,'0')}`);
}

// Now decode all 4 tiles of the first frame
console.log('\n\nFull 16x16 frame (4 tiles):');
for (let tileY = 0; tileY < 2; tileY++) {
    for (let row = 0; row < 8; row++) {
        let line = '';
        for (let tileX = 0; tileX < 2; tileX++) {
            const tileIdx = tileY * 2 + tileX;
            const tileOffset = offset + (tileIdx * 16);
            const byte1 = rom[tileOffset + row * 2];
            const byte2 = rom[tileOffset + row * 2 + 1];
            
            for (let x = 0; x < 8; x++) {
                const mask = 1 << (7 - x);
                const bit1 = (byte1 & mask) ? 1 : 0;
                const bit2 = (byte2 & mask) ? 2 : 0;
                const colorIndex = bit1 | bit2;
                const chars = [' ', '░', '▒', '█'];
                line += chars[colorIndex];
            }
        }
        console.log(line);
    }
}
