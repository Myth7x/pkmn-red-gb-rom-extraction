// Test script based on pret/pokemon-reverse-engineering-tools findings
// Overworld sprites are 4 tiles (64 bytes) each
// Pointer table is at 0x17b27 with 4-byte entries: [lo, hi, byte_count, bank]
// Each sprite has 3 directional frames (down, up, left) @ 0x00, 0x40, 0x80

import fs from 'fs';
import PNG from 'pngjs';
const { PNG: PNGConstructor } = PNG;

const ROM_PATH = './rom/Pokemon - Red Version (USA, Europe).gb';
const SPRITE_POINTER_TABLE = 0x17b27;
const TILES_PER_FRAME = 4; // 2x2 tiles = 16x16 pixels
const BYTES_PER_FRAME = 64; // 4 tiles * 16 bytes/tile

// Test RED sprite (ID 0x01)
const rom = fs.readFileSync(ROM_PATH);

// Read pointer table entry (sprite ID 1 = RED, offset 0)
const entryOffset = SPRITE_POINTER_TABLE + (0 * 4); // (sprite_id - 1) * 4
const lo = rom[entryOffset];
const hi = rom[entryOffset + 1];
const byteCount = rom[entryOffset + 2];
const bank = rom[entryOffset + 3];

console.log('RED sprite pointer table entry:');
console.log(`  Address: 0x${entryOffset.toString(16)}`);
console.log(`  Pointer: $${hi.toString(16).padStart(2, '0')}${lo.toString(16).padStart(2, '0')}`);
console.log(`  Byte Count: 0x${byteCount.toString(16)}`);
console.log(`  Bank: 0x${bank.toString(16)}`);

// Calculate ROM address: pointer - 0x4000 + (bank * 0x4000)
const pointer = (hi << 8) | lo;
const romAddress = pointer - 0x4000 + (bank * 0x4000);
console.log(`  ROM Address: 0x${romAddress.toString(16)}`);

// Decode a 2bpp tile (8x8 pixels)
function decodeTile(data, offset) {
  const pixels = [];
  for (let row = 0; row < 8; row++) {
    const byte1 = data[offset + row * 2];
    const byte2 = data[offset + row * 2 + 1];
    for (let col = 0; col < 8; col++) {
      const bit = 7 - col;
      const colorBit1 = (byte1 >> bit) & 1;
      const colorBit2 = (byte2 >> bit) & 1;
      const colorValue = colorBit1 | (colorBit2 << 1);
      pixels.push(colorValue);
    }
  }
  return pixels;
}

// Decode a 16x16 frame (4 tiles in 2x2 layout)
function decodeFrame(data, offset) {
  const tiles = [
    decodeTile(data, offset + 0 * 16),      // top-left
    decodeTile(data, offset + 1 * 16),      // top-right
    decodeTile(data, offset + 2 * 16),      // bottom-left
    decodeTile(data, offset + 3 * 16),      // bottom-right
  ];
  
  const frame = [];
  // Top 8 rows (tiles 0 and 1)
  for (let row = 0; row < 8; row++) {
    frame.push(...tiles[0].slice(row * 8, (row + 1) * 8)); // left
    frame.push(...tiles[1].slice(row * 8, (row + 1) * 8)); // right
  }
  // Bottom 8 rows (tiles 2 and 3)
  for (let row = 0; row < 8; row++) {
    frame.push(...tiles[2].slice(row * 8, (row + 1) * 8)); // left
    frame.push(...tiles[3].slice(row * 8, (row + 1) * 8)); // right
  }
  
  return frame;
}

// Extract 3 directional frames
const downFrame = decodeFrame(rom, romAddress + 0x00);
const upFrame = decodeFrame(rom, romAddress + 0x40);
const leftFrame = decodeFrame(rom, romAddress + 0x80);

console.log('\nDecoded frame pixel counts:');
console.log(`  Down: ${downFrame.length} pixels (should be 256 = 16x16)`);
console.log(`  Up: ${upFrame.length} pixels`);
console.log(`  Left: ${leftFrame.length} pixels`);

// Create PNG with all 3 frames side by side (48x16)
const png = new PNGConstructor({ width: 48, height: 16 });

const palette = [
  { r: 255, g: 255, b: 255 }, // 0 = white
  { r: 170, g: 170, b: 170 }, // 1 = light gray
  { r: 85, g: 85, b: 85 },    // 2 = dark gray
  { r: 0, g: 0, b: 0 }         // 3 = black
];

// Draw down frame (0-15)
for (let y = 0; y < 16; y++) {
  for (let x = 0; x < 16; x++) {
    const colorValue = downFrame[y * 16 + x];
    const color = palette[colorValue];
    const idx = (png.width * y + x) * 4;
    png.data[idx] = color.r;
    png.data[idx + 1] = color.g;
    png.data[idx + 2] = color.b;
    png.data[idx + 3] = 255;
  }
}

// Draw up frame (16-31)
for (let y = 0; y < 16; y++) {
  for (let x = 0; x < 16; x++) {
    const colorValue = upFrame[y * 16 + x];
    const color = palette[colorValue];
    const idx = (png.width * y + (x + 16)) * 4;
    png.data[idx] = color.r;
    png.data[idx + 1] = color.g;
    png.data[idx + 2] = color.b;
    png.data[idx + 3] = 255;
  }
}

// Draw left frame (32-47)
for (let y = 0; y < 16; y++) {
  for (let x = 0; x < 16; x++) {
    const colorValue = leftFrame[y * 16 + x];
    const color = palette[colorValue];
    const idx = (png.width * y + (x + 32)) * 4;
    png.data[idx] = color.r;
    png.data[idx + 1] = color.g;
    png.data[idx + 2] = color.b;
    png.data[idx + 3] = 255;
  }
}

// Save
const outputPath = './output/test-red-sprite-correct.png';
png.pack().pipe(fs.createWriteStream(outputPath));

console.log(`\nSaved test sprite to: ${outputPath}`);
console.log('This should show RED sprite facing: down, up, left');
