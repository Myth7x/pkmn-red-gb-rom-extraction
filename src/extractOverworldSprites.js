/**
 * Extract Overworld Sprites Script
 * 
 * Extracts all NPC/overworld sprites from Pokemon Red ROM
 * and saves them as individual PNG files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import { loadROM } from './rom-sdk/romReader.js';
import { extractAllOverworldSprites, spriteToPNG, SPRITE_NAMES } from './rom-sdk/overworldSpriteExtractor.js';
import ProgressBar from './utils/progressBar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const romPath = path.join(__dirname, '..', 'rom', 'Pokemon - Red Version (USA, Europe).gb');
const outputDir = path.join(__dirname, '..', 'output', 'overworld-sprites');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Pokemon Red - Overworld Sprite Extractor');
console.log('==========================================\n');
console.log(`ROM: ${romPath}`);
console.log(`Output: ${outputDir}\n`);

// Load ROM
const rom = loadROM(romPath);

// Extract sprites
console.log('Extracting overworld sprites...\n');
const sprites = extractAllOverworldSprites(rom);

// Create progress bar
const progress = new ProgressBar({
    total: sprites.length,
    title: 'Saving sprites',
    width: 40,
    showETA: false
});

// Save each sprite as PNG
const savedSprites = [];

for (const sprite of sprites) {
    try {
        const spriteName = SPRITE_NAMES[sprite.id] || `UNKNOWN_${sprite.id}`;
        const filename = `${String(sprite.id).padStart(3, '0')}_${spriteName}.png`;
        const outputPath = path.join(outputDir, filename);
        
        // Convert to PNG
        const png = spriteToPNG(sprite);
        
        // Save file
        const buffer = PNG.sync.write(png);
        fs.writeFileSync(outputPath, buffer);
        
        savedSprites.push({
            id: sprite.id,
            name: spriteName,
            filename: filename,
            width: sprite.width,
            height: sprite.height,
            romAddress: sprite.romAddress
        });
        
        progress.success(spriteName);
    } catch (error) {
        progress.error(`Sprite ${sprite.id}`, error.message);
    }
}

progress.complete('Overworld sprite extraction complete!');

// Save JSON metadata
const jsonPath = path.join(outputDir, 'overworld_sprites.json');
fs.writeFileSync(jsonPath, JSON.stringify({
    extractionDate: new Date().toISOString(),
    totalSprites: savedSprites.length,
    sprites: savedSprites
}, null, 2), 'utf8');

console.log(`\nSummary:`);
console.log(`  Success: \x1b[32m${progress.successCount}\x1b[0m sprites`);
console.log(`  Errors:  \x1b[31m${progress.errorCount}\x1b[0m sprites`);
console.log(`  Output:  ${outputDir}`);
console.log(`  JSON:    ${jsonPath}\n`);
