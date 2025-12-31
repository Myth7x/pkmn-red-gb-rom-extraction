/**
 * Pokemon Red ROM Extractor
 * Main entry point for extracting Pokemon sprites from ROM
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ROM SDK imports
import { loadROM } from './rom-sdk/romReader.js';
import { extractSpriteData } from './rom-sdk/spriteExtractor.js';
import { decompressSprite } from './rom-sdk/spriteDecompressor.js';
import { POKEMON_NAMES } from './rom-sdk/constants.js';

// Utils imports
import { GAMEBOY_PALETTE } from './utils/palettes.js';
import { savePNG } from './utils/pngExporter.js';
import ProgressBar from './utils/progressBar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract all Pokemon sprites from ROM
 */
function extractAllPokemonSprites(romPath, outputDir) {
  ProgressBar.header('Pokemon Red - Pokemon Sprite Extractor');
  
  const rom = loadROM(romPath);
  const spriteData = extractSpriteData(rom);
  
  // Create output directory with pokemon subfolder
  const spritesDir = path.join(outputDir, 'pokemon-sprites', 'front');
  if (!fs.existsSync(spritesDir)) {
    fs.mkdirSync(spritesDir, { recursive: true });
  }
  
  ProgressBar.section(`Extracting Pokemon sprites to: ${spritesDir}`);
  
  // Create progress bar
  const progress = new ProgressBar({
    total: 151,
    title: 'Extracting',
    width: 40,
    showETA: true
  });
  
  for (let i = 0; i < spriteData.length; i++) {
    const sprite = spriteData[i];
    const pokedexNum = sprite.pokedexNumber;
    
    if (!pokedexNum || pokedexNum === 0) continue;
    
    const pokemonName = POKEMON_NAMES[pokedexNum] || `UNKNOWN_${pokedexNum}`;
    const filename = `${String(pokedexNum).padStart(3, '0')}_${pokemonName}.png`;
    const outputPath = path.join(spritesDir, filename);
    
    try {
      // Read compressed sprite data
      const offset = sprite.frontOffset;
      const maxSize = 1000; // Max sprite size in bytes
      const compressedData = rom.slice(offset, offset + maxSize);
      
      // Decompress sprite
      const imageData = decompressSprite(compressedData);
      
      // Save as PNG
      savePNG(imageData, GAMEBOY_PALETTE, outputPath);
      
      // Update progress as success
      progress.success(`${pokemonName} (${imageData.width}x${imageData.height})`);
    } catch (error) {
      // Update progress as error
      progress.error(pokemonName, error.message);
    }
  }
  
  // Complete the progress bar
  progress.complete('Pokemon sprite extraction complete!');
  
  // Summary
  console.log(`\nSummary:`);
  console.log(`  Success: \x1b[32m${progress.successCount}\x1b[0m Pokemon sprites`);
  console.log(`  Errors:  \x1b[31m${progress.errorCount}\x1b[0m Pokemon sprites`);
  console.log(`  Output:  ${spritesDir}`);
}

// Run extraction
const romPath = path.join(__dirname, '..', 'rom', 'Pokemon - Red Version (USA, Europe).gb');
const outputDir = path.join(__dirname, '..', 'output');

extractAllPokemonSprites(romPath, outputDir);
