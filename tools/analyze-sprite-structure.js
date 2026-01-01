import fs from 'fs';
const rom = fs.readFileSync('rom/Pokemon - Red Version (USA, Europe).gb');

// Read first few sprite pointers
console.log('Sprite Pointer Table at 0x4000:');
for (let i = 0; i < 10; i++) {
    const ptr = rom.readUInt16LE(0x4000 + i * 2);
    const offset = 0x4C000 + (ptr - 0x4000);
    console.log(`Sprite ${i+1}: Pointer=0x${ptr.toString(16).padStart(4,'0')} -> ROM offset=0x${offset.toString(16)}`);
}

// Let's look at the actual data structure at sprite 1 (RED)
const ptr1 = rom.readUInt16LE(0x4000);
const offset1 = 0x4C000 + (ptr1 - 0x4000);
console.log(`\nAnalyzing Sprite 1 (RED) at offset 0x${offset1.toString(16)}:`);

// Check if there's a length/structure byte
console.log('First 64 bytes (4 tiles):');
const data = rom.slice(offset1, offset1 + 64);
console.log(data.toString('hex').match(/.{1,32}/g).join('\n'));

// In pokered, sprites have multiple frames. Let's check the pattern
// Typical structure: 4 frames (down, up, left, right) * 4 tiles each = 256 bytes total
console.log('\nChecking for frame pattern (each frame should be 64 bytes = 4 tiles):');
for (let frame = 0; frame < 4; frame++) {
    const frameOffset = offset1 + (frame * 64);
    const sample = rom.slice(frameOffset, frameOffset + 16);
    console.log(`Frame ${frame}: offset=0x${frameOffset.toString(16)} sample=${sample.toString('hex')}`);
}

// Let's also check if sprite data continues (walking animation frames)
console.log('\nTotal sprite data size check (looking for 256 bytes = 4 directions):');
const fullSprite = rom.slice(offset1, offset1 + 256);
console.log(`256 bytes extracted, non-zero count: ${fullSprite.filter(b => b !== 0).length}`);
