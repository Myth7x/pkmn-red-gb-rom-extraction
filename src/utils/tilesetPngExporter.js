/**
 * Tileset PNG Exporter
 * 
 * Exports tileset data (8x8 pixel tiles) to PNG images.
 * Arranges multiple tiles into a single image grid for easy viewing
 * and use in map editors or visualization tools. Applies grayscale palette
 * to 2bpp Game Boy graphics data.
 */

import PNG from 'pngjs';
import fs from 'fs';
import { GRAY_PALETTE } from './palettes.js';

const { PNG: PNGClass } = PNG;

/**
 * Create a PNG image from tileset tiles
 * Arranges tiles in a grid (16 tiles per row)
 * @param {Array} tiles - Array of tile pixel data
 * @param {Array} palette - Color palette to use
 * @returns {Buffer} - PNG image buffer
 */
export function tilesToPNG(tiles, palette = GRAY_PALETTE) {
  if (!tiles || tiles.length === 0) {
    throw new Error('No tiles provided');
  }
  
  const tilesPerRow = 16;
  const rows = Math.ceil(tiles.length / tilesPerRow);
  
  const width = tilesPerRow * 8;
  const height = rows * 8;
  
  const png = new PNGClass({ width, height, colorType: 2 }); // RGB
  
  for (let tileIdx = 0; tileIdx < tiles.length; tileIdx++) {
    const tile = tiles[tileIdx];
    const tileRow = Math.floor(tileIdx / tilesPerRow);
    const tileCol = tileIdx % tilesPerRow;
    
    const startX = tileCol * 8;
    const startY = tileRow * 8;
    
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const pixelValue = tile[y * 8 + x];
        const color = palette[pixelValue];
        
        const pngX = startX + x;
        const pngY = startY + y;
        const idx = (pngY * width + pngX) * 3;
        
        png.data[idx] = color[0];     // R
        png.data[idx + 1] = color[1]; // G
        png.data[idx + 2] = color[2]; // B
      }
    }
  }
  
  return PNGClass.sync.write(png);
}

/**
 * Save tileset as PNG file
 * @param {Object} tileset - Tileset object with tiles array
 * @param {string} outputPath - Path to save PNG file
 * @param {Array} palette - Color palette to use
 */
export function saveTilesetPNG(tileset, outputPath, palette = GRAY_PALETTE) {
  const pngBuffer = tilesToPNG(tileset.tiles, palette);
  fs.writeFileSync(outputPath, pngBuffer);
}
