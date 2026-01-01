import fs from 'fs';

const rom = fs.readFileSync('rom/Pokemon - Red Version (USA, Europe).gb');

// According to pret/pokered constants, the sprite data is organized like:
// SPRITE_RED = $01, SPRITE_BLUE = $02, etc.
// But these are indices into SpriteSheetPointerTable

// Let's try a different approach: search for known distinct patterns
// Bank $09 = 0x24000 (NPC Sprites 1)
// Bank $0D = 0x34000 (NPC Sprites 2) 

// The table should have distinct pointers incrementing by 12*16 bytes (192 = 0xC0)

console.log('Searching for incrementing sprite pointer pattern...\n');

for (let bankNum = 0x01; bankNum <= 0x1F; bankNum++) {
    const bankStart = (bankNum - 1) * 0x4000;
    
    for (let offset = 0; offset < 0x4000 - 40; offset++) {
        const addr = bankStart + offset;
        
        // Read 4-byte entries
        let validSequence = true;
        const entries = [];
        
        for (let i = 0; i < 5; i++) {
            const entryAddr = addr + (i * 4);
            const ptr = rom.readUInt16LE(entryAddr);
            const tiles = rom[entryAddr + 2];
            const bank = rom[entryAddr + 3];
            
            entries.push({ ptr, tiles, bank });
            
            // Check if it looks valid
            if (tiles !== 4 && tiles !== 12) {
                validSequence = false;
                break;
            }
            if (bank < 0x09 || bank > 0x0D) {
                validSequence = false;
                break;
            }
        }
        
        if (validSequence) {
            // Check if pointers are reasonable (in 0x4000-0x7FFF range)
            let allValid = true;
            for (const entry of entries) {
                if (entry.ptr < 0x4000 || entry.ptr >= 0x8000) {
                    allValid = false;
                    break;
                }
            }
            
            if (allValid) {
                console.log('Found possible table at 0x' + addr.toString(16) + ' (Bank 0x' + bankNum.toString(16) + ')');
                console.log('First 10 entries:');
                for (let i = 0; i < 10; i++) {
                    const entryAddr = addr + (i * 4);
                    const ptr = rom.readUInt16LE(entryAddr);
                    const tiles = rom[entryAddr + 2];
                    const bank = rom[entryAddr + 3];
                    
                    // Calculate ROM address
                    const romAddr = (bank - 1) * 0x4000 + (ptr - 0x4000);
                    
                    console.log(`  [${i}] Ptr=0x${ptr.toString(16).padStart(4, '0')} ROM=0x${romAddr.toString(16).padStart(5, '0')} Tiles=${tiles.toString().padStart(2)} Bank=0x${bank.toString(16).padStart(2, '0')}`);
                }
                console.log('');
                
                // Check the first sprite data
                const firstPtr = rom.readUInt16LE(addr);
                const firstBank = rom[addr + 3];
                const firstRomAddr = (firstBank - 1) * 0x4000 + (firstPtr - 0x4000);
                console.log('First sprite data at ROM 0x' + firstRomAddr.toString(16) + ':');
                console.log(Array.from(rom.slice(firstRomAddr, firstRomAddr + 32)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
                
                process.exit(0);
            }
        }
    }
}

console.log('No suitable table found.');
