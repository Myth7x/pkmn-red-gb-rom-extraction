/**
 * Map Data Extractor for Pokemon Red/Blue
 * 
 * Main module that orchestrates extraction of all map-related data:
 * - Map headers (dimensions, tileset, connections)
 * - Map objects (warps, signs, NPCs)
 * - Map block data (tile layout)
 * - Tileset data (blocks, graphics, collision)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import { MAP_NAMES } from './mapConstants.js';
import { readAllMapHeaders, readMapBlockData } from './mapHeaderReader.js';
import { readMapObjects, getObjectSummary } from './mapObjectReader.js';
import { extractScriptText } from './scriptTextReader.js';
import {
  readTilesetHeader,
  readAllTilesetHeaders,
  readTilesetBlocks,
  readTilesetCollision,
  readTilesetGraphics,
  decode2bppTile,
  getTileCollisionInfo
} from './tilesetBlockReader.js';
import { analyzeTileMetadata, generateMetadataSummary } from './tileMetadata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract complete map data
 * @param {Buffer} rom - ROM buffer
 * @param {number} mapId - Map ID to extract
 * @param {Object} mapHeader - Map header object
 * @returns {Object} - Complete map data
 */
export function extractMapData(rom, mapId, mapHeader) {
  try {
    // Read map objects (warps, signs, sprites)
    const objects = readMapObjects(rom, mapHeader, mapHeader.bank);
    const objectSummary = getObjectSummary(objects);

    // Extract script text for sprites (NPCs)
    if (objects.sprites && objects.sprites.data) {
      for (const sprite of objects.sprites.data) {
        try {
          sprite.scriptText = extractScriptText(rom, mapHeader, mapHeader.bank, sprite.textId);
        } catch (error) {
          sprite.scriptText = { error: `Failed to extract script: ${error.message}` };
        }
      }
    }

    // Extract script text for signs
    if (objects.signs && objects.signs.data) {
      for (const sign of objects.signs.data) {
        try {
          sign.scriptText = extractScriptText(rom, mapHeader, mapHeader.bank, sign.textId);
        } catch (error) {
          sign.scriptText = { error: `Failed to extract script: ${error.message}` };
        }
      }
    }

    // Read map block data
    const blockData = readMapBlockData(rom, mapHeader, mapHeader.bank);
    
    // Debug log for first map
    if (mapId === 0) {
      console.log(`[DEBUG] Map ${mapId} (${mapHeader.name}):`);
      console.log(`  - blockData length: ${blockData.length}`);
      console.log(`  - Expected: ${mapHeader.width} x ${mapHeader.height} = ${mapHeader.width * mapHeader.height}`);
      console.log(`  - First 10 blocks:`, Array.from(blockData.slice(0, 10)));
    }

    // Get tileset information
    const tilesetHeader = readTilesetHeader(rom, mapHeader.tileset);

    const result = {
      ...mapHeader,
      objects,
      objectSummary,
      blockData: Array.from(blockData),
      tilesetInfo: tilesetHeader
    };
    
    // Debug log for first map
    if (mapId === 0) {
      console.log(`  - Result has blockData: ${!!result.blockData}`);
      console.log(`  - Result blockData length: ${result.blockData?.length}`);
    }

    return result;
  } catch (error) {
    console.warn(`[WARNING] Failed to extract complete data for map ${mapId}: ${error.message}`);
    return {
      ...mapHeader,
      error: error.message
    };
  }
}

/**
 * Extract all map data from ROM
 * @param {Buffer} rom - ROM buffer
 * @param {Array<number>} mapIds - Optional array of specific map IDs
 * @returns {Object} - All map data
 */
export function extractAllMaps(rom, mapIds = null) {
  console.log('\n============================================================');
  console.log('Pokemon Red - Map Data Extractor');
  console.log('============================================================\n');

  // Read all map headers
  const headers = readAllMapHeaders(rom, mapIds);
  console.log(`[OK] Read ${headers.length} map headers\n`);

  // Extract complete data for each map
  console.log('Extracting complete map data...');
  const maps = [];
  let successCount = 0;
  let errorCount = 0;

  for (const header of headers) {
    try {
      const mapData = extractMapData(rom, header.mapId, header);
      maps.push(mapData);
      
      if (!mapData.error) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      errorCount++;
      console.warn(`[ERROR] Map ${header.mapId}: ${error.message}`);
    }
  }

  console.log(`\n[OK] Extracted ${successCount} maps successfully`);
  if (errorCount > 0) {
    console.log(`[WARNING] ${errorCount} maps had errors`);
  }

  return {
    maps,
    summary: {
      total: maps.length,
      successful: successCount,
      errors: errorCount
    }
  };
}

/**
 * Add tile metadata analysis to maps
 * @param {Object} mapData - Map data from extractAllMaps
 * @param {Object} tilesetData - Tileset data from extractAllTilesets
 * @returns {Object} - Map data with tile metadata
 */
export function addTileMetadataToMaps(mapData, tilesetData) {
  console.log('\nAnalyzing tile metadata for maps...');
  
  let analyzedCount = 0;
  
  for (const map of mapData.maps) {
    if (map.error || !map.blockData || map.blockData.length === 0) {
      continue;
    }

    try {
      const metadata = analyzeTileMetadata(map, tilesetData);
      const summary = generateMetadataSummary(metadata);
      
      map.tileMetadata = {
        summary: summary,
        grassZones: metadata ? metadata.encounterZones : [],
        waterAreas: metadata ? metadata.surfableAreas : [],
        warpTileCount: metadata ? metadata.warpTiles.length : 0,
        ledgeTileCount: metadata ? metadata.ledgeTiles.length : 0,
        tileTypeBreakdown: metadata ? metadata.tilesByType : {}
      };
      
      analyzedCount++;
    } catch (error) {
      console.warn(`[WARNING] Failed to analyze tiles for map ${map.mapId}: ${error.message}`);
    }
  }
  
  console.log(`[OK] Analyzed tile metadata for ${analyzedCount} maps`);
  
  return mapData;
}

/**
 * Extract all tileset data
 * @param {Buffer} rom - ROM buffer
 * @returns {Object} - All tileset data
 */
export function extractAllTilesets(rom) {
  console.log('\nExtracting tileset data...');
  
  const headers = readAllTilesetHeaders(rom);
  const tilesets = [];

  for (const header of headers) {
    try {
      // Read blocks (metatiles - 4x4 tile arrangements)
      const blocks = readTilesetBlocks(rom, header, 256);
      
      // Read collision data (list of impassable tile IDs)
      const impassableTiles = readTilesetCollision(rom, header);
      
      // Read raw graphics (we'll process this separately for PNG export)
      const graphics = readTilesetGraphics(rom, header, 256);

      tilesets.push({
        ...header,
        blocks: blocks, // Now structured with tile IDs
        impassableTiles: impassableTiles, // Array of impassable tile IDs
        graphicsSize: graphics.length,
        graphicsOffset: `Included (${graphics.length} bytes)`
      });

      console.log(`[OK] Tileset ${header.tilesetId}: ${blocks.length} blocks, ${impassableTiles.length} impassable tiles, ${graphics.length} bytes graphics`);
    } catch (error) {
      console.warn(`[WARNING] Failed to extract tileset ${header.tilesetId}: ${error.message}`);
    }
  }

  return {
    tilesets,
    summary: {
      total: tilesets.length,
      totalBlocks: tilesets.reduce((sum, t) => sum + t.blocks.length, 0)
    }
  };
}

/**
 * Save map data to JSON files
 * @param {Object} mapData - Map data from extractAllMaps
 * @param {string} outputDir - Output directory path
 */
export function saveMapDataJSON(mapData, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  // Save individual map files
  const mapsDir = path.join(outputDir, 'maps');
  fs.mkdirSync(mapsDir, { recursive: true });

  for (const map of mapData.maps) {
    // Add texture reference to map data
    const mapWithTexture = {
      ...map,
      tilesetTexture: `textures/tileset_${String(map.tileset).padStart(2, '0')}_${map.tilesetName.replace(/\s+/g, '_')}.png`
    };
    
    const filename = `${String(map.mapId).padStart(3, '0')}_${map.name.replace(/\s+/g, '_')}.json`;
    const filepath = path.join(mapsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(mapWithTexture, null, 2));
  }

  // Save complete map index
  const indexFile = path.join(outputDir, 'map_index.json');
  const index = {
    summary: mapData.summary,
    maps: mapData.maps.map(m => ({
      mapId: m.mapId,
      name: m.name,
      width: m.width,
      height: m.height,
      tileset: m.tilesetName,
      tilesetTexture: `textures/tileset_${String(m.tileset).padStart(2, '0')}_${m.tilesetName.replace(/\s+/g, '_')}.png`,
      connections: m.connections,
      warps: m.objectSummary?.totalWarps || 0,
      signs: m.objectSummary?.totalSigns || 0,
      sprites: m.objectSummary?.totalSprites || 0
    }))
  };
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));

  console.log(`\n[OK] Saved ${mapData.maps.length} map files to ${mapsDir}`);
  console.log(`[OK] Saved map index to ${indexFile}`);
}

/**
 * Save tileset data to JSON
 * @param {Object} tilesetData - Tileset data from extractAllTilesets
 * @param {string} outputDir - Output directory path
 */
export function saveTilesetDataJSON(tilesetData, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  // Update tileset references to point to texture files
  const tilesetsWithTextures = {
    ...tilesetData,
    tilesets: tilesetData.tilesets.map(tileset => ({
      ...tileset,
      textureFile: `textures/tileset_${String(tileset.tilesetId).padStart(2, '0')}_${tileset.name.replace(/\s+/g, '_')}.png`
    }))
  };

  const filepath = path.join(outputDir, 'tilesets_complete.json');
  fs.writeFileSync(filepath, JSON.stringify(tilesetsWithTextures, null, 2));

  console.log(`[OK] Saved tileset data to ${filepath}`);
}

/**
 * Export tileset graphics as PNG textures
 * @param {Buffer} rom - ROM buffer
 * @param {Object} tilesetData - Tileset data from extractAllTilesets
 * @param {string} outputDir - Output directory for textures
 */
export function exportTilesetGraphics(rom, tilesetData, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  // Game Boy grayscale palette (4 shades)
  const palette = [
    { r: 255, g: 255, b: 255, a: 255 }, // White
    { r: 170, g: 170, b: 170, a: 255 }, // Light gray
    { r: 85, g: 85, b: 85, a: 255 },    // Dark gray
    { r: 0, g: 0, b: 0, a: 255 }        // Black
  ];

  for (const tileset of tilesetData.tilesets) {
    try {
      // Read raw tile graphics
      const header = {
        tilesetId: tileset.tilesetId,
        name: tileset.name,
        bank: tileset.bank,
        gfxPtr: tileset.gfxPtr
      };
      
      const graphics = readTilesetGraphics(rom, header, 256);
      
      // Create PNG: 16 tiles wide x 16 tiles tall = 128x128 pixels
      const tilesPerRow = 16;
      const numRows = Math.ceil(256 / tilesPerRow);
      const pngWidth = tilesPerRow * 8;
      const pngHeight = numRows * 8;
      
      const png = new PNG({
        width: pngWidth,
        height: pngHeight,
        colorType: 2 // RGB
      });

      // Decode and write each tile
      for (let tileIdx = 0; tileIdx < 256; tileIdx++) {
        const tileData = graphics.slice(tileIdx * 16, (tileIdx + 1) * 16);
        const pixels = decode2bppTile(tileData);
        
        const tileX = (tileIdx % tilesPerRow) * 8;
        const tileY = Math.floor(tileIdx / tilesPerRow) * 8;
        
        for (let py = 0; py < 8; py++) {
          for (let px = 0; px < 8; px++) {
            const pixelValue = pixels[py * 8 + px];
            const color = palette[pixelValue];
            
            const pngX = tileX + px;
            const pngY = tileY + py;
            const idx = (pngY * pngWidth + pngX) * 4;
            
            png.data[idx] = color.r;
            png.data[idx + 1] = color.g;
            png.data[idx + 2] = color.b;
            png.data[idx + 3] = color.a;
          }
        }
      }

      // Save PNG
      const filename = `tileset_${String(tileset.tilesetId).padStart(2, '0')}_${tileset.name.replace(/\s+/g, '_')}.png`;
      const filepath = path.join(outputDir, filename);
      const buffer = PNG.sync.write(png);
      fs.writeFileSync(filepath, buffer);

      console.log(`[OK] Exported ${filename} (${pngWidth}x${pngHeight}, 256 tiles)`);
    } catch (error) {
      console.warn(`[WARNING] Failed to export tileset ${tileset.tilesetId} graphics: ${error.message}`);
    }
  }

  console.log(`\n[OK] Exported ${tilesetData.tilesets.length} tileset textures to ${outputDir}`);
}
