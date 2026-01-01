import fs from 'fs';

const rom = fs.readFileSync('rom/Pokemon - Red Version (USA, Europe).gb');

// From pret/pokered data/sprites/sprites.asm:
// overworld_sprite RedSprite, 12  ; SPRITE_RED
// This means RED sprite has 12 tiles

// Pointer table is at 0x4000
const ptr1 = rom.readUInt16LE(0x4000); // RED
const offset1 = 0x4C000 + (ptr1 - 0x4000);

console.log('RED sprite pointer:', '0x' + ptr1.toString(16));
console.log('RED sprite offset:', '0x' + offset1.toString(16));
console.log('');

// Let's check what comes after 12 tiles (192 bytes)
// If sprites are stored sequentially, the next sprite should start there
const ptr2 = rom.readUInt16LE(0x4002); // BLUE
const offset2 = 0x4C000 + (ptr2 - 0x4000);

console.log('BLUE sprite pointer:', '0x' + ptr2.toString(16));
console.log('BLUE sprite offset:', '0x' + offset2.toString(16));
console.log('');

// Check the distance between RED and BLUE sprites
const distance = offset2 - offset1;
console.log('Distance between RED and BLUE:', distance, 'bytes');
console.log('Expected for 12 tiles:', 12 * 16, 'bytes');
console.log('Expected for 48 tiles (4 directions * 12 tiles):', 48 * 16, 'bytes');
console.log('');

// Let's check a few more sprites to see the pattern
for (let i = 0; i < 10; i++) {
    const ptr = rom.readUInt16LE(0x4000 + i * 2);
    const offset = 0x4C000 + (ptr - 0x4000);
    console.log(`Sprite ${i+1}: ptr=0x${ptr.toString(16)} offset=0x${offset.toString(16)}`);
}

// Check if sprites share data (same pointer)
console.log('\nChecking for duplicate pointers (shared sprite data):');
const pointers = [];
for (let i = 0; i < 20; i++) {
    const ptr = rom.readUInt16LE(0x4000 + i * 2);
    const existing = pointers.findIndex(p => p.ptr === ptr);
    if (existing >= 0) {
        console.log(`Sprite ${i+1} shares data with Sprite ${existing+1} (ptr=0x${ptr.toString(16)})`);
    }
    pointers.push({ id: i+1, ptr });
}
