/**
 * Overworld Sprite Extractor for Pokemon Red/Blue
 * 
 * Extracts NPC/overworld character sprites from ROM.
 * These are the small sprites that appear on the overworld map (trainers, NPCs, items, etc.)
 * 
 * Based on pret/pokemon-reverse-engineering-tools sprite extraction
 * Format: Pointer table at 0x17b27 with 4-byte entries [lo, hi, byte_count, bank]
 * Each sprite has 3 directional frames (down, up, left) at 64 bytes each
 * Each frame is 16x16 pixels (4 tiles in 2x2 layout)
 */

import { PNG } from 'pngjs';

/**
 * Sprite Pointer Table location
 * Located at ROM offset 0x17b27 (bank 5)
 * Each entry is 4 bytes: [pointer_lo, pointer_hi, byte_count, bank]
 */
const SPRITE_POINTER_TABLE = 0x17b27;

/**
 * Number of overworld sprite pictures
 * Pokemon Red has 72 sprite IDs (some point to same graphics)
 */
const MAX_SPRITE_PICS = 72;

/**
 * Sprite dimensions and frame structure
 * Each frame is 16x16 pixels = 4 tiles (2×2 layout)
 * Each sprite has 3 directional frames: down, up, left
 */
const TILES_PER_FRAME = 4;        // 4 tiles per frame (16x16 pixels)
const BYTES_PER_FRAME = 64;       // 4 tiles × 16 bytes per tile
const FRAMES_PER_SPRITE = 3;      // 3 directions: down, up, left

/**
 * Grayscale palette for Game Boy
 */
const GAMEBOY_PALETTE = [
    [255, 255, 255, 255], // White (transparent)
    [170, 170, 170, 255], // Light gray
    [85, 85, 85, 255],     // Dark gray
    [0, 0, 0, 255]         // Black
];

/**
 * Convert Game Boy 2bpp tile data to pixels
 * @param {Buffer} tileData - 16 bytes of tile data (8x8 pixels)
 * @returns {Array<number>} - Array of 64 pixel values (0-3)
 */
function decodeTile(tileData) {
    const pixels = [];
    for (let y = 0; y < 8; y++) {
        const byte1 = tileData[y * 2];
        const byte2 = tileData[y * 2 + 1];
        
        for (let x = 0; x < 8; x++) {
            const mask = 1 << (7 - x);
            const bit1 = (byte1 & mask) ? 1 : 0;
            const bit2 = (byte2 & mask) ? 2 : 0;
            const colorIndex = bit1 | bit2;
            pixels.push(colorIndex);
        }
    }
    return pixels;
}

/**
 * Decode a single 16x16 frame (4 tiles in 2x2 layout)
 * Tiles arranged as:
 * [0] [1]   <- Top row (8x8 each)
 * [2] [3]   <- Bottom row
 * 
 * @param {Buffer} frameData - 64 bytes of tile data (4 tiles * 16 bytes)
 * @returns {Array<number>} - Array of 256 pixel values (0-3) for 16x16 frame
 */
function decodeFrame(frameData) {
    // Decode all 4 tiles
    const tiles = [];
    for (let i = 0; i < 4; i++) {
        tiles.push(decodeTile(frameData.slice(i * 16, i * 16 + 16)));
    }
    
    // Create 16x16 frame
    const frame = new Uint8Array(16 * 16); // 256 pixels
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            const tileX = Math.floor(x / 8);  // 0 or 1
            const tileY = Math.floor(y / 8);  // 0 or 1
            const tileIdx = tileY * 2 + tileX;  // 0-3 (top-left, top-right, bottom-left, bottom-right)
            const pixelIdx = (y % 8) * 8 + (x % 8);
            frame[y * 16 + x] = tiles[tileIdx][pixelIdx];
        }
    }
    
    return Array.from(frame);
}

/**
 * Extract a single overworld sprite from ROM
 * @param {Buffer} romData - Full ROM data
 * @param {number} spriteId - Sprite ID (0-71)
 * @returns {Object|null} - Sprite data with down, up, left frames, or null if error
 */
function extractOverworldSprite(romData, spriteId) {
    try {
        // Read pointer table entry (4 bytes)
        const entryOffset = SPRITE_POINTER_TABLE + (spriteId * 4);
        if (entryOffset + 3 >= romData.length) {
            console.error(`Sprite ${spriteId}: Pointer table entry out of bounds`);
            return null;
        }
        
        const lo = romData[entryOffset];
        const hi = romData[entryOffset + 1];
        const byteCount = romData[entryOffset + 2];
        const bank = romData[entryOffset + 3];
        
        // Calculate ROM address: pointer - 0x4000 + (bank * 0x4000)
        const pointer = (hi << 8) | lo;
        const romAddress = pointer - 0x4000 + (bank * 0x4000);
        
        // Validate address
        if (romAddress < 0 || romAddress + byteCount > romData.length) {
            console.error(`Sprite ${spriteId}: Invalid ROM address 0x${romAddress.toString(16)}`);
            return null;
        }
        
        // Extract sprite data
        const spriteData = romData.slice(romAddress, romAddress + byteCount);
        
        // Decode 3 directional frames (down at 0x00, up at 0x40, left at 0x80)
        const down = decodeFrame(spriteData.slice(0x00, 0x00 + BYTES_PER_FRAME));
        const up = decodeFrame(spriteData.slice(0x40, 0x40 + BYTES_PER_FRAME));
        const left = decodeFrame(spriteData.slice(0x80, 0x80 + BYTES_PER_FRAME));
        
        return {
            id: spriteId,
            pointer: `$${hi.toString(16).padStart(2, '0')}${lo.toString(16).padStart(2, '0')}`,
            bank: `$${bank.toString(16).padStart(2, '0')}`,
            romAddress: `0x${romAddress.toString(16)}`,
            byteCount,
            width: 16,   // Each frame is 16x16 pixels
            height: 16,
            frames: {
                down,   // 16x16 frame facing down
                up,     // 16x16 frame facing up
                left    // 16x16 frame facing left
            }
        };
    } catch (error) {
        console.error(`Error extracting sprite ${spriteId}:`, error.message);
        return null;
    }
}

/**
 * Extract all overworld sprites from ROM
 * @param {Buffer} romData - Full ROM data
 * @returns {Array<Object>} - Array of sprite data
 */
export function extractAllOverworldSprites(romData) {
    const sprites = [];
    
    for (let spriteId = 0; spriteId < MAX_SPRITE_PICS; spriteId++) {
        const sprite = extractOverworldSprite(romData, spriteId);
        if (sprite) {
            sprites.push(sprite);
        }
    }
    
    return sprites;
}

/**
 * Convert sprite frame to PNG
 * @param {Array<number>} pixels - Frame pixel data (256 values)
 * @param {number} width - Frame width (16)
 * @param {number} height - Frame height (16)
 * @param {Array} palette - Color palette (default: Game Boy palette)
 * @returns {PNG} - PNG object
 */
function frameToPNG(pixels, width, height, palette = GAMEBOY_PALETTE) {
    const png = new PNG({
        width,
        height,
        colorType: 6 // RGBA
    });
    
    // Convert indexed pixels to RGBA
    for (let i = 0; i < pixels.length; i++) {
        const colorIndex = pixels[i];
        const color = palette[colorIndex] || [0, 0, 0, 255];
        const pngIndex = i * 4;
        
        png.data[pngIndex] = color[0];     // R
        png.data[pngIndex + 1] = color[1]; // G
        png.data[pngIndex + 2] = color[2]; // B
        
        // Make color 0 (white) transparent for sprites
        png.data[pngIndex + 3] = colorIndex === 0 ? 0 : color[3]; // A
    }
    
    return png;
}

/**
 * Convert sprite to PNG (all 3 directional frames side by side)
 * @param {Object} sprite - Sprite data from extractOverworldSprite
 * @param {Array} palette - Color palette (default: Game Boy palette)
 * @returns {PNG} - PNG object with all 3 frames (48x16 pixels total)
 */
export function spriteToPNG(sprite, palette = GAMEBOY_PALETTE) {
    // Create a sprite sheet with 3 frames in a row (down, up, left)
    // Width: 16 * 3 = 48 pixels, Height: 16 pixels
    const sheetWidth = 48;
    const sheetHeight = 16;
    
    const png = new PNG({
        width: sheetWidth,
        height: sheetHeight,
        colorType: 6 // RGBA
    });
    
    const frames = [sprite.frames.down, sprite.frames.up, sprite.frames.left];
    
    // Draw each frame
    for (let frameIdx = 0; frameIdx < 3; frameIdx++) {
        const framePixels = frames[frameIdx];
        const frameX = frameIdx * 16;
        
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                const srcIdx = y * 16 + x;
                const colorIndex = framePixels[srcIdx];
                const color = palette[colorIndex] || [0, 0, 0, 255];
                
                const dstX = frameX + x;
                const dstY = y;
                const dstIdx = (dstY * sheetWidth + dstX) * 4;
                
                png.data[dstIdx] = color[0];     // R
                png.data[dstIdx + 1] = color[1]; // G
                png.data[dstIdx + 2] = color[2]; // B
                
                // Make color 0 (white) transparent for sprites
                png.data[dstIdx + 3] = colorIndex === 0 ? 0 : color[3]; // A
            }
        }
    }
    
    return png;
}

/**
 * Sprite picture names (for reference)
 * Based on pret/pokered sprite constants (IDs 0-71)
 */
export const SPRITE_NAMES = {
    0: 'RED',
    1: 'BLUE',
    2: 'OAK',
    3: 'BUG_CATCHER',
    4: 'SLOWBRO',
    5: 'LASS',
    6: 'BLACK_HAIR_BOY_1',
    7: 'LITTLE_GIRL',
    8: 'BIRD',
    9: 'FAT_BALD_GUY',
    10: 'GAMBLER',
    11: 'BLACK_HAIR_BOY_2',
    12: 'GIRL',
    13: 'HIKER',
    14: 'FOULARD_WOMAN',
    15: 'GENTLEMAN',
    16: 'DAISY',
    17: 'BIKER',
    18: 'SAILOR',
    19: 'COOK',
    20: 'BIKE_SHOP_GUY',
    21: 'MR_FUJI',
    22: 'GIOVANNI',
    23: 'ROCKET',
    24: 'MEDIUM',
    25: 'WAITER',
    26: 'ERIKA',
    27: 'CHANNELER',
    28: 'ROCK',
    29: 'GUARD',
    30: 'ROCKET_F',
    31: 'NURSE',
    32: 'CABLE_CLUB_WOMAN',
    33: 'MR_MASTERBALL',
    34: 'LAPRAS_GIVER',
    35: 'WARDEN',
    36: 'SS_CAPTAIN',
    37: 'FISHER',
    38: 'KOGA',
    39: 'GUARD_2',
    40: 'MOM',
    41: 'BALDING_GUY',
    42: 'YOUNG_BOY',
    43: 'GAMEBOY_KID',
    44: 'GAMEBOY_KID_COPY',
    45: 'CLEFAIRY',
    46: 'AGATHA',
    47: 'BRUNO',
    48: 'LORELEI',
    49: 'SEEL',
    50: 'BALL',
    51: 'OMANYTE',
    52: 'BOULDER',
    53: 'PAPER_SHEET',
    54: 'BOOK_MAP_DEX',
    55: 'CLIPBOARD',
    56: 'SNORLAX',
    57: 'OLD_AMBER_COPY',
    58: 'OLD_AMBER',
    59: 'LYING_OLD_MAN',
    // Sprites 60-71 exist but may be duplicates or unused
};
