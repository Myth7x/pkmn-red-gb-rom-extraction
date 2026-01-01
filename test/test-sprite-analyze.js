import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROM_PATH = path.join(__dirname, 'rom', 'Pokemon - Red Version (USA, Europe).gb');
const romData = fs.readFileSync(ROM_PATH);

console.log('ROM Size:', romData.length);

// Known sprite pointer table locations from various sources
const possibleTableLocations = [
    0x4000,  // Bank 1 start
    0x10000, // Bank 4 start
    0x44000, // Bank 11 start
    0x4C000, // Bank 13 start
    0x50000, // Bank 14 start
    0x70000, // Bank 1C start
];

// Function to decode a 2-byte pointer (little-endian)
function readPointer(offset) {
    const low = romData[offset];
    const high = romData[offset + 1];
    return low | (high << 8);
}

// Function to convert Game Boy address to ROM offset
function addressToOffset(address, bank) {
    if (address < 0x4000) {
        return address; // Bank 0 (fixed)
    } else if (address >= 0x4000 && address < 0x8000) {
        return (bank * 0x4000) + (address - 0x4000);
    }
    return -1;
}

// Game Boy 2bpp tile decoder
function decode2bppTile(data, offset) {
    const pixels = [];
    for (let y = 0; y < 8; y++) {
        const byte1 = data[offset + y * 2];
        const byte2 = data[offset + y * 2 + 1];
        for (let x = 0; x < 8; x++) {
            const bit = 7 - x;
            const color = ((byte1 >> bit) & 1) | (((byte2 >> bit) & 1) << 1);
            pixels.push(color);
        }
    }
    return pixels;
}

// Check if data looks like valid 2bpp tile data (not all zeros, not all same byte)
function looksLikeTileData(data, offset, tileCount) {
    let allZeros = true;
    let firstByte = data[offset];
    let allSame = true;
    
    for (let i = 0; i < tileCount * 16; i++) {
        const byte = data[offset + i];
        if (byte !== 0) allZeros = false;
        if (byte !== firstByte) allSame = false;
    }
    
    return !allZeros && !allSame;
}

console.log('\n=== Searching for sprite data ===');

// Try to find sprite pic table by looking for a sequence of valid pointers
for (const tableBase of possibleTableLocations) {
    console.log(`\nTrying table at 0x${tableBase.toString(16).toUpperCase()}...`);
    
    // Try first 10 entries
    let validCount = 0;
    const pointers = [];
    
    for (let i = 0; i < 10; i++) {
        const ptrOffset = tableBase + (i * 2);
        if (ptrOffset + 1 >= romData.length) break;
        
        const ptr = readPointer(ptrOffset);
        pointers.push(ptr);
        
        // Check if pointer is in valid range (0x4000-0x7FFF for banked ROM)
        if (ptr >= 0x4000 && ptr < 0x8000) {
            validCount++;
        }
    }
    
    console.log(`  Valid pointers: ${validCount}/10`);
    console.log(`  Sample pointers: ${pointers.slice(0, 5).map(p => '0x' + p.toString(16).toUpperCase()).join(', ')}`);
    
    // If we have mostly valid pointers, try to extract sprites
    if (validCount >= 7) {
        console.log('  Testing sprite extraction...');
        
        // Assume bank 13 (0x4C000) contains sprite data
        const spriteBank = 0x13;
        const bankBase = spriteBank * 0x4000;
        
        for (let i = 0; i < 3; i++) {
            const ptr = pointers[i];
            const romOffset = bankBase + (ptr - 0x4000);
            
            if (romOffset + 192 < romData.length) {
                const valid = looksLikeTileData(romData, romOffset, 12);
                console.log(`  Sprite ${i}: ptr=0x${ptr.toString(16).toUpperCase()}, offset=0x${romOffset.toString(16).toUpperCase()}, valid=${valid}`);
                
                // Show first few bytes
                const bytes = [];
                for (let j = 0; j < 8; j++) {
                    bytes.push(romData[romOffset + j].toString(16).toUpperCase().padStart(2, '0'));
                }
                console.log(`    First bytes: ${bytes.join(' ')}`);
            }
        }
    }
}

// Try direct search for sprite data patterns
console.log('\n=== Direct sprite data search ===');
console.log('Looking for 12-tile (192 byte) sprite patterns...');

// Search for locations with 192 bytes of non-zero 2bpp data
let foundCount = 0;
for (let offset = 0x4000; offset < romData.length - 192 && foundCount < 5; offset += 16) {
    if (looksLikeTileData(romData, offset, 12)) {
        // Check if this could be a character sprite (has variety in data)
        const uniqueBytes = new Set();
        for (let i = 0; i < 192; i++) {
            uniqueBytes.add(romData[offset + i]);
        }
        
        if (uniqueBytes.size > 10) { // At least 10 different byte values
            console.log(`Found potential sprite at 0x${offset.toString(16).toUpperCase()}, unique bytes: ${uniqueBytes.size}`);
            foundCount++;
        }
    }
}

console.log('\nDone!');
