/**
 * Pokemon Red ROM Extractor
 * 
 * Main orchestrator for extracting all data from Pokemon Red/Blue/Yellow ROMs.
 * Supports modular extraction: all, pkmn, maps, tilesets, names
 * 
 * Usage: node src/index.js [command]
 *   all       - Extract everything (default)
 *   pkmn      - Extract Pokemon names and sprites only
 *   maps      - Extract map data only
 *   tilesets  - Extract tileset graphics only
 *   names     - Extract Pokemon names only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

// ROM SDK imports
import { loadROM } from './rom-sdk/romReader.js';
import { extractSpriteData } from './rom-sdk/spriteExtractor.js';
import { decompressSprite } from './rom-sdk/spriteDecompressor.js';
import { extractPokemonNames, getPokemonNameByInternalId } from './rom-sdk/nameExtractor.js';
import { extractAllMaps, extractAllTilesets, addTileMetadataToMaps, saveMapDataJSON, saveTilesetDataJSON, exportTilesetGraphics } from './rom-sdk/mapDataExtractor.js';
import { extractAllOverworldSprites, spriteToPNG, SPRITE_NAMES } from './rom-sdk/overworldSpriteExtractor.js';

// Utils imports
import { GAMEBOY_PALETTE, GRAY_PALETTE } from './utils/palettes.js';
import { savePNG } from './utils/pngExporter.js';
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
 * Clear output directory (excluding webclient)
 * @param {String} dirPath - Directory to clear
 */
function clearDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    // Get all items in directory
    const items = fs.readdirSync(dirPath);
    
    // Remove everything except webclient
    for (const item of items) {
      if (item !== 'webclient') {
        const itemPath = path.join(dirPath, item);
        fs.rmSync(itemPath, { recursive: true, force: true });
      }
    }
  } else {
    fs.mkdirSync(dirPath, { recursive: true });
  }
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
 * Extract Pokemon names only
 * @param {String} romPath - Path to ROM file
 * @param {String} outputDir - Output directory
 * @returns {Array<string>} Pokemon names
 */
function extractNames(romPath, outputDir) {
  ProgressBar.header('Pokemon Red - Name Extractor');
  
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
  
  console.log(`[OK] Pokemon names extracted successfully!`);
  console.log(`  Total names: ${pokemonNames.length}`);
  console.log(`  Output: ${namesJsonPath}\n`);
  
  return pokemonNames;
}

/**
 * Extract map data
 * @param {String} romPath - Path to ROM file
 * @param {String} outputDir - Output directory
 */
function extractMaps(romPath, outputDir) {
  ProgressBar.header('Pokemon Red - Map Data Extractor');
  
  const rom = loadROM(romPath);
  
  console.log('Extracting map data from ROM...\n');
  
  // Extract map data
  const mapData = extractAllMaps(rom);
  
  console.log('\nExtracting tileset data from ROM...\n');
  
  // Extract complete tileset data with graphics
  const tilesetData = extractAllTilesets(rom);
  
  // Add tile metadata to maps
  const mapDataWithMetadata = addTileMetadataToMaps(mapData, tilesetData);
  
  // Save map data
  const mapOutputDir = path.join(outputDir, 'map-data');
  saveMapDataJSON(mapDataWithMetadata, mapOutputDir);
  
  // Save tileset data
  saveTilesetDataJSON(tilesetData, mapOutputDir);
  
  // Export tileset graphics as PNG textures
  console.log('\nExporting tileset graphics as textures...\n');
  const texturesDir = path.join(mapOutputDir, 'textures');
  exportTilesetGraphics(rom, tilesetData, texturesDir);
  
  console.log('\n[OK] Map data extraction complete!');
  console.log(`  Output: ${mapOutputDir}\n`);
}

/**
 * Extract overworld sprites
 * @param {String} romPath - Path to ROM file
 * @param {String} outputDir - Output directory
 */
function extractOverworldSprites(romPath, outputDir) {
  console.log('\n============================================================');
  console.log('Extracting Overworld Sprites');
  console.log('============================================================\n');
  
  const rom = loadROM(romPath);
  const spritesDir = path.join(outputDir, 'overworld-sprites');
  
  // Ensure directory exists
  fs.mkdirSync(spritesDir, { recursive: true });
  
  // Extract all overworld sprites (returns array)
  const spriteArray = extractAllOverworldSprites(rom);
  
  // Save each sprite as PNG (format: 003_BUG_CATCHER.png)
  for (const sprite of spriteArray) {
    const filename = `${String(sprite.id).padStart(3, '0')}_${SPRITE_NAMES[sprite.id] || 'UNKNOWN'}.png`;
    const outputPath = path.join(spritesDir, filename);
    const png = spriteToPNG(sprite);
    const buffer = PNG.sync.write(png);
    fs.writeFileSync(outputPath, buffer);
  }
  
  // Create metadata object
  const overworldData = {
    extractionDate: new Date().toISOString(),
    totalSprites: spriteArray.length,
    sprites: spriteArray.map(s => ({
      id: s.id,
      name: SPRITE_NAMES[s.id] || 'UNKNOWN',
      bank: s.bank,
      pointer: s.pointer,
      romAddress: s.romAddress,
      byteCount: s.byteCount,
      width: s.width,
      height: s.height,
      filename: `${String(s.id).padStart(3, '0')}_${SPRITE_NAMES[s.id] || 'UNKNOWN'}.png`
    }))
  };
  
  // Save metadata JSON
  const metadataPath = path.join(spritesDir, 'overworld_sprites.json');
  fs.writeFileSync(metadataPath, JSON.stringify(overworldData, null, 2));
  
  console.log(`\n[OK] Overworld sprites extracted successfully!`);
  console.log(`  Total sprites: ${overworldData.sprites.length}`);
  console.log(`  Output: ${spritesDir}\n`);
}

/**
 * Main execution function
 */
function main() {
  // Get command from arguments (default: 'all')
  const command = process.argv[2] || 'all';
  
  const romPath = path.join(__dirname, '..', 'rom', 'Pokemon - Red Version (USA, Europe).gb');
  const outputDir = path.join(__dirname, '..', 'output');
  
  // Validate command
  const validCommands = ['all', 'pkmn', 'maps', 'names'];
  if (!validCommands.includes(command)) {
    console.error(`\n[ERROR] Invalid command: "${command}"`);
    console.error(`Valid commands: ${validCommands.join(', ')}\n`);
    process.exit(1);
  }
  
  console.log('\n============================================================');
  console.log(`Pokemon Red ROM Extractor - Mode: ${command.toUpperCase()}`);
  console.log('============================================================\n');
  
  // Clear output directory based on command
  if (command === 'all') {
    console.log('Clearing output directory...');
    clearDirectory(outputDir);
  } else if (command === 'pkmn') {
    console.log('Clearing Pokemon sprites directory...');
    const spritesDir = path.join(outputDir, 'pokemon-sprites');
    if (fs.existsSync(spritesDir)) {
      fs.rmSync(spritesDir, { recursive: true, force: true });
    }
  } else if (command === 'maps') {
    console.log('Clearing map data directory...');
    const mapsDir = path.join(outputDir, 'map-data');
    if (fs.existsSync(mapsDir)) {
      fs.rmSync(mapsDir, { recursive: true, force: true });
    }
  }
  
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });
  
  const rom = loadROM(romPath);
  let pokemonNames;
  
  // Execute based on command
  switch (command) {
    case 'all':
      console.log('\nExtracting all data...\n');
      
      // Extract Pokemon names
      pokemonNames = extractNames(romPath, outputDir);
      
      // Extract front sprites
      extractPokemonSprites(romPath, outputDir, 'front', pokemonNames);
      
      // Extract back sprites
      extractPokemonSprites(romPath, outputDir, 'back', pokemonNames);
      
      // Extract map data (includes tileset graphics)
      extractMaps(romPath, outputDir);
      
      // Extract overworld sprites
      extractOverworldSprites(romPath, outputDir);
      break;
      
    case 'pkmn':
      console.log('\nExtracting Pokemon data...\n');
      
      // Extract Pokemon names
      pokemonNames = extractNames(romPath, outputDir);
      
      // Extract front sprites
      extractPokemonSprites(romPath, outputDir, 'front', pokemonNames);
      
      // Extract back sprites
      extractPokemonSprites(romPath, outputDir, 'back', pokemonNames);
      break;
      
    case 'maps':
      extractMaps(romPath, outputDir);
      break;
      
    case 'names':
      extractNames(romPath, outputDir);
      break;
  }
  
  console.log('\n============================================================');
  console.log(`Extraction Complete! (Mode: ${command.toUpperCase()})`);
  console.log('============================================================\n');
}

// Run main function
main();
