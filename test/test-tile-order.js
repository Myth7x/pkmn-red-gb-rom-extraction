import fs from 'fs';
import { PNG } from 'pngjs';

const rom = fs.readFileSync('rom/Pokemon - Red Version (USA, Europe).gb');

// Get RED sprite offset
const ptr = rom.readUInt16LE(0x4000);
const offset = 0x4C000 + (ptr - 0x4000);

console.log('RED sprite at offset: 0x' + offset.toString(16));

// Game Boy sprites in Pokemon Red are stored differently
// They might be using PLANAR tile format with different arrangement
// Let's try different decoding approaches

// Standard 2bpp decoding
function decode2bpp(tileData) {
    const pixels = [];
    for (let y = 0; y < 8; y++) {
        const byte1 = tileData[y * 2];
        const byte2 = tileData[y * 2 + 1];
        
        for (let x = 0; x < 8; x++) {
            const mask = 1 << (7 - x);
            const bit1 = (byte1 & mask) ? 1 : 0;
            const bit2 = (byte2 & mask) ? 2 : 0;
            pixels.push(bit1 | bit2);
        }
    }
    return pixels;
}

// Try interleaved format (common for sprites)
function decode2bppInterleaved(data, numTiles) {
    const pixels = [];
    for (let tile = 0; tile < numTiles; tile++) {
        const tileOffset = tile * 16;
        const tilePixels = decode2bpp(data.slice(tileOffset, tileOffset + 16));
        pixels.push(...tilePixels);
    }
    return pixels;
}

// Try planar format (all bitplane 0, then all bitplane 1)
function decode2bppPlanar(data, numTiles) {
    const pixels = new Array(numTiles * 64).fill(0);
    const bytesPerBitplane = numTiles * 8 * 8 / 8; // bits / 8
    
    for (let tile = 0; tile < numTiles; tile++) {
        for (let y = 0; y < 8; y++) {
            // This format is less common, skip for now
        }
    }
    return pixels;
}

// Test standard format (what we're using)
console.log('\n=== Standard 2bpp Format (current) ===');
const frame1Standard = rom.slice(offset, offset + 64);
const pixels1 = [];
for (let t = 0; t < 4; t++) {
    pixels1.push(...decode2bpp(frame1Standard.slice(t * 16, t * 16 + 16)));
}

// Render 16x16
for (let y = 0; y < 16; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
        const tileX = Math.floor(x / 8);
        const tileY = Math.floor(y / 8);
        const tileIdx = tileY * 2 + tileX;
        const pixelIdx = tileIdx * 64 + (y % 8) * 8 + (x % 8);
        const chars = [' ', '░', '▒', '█'];
        row += chars[pixels1[pixelIdx]];
    }
    console.log(row);
}

// Now let's check if maybe the tiles are in COLUMN order instead of ROW order
console.log('\n=== Trying Column-Major Tile Order ===');
// Tiles arranged: [0] [2]
//                 [1] [3]
for (let y = 0; y < 16; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
        const tileX = Math.floor(x / 8);
        const tileY = Math.floor(y / 8);
        const tileIdx = tileX * 2 + tileY; // Column-major
        const pixelIdx = tileIdx * 64 + (y % 8) * 8 + (x % 8);
        const chars = [' ', '░', '▒', '█'];
        row += chars[pixels1[pixelIdx]];
    }
    console.log(row);
}

// Check if maybe it's 12 tiles (16x24) with extra bottom tiles
console.log('\n=== Checking if 12 tiles (16x24) ===');
const frame12tiles = rom.slice(offset, offset + 192); // 12 tiles * 16 bytes
const pixels12 = [];
for (let t = 0; t < 12; t++) {
    pixels12.push(...decode2bpp(frame12tiles.slice(t * 16, t * 16 + 16)));
}

// Render 16x24 (4 tiles wide, 3 tall)
for (let y = 0; y < 24; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
        const tileX = Math.floor(x / 8);
        const tileY = Math.floor(y / 8);
        const tileIdx = tileY * 2 + tileX;
        const pixelIdx = tileIdx * 64 + (y % 8) * 8 + (x % 8);
        const chars = [' ', '░', '▒', '█'];
        row += chars[pixels12[pixelIdx] || 0];
    }
    console.log(row);
}
