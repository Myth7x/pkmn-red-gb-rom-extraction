/**
 * Pokemon Red ROM Extractor
 * 
 * Main orchestrator for extracting all data from Pokemon Red/Blue/Yellow ROMs.
 * Coordinates extraction of Pokemon names (190 total), front/back sprites (151 Pokemon),
 * and map tilesets (24 total). Manages output directory structure, JSON metadata generation,
 * progress reporting, and error handling for the entire extraction pipeline.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ROM SDK imports
import { loadROM } from './rom-sdk/romReader.js';
import { extractSpriteData } from './rom-sdk/spriteExtractor.js';
import { decompressSprite } from './rom-sdk/spriteDecompressor.js';
import { extractPokemonNames, getPokemonNameByInternalId } from './rom-sdk/nameExtractor.js';
import { extractAllTilesets } from './rom-sdk/tilesetExtractor.js';

// Utils imports
import { GAMEBOY_PALETTE, GRAY_PALETTE } from './utils/palettes.js';
import { savePNG } from './utils/pngExporter.js';
import { saveTilesetPNG } from './utils/tilesetPngExporter.js';
import ProgressBar from './utils/progressBar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Clear output directory
 * @param {String} dirPath - Directory to clear
 */
function clearDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Save data as JSON file
 * @param {String} filePath - Output file path
 * @param {Object} data - Data to save
 */
function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Extract Pokemon sprites from ROM (front or back)
 * @param {String} romPath - Path to ROM file
 * @param {String} outputDir - Output directory
 * @param {String} spriteType - 'front' or 'back'
 * @param {Array<string>} pokemonNames - Pokemon names from ROM
 */
function extractPokemonSprites(romPath, outputDir, spriteType = 'front', pokemonNames) {
  ProgressBar.header(`Pokemon Red - Pokemon Sprite Extractor (${spriteType.toUpperCase()})`);
  
  const rom = loadROM(romPath);
  const spriteData = extractSpriteData(rom, spriteType);
  
  // Create output directory with pokemon subfolder
  const spritesDir = path.join(outputDir, 'pokemon-sprites', spriteType);
  clearDirectory(spritesDir);
  
  ProgressBar.section(`Extracting Pokemon ${spriteType} sprites to: ${spritesDir}`);
  
  // Create progress bar
  const progress = new ProgressBar({
    total: 151,
    title: `Extracting ${spriteType}`,
    width: 40,
    showETA: true
  });
  
  const extractedSprites = [];
  
  for (let i = 0; i < spriteData.length; i++) {
    const sprite = spriteData[i];
    const pokedexNum = sprite.pokedexNumber;
    
    if (!pokedexNum || pokedexNum === 0) continue;
    
    // Get Pokemon name using Pokedex number to look up the correct name index
    // The name table is in internal ID order, so we need to map Pokedex → Name Index
    const nameIndex = POKEDEX_TO_NAME_INDEX[pokedexNum - 1];
    const pokemonName = getPokemonNameByInternalId(pokemonNames, nameIndex);
    const filename = `${String(pokedexNum).padStart(3, '0')}_${pokemonName}.png`;
    const outputPath = path.join(spritesDir, filename);
    
    try {
      // Read compressed sprite data using the correct offset
      const offset = sprite.spriteOffset;
      const maxSize = 1000; // Max sprite size in bytes
      const compressedData = rom.slice(offset, offset + maxSize);
      
      // Decompress sprite
      const imageData = decompressSprite(compressedData);
      
      // Save as PNG
      savePNG(imageData, GAMEBOY_PALETTE, outputPath);
      
      // Store extraction info
      extractedSprites.push({
        pokedexNumber: pokedexNum,
        indexNumber: sprite.indexNumber, // Internal ID for sprite bank calculation
        name: pokemonName,
        spriteType: spriteType,
        width: imageData.width,
        height: imageData.height,
        offset: `0x${offset.toString(16).toUpperCase()}`,
        filename: filename
      });
      
      // Update progress as success
      progress.success(`${pokemonName} (${imageData.width}x${imageData.height})`);
    } catch (error) {
      // Update progress as error
      progress.error(pokemonName, error.message);
    }
  }
  
  // Complete the progress bar
  progress.complete(`Pokemon ${spriteType} sprite extraction complete!`);
  
  // Save extraction info to JSON
  const jsonPath = path.join(outputDir, `pokemon_${spriteType}_sprites.json`);
  saveJSON(jsonPath, {
    extractionDate: new Date().toISOString(),
    spriteType: spriteType,
    totalSprites: extractedSprites.length,
    sprites: extractedSprites
  });
  
  // Summary
  console.log(`\nSummary:`);
  console.log(`  Success: \x1b[32m${progress.successCount}\x1b[0m Pokemon sprites`);
  console.log(`  Errors:  \x1b[31m${progress.errorCount}\x1b[0m Pokemon sprites`);
  console.log(`  Output:  ${spritesDir}`);
  console.log(`  JSON:    ${jsonPath}\n`);
  
  return progress;
}

/**
 * Extract tileset graphics from ROM
 * @param {String} romPath - Path to ROM file
 * @param {String} outputDir - Output directory
 */
function extractTilesets(romPath, outputDir) {
  ProgressBar.header('Pokemon Red - Tileset Extractor');
  
  const rom = loadROM(romPath);
  
  // Create output directory for tilesets
  const tilesetsDir = path.join(outputDir, 'tilesets');
  clearDirectory(tilesetsDir);
  
  ProgressBar.section(`Extracting tilesets to: ${tilesetsDir}`);
  
  // Extract all tilesets
  const { tilesets, errors } = extractAllTilesets(rom);
  
  // Create progress bar
  const progress = new ProgressBar({
    total: tilesets.length,
    title: 'Extracting tilesets',
    width: 40,
    showETA: true
  });
  
  const extractedTilesets = [];
  
  for (const tileset of tilesets) {
    try {
      const filename = `${String(tileset.id).padStart(2, '0')}_${tileset.name}.png`;
      const outputPath = path.join(tilesetsDir, filename);
      
      saveTilesetPNG(tileset, outputPath, GRAY_PALETTE);
      
      extractedTilesets.push({
        id: tileset.id,
        name: tileset.name,
        tileCount: tileset.tiles.length,
        gfxOffset: `0x${tileset.gfxOffset.toString(16).toUpperCase()}`,
        filename: filename
      });
      
      progress.success(`${tileset.name} (${tileset.tiles.length} tiles)`);
    } catch (error) {
      progress.error(tileset.name, error.message);
    }
  }
  
  // Complete the progress bar
  progress.complete('Tileset extraction complete!');
  
  // Save extraction info to JSON
  const jsonPath = path.join(outputDir, 'tilesets.json');
  saveJSON(jsonPath, {
    extractionDate: new Date().toISOString(),
    totalTilesets: extractedTilesets.length,
    tilesets: extractedTilesets
  });
  
  // Summary
  console.log(`\nSummary:`);
  console.log(`  Success: \x1b[32m${progress.successCount}\x1b[0m tilesets`);
  console.log(`  Errors:  \x1b[31m${progress.errorCount}\x1b[0m tilesets`);
  console.log(`  Output:  ${tilesetsDir}`);
  console.log(`  JSON:    ${jsonPath}\n`);
  
  return progress;
}

// Run extraction
const romPath = path.join(__dirname, '..', 'rom', 'Pokemon - Red Version (USA, Europe).gb');
const outputDir = path.join(__dirname, '..', 'output');

// Clear output directory
console.log('Clearing output directory...');
clearDirectory(outputDir);

// Extract Pokemon names from ROM
console.log('Extracting Pokemon names from ROM...\n');
const rom = loadROM(romPath);
const pokemonNames = extractPokemonNames(rom);

// Save Pokemon names to JSON
const namesJsonPath = path.join(outputDir, 'pokemon_names.json');
saveJSON(namesJsonPath, {
  extractionDate: new Date().toISOString(),
  totalNames: pokemonNames.length,
  names: pokemonNames.map((name, index) => ({
    internalId: index + 1,
    name: name
  }))
});
console.log(`Pokemon names saved to: ${namesJsonPath}\n`);

// Extract front sprites
extractPokemonSprites(romPath, outputDir, 'front', pokemonNames);

// Extract back sprites
extractPokemonSprites(romPath, outputDir, 'back', pokemonNames);

// Extract tilesets
extractTilesets(romPath, outputDir);
