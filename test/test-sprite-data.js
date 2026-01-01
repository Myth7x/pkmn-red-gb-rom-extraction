import fs from 'fs';

const data = JSON.parse(fs.readFileSync('output/overworld-sprites/overworld_sprites.json', 'utf8'));
const sprite1 = data.sprites.find(s => s.pictureId === 1);

console.log('Sprite 1 (RED):');
console.log('Has frames?', sprite1.frames ? 'YES' : 'NO');
if (sprite1.frames) {
    console.log('Frame keys:', Object.keys(sprite1.frames));
    console.log('Down frame length:', sprite1.frames.down.length);
    console.log('Down frame first 64 pixels:', sprite1.frames.down.slice(0, 64));
} else {
    console.log('Has pixels?', sprite1.pixels ? 'YES' : 'NO');
    if (sprite1.pixels) {
        console.log('Pixels length:', sprite1.pixels.length);
        console.log('First 64 pixels:', sprite1.pixels.slice(0, 64));
    }
}

// Also check raw ROM data to verify decoding
const rom = fs.readFileSync('rom/Pokemon - Red Version (USA, Europe).gb');
const ptr = rom.readUInt16LE(0x4000);
const offset = 0x4C000 + (ptr - 0x4000);
console.log('\nRaw ROM data at offset', '0x' + offset.toString(16) + ':');
console.log('First 32 bytes:', rom.slice(offset, offset + 32).toString('hex'));
