/**
 * PNG Export Utility
 * 
 * Converts decompressed sprite data into PNG image files.
 * Handles palette mapping, pixel format conversion, and file output
 * for Pokemon sprites and other Game Boy graphics data.
 */

import fs from 'fs';
import { PNG } from 'pngjs';

/**
 * Save image data as PNG file
 * @param {Object} imageData - {width, height, pixels}
 * @param {Array} palette - Color palette array
 * @param {String} outputPath - Output file path
 */
export function savePNG(imageData, palette, outputPath) {
  const { width, height, pixels } = imageData;
  
  const png = new PNG({
    width,
    height,
    colorType: 2, // RGB
    inputColorType: 2,
    inputHasAlpha: false
  });
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x;
      const colorIndex = pixels[pixelIndex];
      const color = palette[colorIndex];
      
      const pngIndex = (y * width + x) * 4;
      png.data[pngIndex] = color[0];     // R
      png.data[pngIndex + 1] = color[1]; // G
      png.data[pngIndex + 2] = color[2]; // B
      png.data[pngIndex + 3] = 255;      // A
    }
  }
  
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(outputPath, buffer);
}
