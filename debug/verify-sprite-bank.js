import fs from 'fs';

const rom = fs.readFileSync('rom/Pokemon - Red Version (USA, Europe).gb');

// The pointer table is at ROM address... let me search for it
// From pret/pokered, sprites are in "SECTION NPC Sprites 2" 
// which starts with RED sprite, BLUE sprite, etc.

// Let's search for the pattern we know is the RED sprite
const redPattern = Buffer.from('fff8fa3e453691e6', 'hex');

console.log('Searching for RED sprite pattern in entire ROM...\n');
for (let bank = 0; bank < 0x40; bank++) {
    const bankStart = bank * 0x4000;
    const bankEnd = bankStart + 0x4000;
    
    for (let i = bankStart; i < bankEnd - redPattern.length && i < rom.length; i++) {
        let match = true;
        for (let j = 0; j < redPattern.length; j++) {
            if (rom[i + j] !== redPattern[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            console.log(`Found at ROM 0x${i.toString(16)} (Bank 0x${bank.toString(16)}, local 0x${(i - bankStart + 0x4000).toString(16)})`);
        }
    }
}

console.log('\nBased on pret/pokered, NPC Sprites 2 section should be in a high ROM bank.');
console.log('Bank 13 (0x0D) starts at ROM offset:', '0x' + (0x0D * 0x4000).toString(16));

// Let's check around the known offset from earlier tests
const knownOffset = 0x4C080;
const knownBank = Math.floor(knownOffset / 0x4000);
console.log(`\nOur known sprite at 0x${knownOffset.toString(16)} is in bank:`, knownBank, `(0x${knownBank.toString(16)})`);

// So bank 0x13 = 19 decimal
// ROM offset 0x4C000 = bank 19 * 0x4000
console.log('Bank 19 * 0x4000 =', (19 * 0x4000).toString(16));

// Wait, that's 0x4C000. So bank 13 hex = 19 decimal. That matches!
