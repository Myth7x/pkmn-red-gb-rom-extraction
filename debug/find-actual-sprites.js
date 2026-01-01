import fs from 'fs';

const rom = fs.readFileSync('rom/Pokemon - Red Version (USA, Europe).gb');

// The pointer table at 0x4000 points to addresses around 0x4080
// Let's see what's at 0x4C080 (bank 13 + 0x80)
const baseOffset = 0x4C000;

console.log('Checking what the pointer table points to:\n');

// RED sprite - pointer 0x4080
const redPtr = 0x4080;
const redOffset = baseOffset + (redPtr - 0x4000);
console.log(`RED (ptr 0x${redPtr.toString(16)}): Reading from ROM offset 0x${redOffset.toString(16)}`);
const redData = rom.slice(redOffset, redOffset + 32);
console.log('First 32 bytes:', redData.toString('hex'));
console.log('');

// Check if this might be ANOTHER pointer
const possiblePtr1 = rom.readUInt16LE(redOffset);
const possiblePtr2 = rom.readUInt16LE(redOffset + 2);
console.log('If interpreted as 16-bit pointers:');
console.log('  Offset +0: 0x' + possiblePtr1.toString(16));
console.log('  Offset +2: 0x' + possiblePtr2.toString(16));
console.log('');

// Let's check the structure from pret/pokered
// Looking at gfx/sprites.asm, sprites are in "SECTION NPC Sprites 2" ROMX
// They use INCBIN to include the .2bpp files
// Let's search for where RED sprite actually is

console.log('Searching for RED sprite graphics pattern...');
// From our earlier test, we know RED sprite starts with: fff8fa3e453691e6...
const pattern = Buffer.from('fff8fa3e453691e6', 'hex');
const searchStart = 0x4C000; // Bank 13
const searchEnd = 0x50000;   // Bank 13 end

for (let i = searchStart; i < searchEnd - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
        if (rom[i + j] !== pattern[j]) {
            match = false;
            break;
        }
    }
    if (match) {
        console.log(`Found RED sprite graphics at ROM offset: 0x${i.toString(16)}`);
        console.log(`That's bank 0x${Math.floor(i / 0x4000).toString(16)} + 0x${(i % 0x4000).toString(16)}`);
        
        // Check if there's a pointer to this address
        const localAddr = (i % 0x4000) + 0x4000; // Convert to banked address
        console.log(`Banked address would be: 0x${localAddr.toString(16)}`);
    }
}
