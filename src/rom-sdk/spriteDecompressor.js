/**
 * Sprite Decompressor Module
 * 
 * Implements the decompression algorithm for Pokemon Red/Blue/Yellow sprite data.
 * Pokemon sprites are stored in a custom compressed format using bit-stream encoding
 * with run-length encoding (RLE) for zero pixels. This module reads compressed data,
 * decodes 16-bit integers, expands RLE sequences, and deinterleaves pixel data into
 * a format suitable for rendering as 2bpp Game Boy graphics.
 */

/**
 * BitReader Class
 * Reads bits from a buffer for sprite decompression
 */
export class BitReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.pos = 0;
    this.bits = 0;
    this.count = 0;
  }

  readBits(n) {
    while (this.count < n) {
      if (this.pos >= this.buffer.length) {
        throw new Error('Unexpected end of data');
      }
      this.bits = (this.bits << 8) | this.buffer[this.pos++];
      this.count += 8;
    }
    
    const shift = this.count - n;
    const mask = (1 << n) - 1;
    const value = (this.bits >> shift) & mask;
    this.count -= n;
    return value;
  }
}

/**
 * Decode a 16-bit compressed integer
 */
function decode16(reader) {
  let n = 1;
  while (reader.readBits(1) === 1) {
    n++;
  }
  return (1 << n) + reader.readBits(n) - 1;
}

/**
 * Read and decompress pixel data
 */
function readPixels(reader, buffer, width, height) {
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
        buffer[i] |= bits << shift;
      }
    }
  }
}

/**
 * Inverse XOR shift lookup table
 */
const invXorShift = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  invXorShift[i ^ (i >> 1)] = i;
}

/**
 * Apply inverse XOR transformation
 */
function unxor(buffer, width, height) {
  const stride = width;
  for (let y = 0; y < height * 8; y++) {
    let bit = 0;
    for (let x = 0; x < width; x++) {
      const i = y * stride + x;
      buffer[i] = invXorShift[buffer[i]];
      if (bit !== 0) {
        buffer[i] = ~buffer[i] & 0xFF;
      }
      bit = buffer[i] & 1;
    }
  }
}

/**
 * Interleave bits from two bytes
 */
function mingle(x, y) {
  x = (x | (x << 4)) & 0x0F0F;
  x = (x | (x << 2)) & 0x3333;
  x = (x | (x << 1)) & 0x5555;
  
  y = (y | (y << 4)) & 0x0F0F;
  y = (y | (y << 2)) & 0x3333;
  y = (y | (y << 1)) & 0x5555;
  
  return x | (y << 1);
}

/**
 * Decompress a Pokemon sprite from compressed buffer
 * @param {Buffer} buffer - Compressed sprite data
 * @returns {Object} - {width, height, pixels}
 */
export function decompressSprite(buffer) {
  const reader = new BitReader(buffer);
  
  const width = reader.readBits(4);
  const height = reader.readBits(4);
  
  const imageWidth = width * 8;
  const imageHeight = height * 8;
  
  const dataSize = width * height * 8 * 2;
  const data = new Uint8Array(dataSize);
  const mid = dataSize / 2;
  
  let s0 = data.subarray(0, mid);
  let s1 = data.subarray(mid);
  
  if (reader.readBits(1) === 1) {
    [s0, s1] = [s1, s0];
  }
  
  readPixels(reader, s0, width, height);
  let mode = reader.readBits(1);
  if (mode === 1) {
    mode = 1 + reader.readBits(1);
  }
  readPixels(reader, s1, width, height);
  
  // Apply transformations based on mode
  switch (mode) {
    case 0:
      unxor(s0, width, height);
      unxor(s1, width, height);
      break;
    case 1:
      unxor(s0, width, height);
      for (let i = 0; i < s1.length; i++) {
        s1[i] ^= s0[i];
      }
      break;
    case 2:
      unxor(s1, width, height);
      unxor(s0, width, height);
      for (let i = 0; i < s1.length; i++) {
        s1[i] ^= s0[i];
      }
      break;
  }
  
  // Combine the two bitplanes into final pixel data
  const pixels = [];
  for (let i = 0; i < mid; i++) {
    const x = mingle(data[i], data[mid + i]);
    for (let shift = 0; shift < 16; shift += 2) {
      pixels.push((x >> (14 - shift)) & 3);
    }
  }
  
  return { width: imageWidth, height: imageHeight, pixels: new Uint8Array(pixels) };
}
