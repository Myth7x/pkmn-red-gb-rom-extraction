/**
 * Pokemon Sprite Extractor for Pokemon Red/Blue/Yellow
 * 
 * This module handles extraction and decompression of Pokemon sprite data from Game Boy ROMs.
 * It implements bit-stream decompression, sprite deinterleaving, and PNG export functionality
 * for both front and back sprites of all 151 Generation 1 Pokemon.
 */

import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

// Search patterns for finding data in ROM
const BULBASAUR_STATS = Buffer.from([1, 0x2D, 0x31, 0x31, 0x2D, 0x41]);
const MEW_STATS = Buffer.from([151, 100, 100, 100, 100, 100]);
const POKEDEX_ORDER = Buffer.from([0x70, 0x73, 0x20, 0x23, 0x15, 0x64, 0x22, 0x50]);
const PALETTE_MAP = Buffer.from([16, 22, 22, 22, 18, 18, 18, 19, 19, 19]);

// Mapping from Pokedex number (1-151) to name index (1-190) in the ROM's name table
// The name table at 0x1C21E is in "index number" order, not Pokedex order
const POKEDEX_TO_NAME_INDEX = [
  153, 9, 154, 176, 178, 180, 177, 179, 28, 123,
  124, 125, 112, 113, 114, 36, 150, 151, 165, 166,
  5, 35, 108, 45, 84, 85, 96, 97, 15, 168,
  16, 3, 167, 7, 4, 142, 82, 83, 100, 101,
  107, 130, 185, 186, 187, 109, 46, 65, 119, 59,
  118, 77, 144, 47, 128, 57, 117, 33, 20, 71,
  110, 111, 148, 38, 149, 106, 41, 126, 188, 189,
  190, 24, 155, 169, 39, 49, 163, 164, 37, 8,
  173, 54, 64, 70, 116, 58, 120, 13, 136, 23,
  139, 25, 147, 14, 34, 48, 129, 78, 138, 6,
  141, 12, 10, 17, 145, 43, 44, 11, 55, 143,
  18, 1, 40, 30, 2, 92, 93, 157, 158, 27,
  152, 42, 26, 72, 53, 51, 29, 60, 133, 22,
  19, 76, 102, 105, 104, 103, 170, 98, 99, 90,
  91, 171, 132, 74, 75, 73, 88, 89, 66, 131,
  21
];

// Grayscale palette
const GRAY_PALETTE = [
    [255, 255, 255],
    [170, 170, 170],
    [85, 85, 85],
    [0, 0, 0]
];

/**
 * BitReader - Reads bits from a byte stream (big-endian)
 */
class BitReader {
    constructor(buffer) {
        this.buffer = buffer;
        this.pos = 0;
        this.bits = 0;
        this.count = 0;
        this.error = null;
    }

    /**
     * Read n bits from the stream
     */
    readBits(n) {
        // Fill buffer with more bits if needed
        while (this.count < n) {
            if (this.pos >= this.buffer.length) {
                this.error = new Error('Unexpected end of data');
                return 0;
            }
            const byte = this.buffer[this.pos++];
            this.bits = (this.bits << 8) | byte;
            this.count += 8;
        }

        // Extract n bits
        const shift = this.count - n;
        const mask = (1 << n) - 1;
        const result = (this.bits >> shift) & mask;
        this.count -= n;
        return result;
    }

    hasError() {
        return this.error !== null;
    }

    getError() {
        return this.error;
    }
}

/**
 * Decode a compressed 16-bit integer
 */
function decode16(reader) {
    let n = 1;
    while (reader.readBits(1) === 1) {
        n += 1;
    }
    return (1 << n) + reader.readBits(n) - 1;
}

/**
 * Read, expand, and deinterleave compressed pixel data
 */
function readPixels(reader, data, width, height) {
    let z = 0;
    if (reader.readBits(1) === 0) {
        z = decode16(reader);
    }

    for (let x = 0; x < width; x++) {
        for (let shift = 6; shift >= 0; shift -= 2) {
            for (let y = 0; y < height * 8; y++) {
                let bits;
                while (true) {
                    if (z > 0) {
                        bits = 0;
                        z--;
                        break;
                    } else {
                        bits = reader.readBits(2);
                        if (bits === 0) {
                            z = decode16(reader);
                            continue;
                        }
                        break;
                    }
                }
                const i = y * width + x;
                data[i] |= bits << shift;
            }
        }
    }
}

/**
 * Inverse XOR table for unxor operation
 */
const invXorShift = (() => {
    const table = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        table[i ^ (i >> 1)] = i;
    }
    return table;
})();

/**
 * Unxor performs the inverse of (row ^ row>>1) on each row
 */
function unxor(data, width, height) {
    const stride = width;
    for (let y = 0; y < height * 8; y++) {
        let bit = 0;
        for (let x = 0; x < width; x++) {
            const i = y * stride + x;
            data[i] = invXorShift[data[i]];
            if (bit !== 0) {
                data[i] = ~data[i] & 0xFF;
            }
            bit = data[i] & 1;
        }
    }
}

/**
 * Mingle two bytes by interleaving their bits
 */
function mingle(x, y) {
    let z = 0;
    for (let i = 0; i < 8; i++) {
        z |= ((x >> i) & 1) << (i * 2);
        z |= ((y >> i) & 1) << (i * 2 + 1);
    }
    return z;
}

/**
 * Decode a compressed Pokemon sprite
 * @param {Buffer} buffer - Buffer containing compressed sprite data
 * @returns {Object} - {width, height, pixels} where pixels is Uint8Array of 2-bit values
 */
function decodeSprite(buffer) {
    const reader = new BitReader(buffer);

    // Read dimensions
    const width = reader.readBits(4);
    const height = reader.readBits(4);

    if (width === 0 || height === 0) {
        throw new Error('Invalid sprite dimensions');
    }

    // Create buffers for the two bitplanes
    const dataSize = width * height * 8;
    const data = new Uint8Array(dataSize * 2);
    const mid = dataSize;

    // Split into two slices
    let s0_start = 0;
    let s0_end = mid;
    let s1_start = mid;
    let s1_end = dataSize * 2;

    // Check bit order
    if (reader.readBits(1) === 1) {
        // Swap slices
        [s0_start, s1_start] = [s1_start, s0_start];
        [s0_end, s1_end] = [s1_end, s0_end];
    }

    // Read first bitplane
    const s0 = data.subarray(s0_start, s0_end);
    readPixels(reader, s0, width, height);

    // Read mode
    let mode = reader.readBits(1);
    if (mode === 1) {
        mode = 1 + reader.readBits(1);
    }

    // Read second bitplane
    const s1 = data.subarray(s1_start, s1_end);
    readPixels(reader, s1, width, height);

    if (reader.hasError()) {
        throw reader.getError();
    }

    // Apply transformations based on mode
    switch (mode) {
        case 0:
            unxor(s0, width, height);
            unxor(s1, width, height);
            break;
        case 1:
            unxor(s0, width, height);
            for (let i = 0; i < mid; i++) {
                s1[i] ^= s0[i];
            }
            break;
        case 2:
            unxor(s1, width, height);
            unxor(s0, width, height);
            for (let i = 0; i < mid; i++) {
                s1[i] ^= s0[i];
            }
            break;
    }

    // Combine bitplanes into final pixel data
    const pixels = new Uint8Array(width * 8 * height * 8);
    let pixelIndex = 0;
    for (let i = 0; i < mid; i++) {
        const combined = mingle(data[i], data[mid + i]);
        for (let shift = 0; shift < 16; shift += 2) {
            pixels[pixelIndex++] = (combined >> (14 - shift)) & 3;
        }
    }

    return {
        width: width * 8,
        height: height * 8,
        pixels
    };
}

/**
 * Get bank number for a Pokemon (different for Japanese Red/Green)
 */
function getBankRBY(pokemonNum) {
    if (pokemonNum === 1) return 0x09;
    if (pokemonNum >= 2 && pokemonNum <= 0x1F) return 0x09;
    if (pokemonNum >= 0x20 && pokemonNum <= 0x4A) return 0x0A;
    if (pokemonNum >= 0x4B && pokemonNum <= 0x74) return 0x0B;
    if (pokemonNum >= 0x75 && pokemonNum <= 0x99) return 0x0C;
    if (pokemonNum >= 0x9A) return 0x0D;
    return 0x09;
}

/**
 * Convert RGB15 to RGB (used for palettes)
 */
function rgb15ToRgb(rgb15) {
    const r = Math.round(((rgb15 >> 0) & 31) * 255 / 31);
    const g = Math.round(((rgb15 >> 5) & 31) * 255 / 31);
    const b = Math.round(((rgb15 >> 10) & 31) * 255 / 31);
    return [r, g, b];
}

/**
 * Main sprite ripper class
 */
class SpriteRipper {
    constructor(romBuffer) {
        this.rom = romBuffer;
        this.spritePositions = [];
        this.spritePalettes = new Uint8Array(151);
        this.sgbPalettes = [];
        this.cgbPalettes = [];
        this.version = 'unknown';
        this.lang = 'en';

        this._initialize();
    }

    _initialize() {
        // Read ROM header
        const title = this.rom.toString('ascii', 0x134, 0x143).replace(/\0/g, '');
        const hasCGB = this.rom[0x143] === 0x80;
        const hasSGB = this.rom[0x146] === 0x03;
        const isJP = this.rom[0x14A] === 0x00;

        // Determine version
        if (title.includes('POKEMON RED')) {
            this.version = 'red';
        } else if (title.includes('POKEMON GREEN')) {
            this.version = 'green';
        } else if (title.includes('POKEMON BLUE')) {
            this.version = 'blue';
        } else if (title.includes('POKEMON YELLOW')) {
            this.version = 'yellow';
        }

        this.lang = isJP ? 'jp' : 'en';

        // Find Pokedex order
        const pokedexPos = this.rom.indexOf(POKEDEX_ORDER);
        if (pokedexPos < 0) {
            throw new Error('Could not find Pokedex order');
        }

        // Build internal ID mapping
        const internalIdMap = new Map();
        for (let i = 0; i < 0xBE; i++) {
            const n = this.rom[pokedexPos + i];
            if (n !== 0) {
                internalIdMap.set(n, i + 1);
            }
        }

        // Find base stats
        const baseStatsPos = this.rom.indexOf(BULBASAUR_STATS);
        if (baseStatsPos < 0) {
            throw new Error('Could not find base stats table');
        }

        // Read sprite pointers from base stats (28 bytes per entry)
        for (let i = 0; i < 151; i++) {
            const offset = baseStatsPos + i * 28;
            const internalId = this.rom[offset];
            const spriteSize = this.rom[offset + 10];
            const frontPtr = this.rom.readUInt16LE(offset + 11);
            const backPtr = this.rom.readUInt16LE(offset + 13);

            // Get bank for this Pokemon
            const dexNum = internalIdMap.get(internalId) || (i + 1);
            const bank = getBankRBY(internalId);
            const baseAddr = (bank - 1) * 0x4000;

            this.spritePositions[i] = {
                front: baseAddr + frontPtr,
                back: baseAddr + backPtr
            };
        }

        // Handle Mew (might not be in main table)
        if (this.rom[baseStatsPos + 150 * 28] !== 151) {
            const mewPos = this.rom.indexOf(MEW_STATS);
            if (mewPos >= 0) {
                const frontPtr = this.rom.readUInt16LE(mewPos + 10);
                const backPtr = this.rom.readUInt16LE(mewPos + 12);
                this.spritePositions[150] = {
                    front: frontPtr,
                    back: backPtr
                };
            }
        }

        // Read palette map
        const paletteMapPos = this.rom.indexOf(PALETTE_MAP);
        if (paletteMapPos >= 0) {
            for (let i = 0; i < 151; i++) {
                this.spritePalettes[i] = this.rom[paletteMapPos + i + 1];
            }

            // Read SGB palettes
            const paletteDataPos = paletteMapPos + 152;
            for (let i = 0; i < 40; i++) {
                const palette = [];
                for (let j = 0; j < 4; j++) {
                    const rgb15 = this.rom.readUInt16LE(paletteDataPos + i * 8 + j * 2);
                    palette.push(rgb15ToRgb(rgb15));
                }
                this.sgbPalettes.push(palette);
            }

            // Read CGB palettes if present
            if (hasCGB) {
                const cgbPalettePos = paletteDataPos + 40 * 8;
                for (let i = 0; i < 40; i++) {
                    const palette = [];
                    for (let j = 0; j < 4; j++) {
                        const rgb15 = this.rom.readUInt16LE(cgbPalettePos + i * 8 + j * 2);
                        palette.push(rgb15ToRgb(rgb15));
                    }
                    this.cgbPalettes.push(palette);
                }
            }
        }
    }

    /**
     * Extract a Pokemon sprite
     */
    getPokemonSprite(pokemonNum, side = 'front') {
        if (pokemonNum < 1 || pokemonNum > 151) {
            throw new Error(`Invalid Pokemon number: ${pokemonNum}`);
        }

        const pos = this.spritePositions[pokemonNum - 1];
        if (!pos) {
            throw new Error(`No sprite data for Pokemon #${pokemonNum}`);
        }

        const offset = side === 'front' ? pos.front : pos.back;
        const spriteData = this.rom.slice(offset);
        
        return decodeSprite(spriteData);
    }

    /**
     * Get palette for a Pokemon
     */
    getPokemonPalette(pokemonNum, type = 'gray') {
        if (type === 'gray') {
            return GRAY_PALETTE;
        }

        const paletteIndex = this.spritePalettes[pokemonNum - 1];
        
        if (type === 'sgb' && this.sgbPalettes.length > 0) {
            return this.sgbPalettes[paletteIndex] || GRAY_PALETTE;
        }
        
        if (type === 'cgb' && this.cgbPalettes.length > 0) {
            return this.cgbPalettes[paletteIndex] || GRAY_PALETTE;
        }

        return GRAY_PALETTE;
    }
}

/**
 * Create a PNG from sprite data
 */
function spriteToPNG(sprite, palette = GRAY_PALETTE) {
    const png = new PNG({
        width: sprite.width,
        height: sprite.height,
        colorType: 2 // RGB
    });

    // Convert indexed pixels to RGB
    for (let i = 0; i < sprite.pixels.length; i++) {
        const colorIndex = sprite.pixels[i];
        const color = palette[colorIndex] || [0, 0, 0];
        
        const pngIndex = i * 4;
        png.data[pngIndex] = color[0];     // R
        png.data[pngIndex + 1] = color[1]; // G
        png.data[pngIndex + 2] = color[2]; // B
        png.data[pngIndex + 3] = 255;      // A
    }

    return png;
}

/**
 * Get Pokemon name from Pokedex number
 */
function getPokemonName(num) {
    const names = [
        'BULBASAUR', 'IVYSAUR', 'VENUSAUR', 'CHARMANDER', 'CHARMELEON', 'CHARIZARD',
        'SQUIRTLE', 'WARTORTLE', 'BLASTOISE', 'CATERPIE', 'METAPOD', 'BUTTERFREE',
        'WEEDLE', 'KAKUNA', 'BEEDRILL', 'PIDGEY', 'PIDGEOTTO', 'PIDGEOT',
        'RATTATA', 'RATICATE', 'SPEAROW', 'FEAROW', 'EKANS', 'ARBOK',
        'PIKACHU', 'RAICHU', 'SANDSHREW', 'SANDSLASH', 'NIDORAN_F', 'NIDORINA',
        'NIDOQUEEN', 'NIDORAN_M', 'NIDORINO', 'NIDOKING', 'CLEFAIRY', 'CLEFABLE',
        'VULPIX', 'NINETALES', 'JIGGLYPUFF', 'WIGGLYTUFF', 'ZUBAT', 'GOLBAT',
        'ODDISH', 'GLOOM', 'VILEPLUME', 'PARAS', 'PARASECT', 'VENONAT',
        'VENOMOTH', 'DIGLETT', 'DUGTRIO', 'MEOWTH', 'PERSIAN', 'PSYDUCK',
        'GOLDUCK', 'MANKEY', 'PRIMEAPE', 'GROWLITHE', 'ARCANINE', 'POLIWAG',
        'POLIWHIRL', 'POLIWRATH', 'ABRA', 'KADABRA', 'ALAKAZAM', 'MACHOP',
        'MACHOKE', 'MACHAMP', 'BELLSPROUT', 'WEEPINBELL', 'VICTREEBEL', 'TENTACOOL',
        'TENTACRUEL', 'GEODUDE', 'GRAVELER', 'GOLEM', 'PONYTA', 'RAPIDASH',
        'SLOWPOKE', 'SLOWBRO', 'MAGNEMITE', 'MAGNETON', 'FARFETCHD', 'DODUO',
        'DODRIO', 'SEEL', 'DEWGONG', 'GRIMER', 'MUK', 'SHELLDER',
        'CLOYSTER', 'GASTLY', 'HAUNTER', 'GENGAR', 'ONIX', 'DROWZEE',
        'HYPNO', 'KRABBY', 'KINGLER', 'VOLTORB', 'ELECTRODE', 'EXEGGCUTE',
        'EXEGGUTOR', 'CUBONE', 'MAROWAK', 'HITMONLEE', 'HITMONCHAN', 'LICKITUNG',
        'KOFFING', 'WEEZING', 'RHYHORN', 'RHYDON', 'CHANSEY', 'TANGELA',
        'KANGASKHAN', 'HORSEA', 'SEADRA', 'GOLDEEN', 'SEAKING', 'STARYU',
        'STARMIE', 'MR_MIME', 'SCYTHER', 'JYNX', 'ELECTABUZZ', 'MAGMAR',
        'PINSIR', 'TAUROS', 'MAGIKARP', 'GYARADOS', 'LAPRAS', 'DITTO',
        'EEVEE', 'VAPOREON', 'JOLTEON', 'FLAREON', 'PORYGON', 'OMANYTE',
        'OMASTAR', 'KABUTO', 'KABUTOPS', 'AERODACTYL', 'SNORLAX', 'ARTICUNO',
        'ZAPDOS', 'MOLTRES', 'DRATINI', 'DRAGONAIR', 'DRAGONITE', 'MEWTWO',
        'MEW'
    ];
    return names[num - 1] || `POKEMON_${num}`;
}

/**
 * Extract all Pokemon sprites to PNG files
 */
export async function extractAllPokemonSprites(romPath, outputDir, options = {}) {
    const {
        side = 'front',
        paletteType = 'gray',
        onProgress = null
    } = options;

    // Read ROM
    console.log(`Reading ROM: ${romPath}`);
    const romBuffer = fs.readFileSync(romPath);
    
    // Initialize ripper
    console.log('Initializing sprite ripper...');
    const ripper = new SpriteRipper(romBuffer);
    console.log(`Detected version: ${ripper.version} (${ripper.lang})`);

    // Create output directory
    const spritesDir = path.join(outputDir, 'sprites');
    if (!fs.existsSync(spritesDir)) {
        fs.mkdirSync(spritesDir, { recursive: true });
    }

    const results = [];
    const total = 151;

    console.log(`\nExtracting ${total} Pokemon sprites...`);
    console.log('='.repeat(50));

    // Extract all sprites
    for (let i = 1; i <= total; i++) {
        try {
            if (onProgress) {
                onProgress(i, total);
            }

            const name = getPokemonName(i);
            const sprite = ripper.getPokemonSprite(i, side);
            const palette = ripper.getPokemonPalette(i, paletteType);
            const png = spriteToPNG(sprite, palette);

            const filename = `${String(i).padStart(3, '0')}_${name}.png`;
            const filepath = path.join(spritesDir, filename);
            
            fs.writeFileSync(filepath, PNG.sync.write(png));

            console.log(`[${i}/${total}] [OK] ${name} (${sprite.width}x${sprite.height})`);

            results.push({
                id: i,
                name,
                filename,
                width: sprite.width,
                height: sprite.height,
                success: true
            });
        } catch (error) {
            console.error(`[${i}/${total}] [ERROR] Failed: ${error.message}`);
            results.push({
                id: i,
                name: getPokemonName(i),
                success: false,
                error: error.message
            });
        }
    }

    console.log('='.repeat(50));
    const successful = results.filter(r => r.success).length;
    console.log(`\nExtraction complete: ${successful}/${total} sprites extracted`);

    // Save report
    const report = {
        timestamp: new Date().toISOString(),
        rom_version: ripper.version,
        language: ripper.lang,
        total: total,
        successful: successful,
        failed: total - successful,
        sprites: results
    };

    const reportPath = path.join(outputDir, 'sprite_extraction_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report saved: ${reportPath}`);

    return report;
}

export { SpriteRipper, decodeSprite, spriteToPNG, getPokemonName };
