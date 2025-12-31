/**
 * ROM Version Checker
 * 
 * Checks and displays ROM information including:
 * - Title
 * - Version
 * - Region
 * - Checksum
 * - ROM size
 * - Cartridge type
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROM_PATH = path.join(__dirname, '..', 'rom', 'Pokemon - Red Version (USA, Europe).gb');

// ROM header offsets
const OFFSETS = {
  TITLE: 0x134,           // Game title (16 bytes)
  CARTRIDGE_TYPE: 0x147,  // Cartridge type
  ROM_SIZE: 0x148,        // ROM size indicator
  RAM_SIZE: 0x149,        // RAM size indicator
  REGION: 0x14A,          // Region code
  VERSION: 0x14C,         // Version number
  HEADER_CHECKSUM: 0x14D, // Header checksum
  GLOBAL_CHECKSUM: 0x14E  // Global checksum (2 bytes)
};

// Cartridge type mapping
const CARTRIDGE_TYPES = {
  0x00: 'ROM ONLY',
  0x01: 'MBC1',
  0x02: 'MBC1+RAM',
  0x03: 'MBC1+RAM+BATTERY',
  0x05: 'MBC2',
  0x06: 'MBC2+BATTERY',
  0x08: 'ROM+RAM',
  0x09: 'ROM+RAM+BATTERY',
  0x0B: 'MMM01',
  0x0C: 'MMM01+RAM',
  0x0D: 'MMM01+RAM+BATTERY',
  0x0F: 'MBC3+TIMER+BATTERY',
  0x10: 'MBC3+TIMER+RAM+BATTERY',
  0x11: 'MBC3',
  0x12: 'MBC3+RAM',
  0x13: 'MBC3+RAM+BATTERY',
  0x19: 'MBC5',
  0x1A: 'MBC5+RAM',
  0x1B: 'MBC5+RAM+BATTERY',
  0x1C: 'MBC5+RUMBLE',
  0x1D: 'MBC5+RUMBLE+RAM',
  0x1E: 'MBC5+RUMBLE+RAM+BATTERY'
};

// Region mapping
const REGIONS = {
  0x00: 'Japanese',
  0x01: 'Non-Japanese'
};

/**
 * Calculate ROM size from size code
 */
function getROMSize(sizeCode) {
  const banks = 2 << sizeCode; // 2^(code+1)
  const kb = banks * 16;
  const mb = kb / 1024;
  return { banks, kb, mb };
}

/**
 * Calculate RAM size from size code
 */
function getRAMSize(sizeCode) {
  const sizes = {
    0x00: { kb: 0, description: 'No RAM' },
    0x01: { kb: 2, description: '2 KB (1 bank)' },
    0x02: { kb: 8, description: '8 KB (1 bank)' },
    0x03: { kb: 32, description: '32 KB (4 banks)' },
    0x04: { kb: 128, description: '128 KB (16 banks)' },
    0x05: { kb: 64, description: '64 KB (8 banks)' }
  };
  return sizes[sizeCode] || { kb: 0, description: 'Unknown' };
}

/**
 * Verify header checksum
 */
function verifyHeaderChecksum(rom) {
  let checksum = 0;
  for (let i = 0x134; i <= 0x14C; i++) {
    checksum = checksum - rom[i] - 1;
  }
  checksum = checksum & 0xFF;
  const storedChecksum = rom[OFFSETS.HEADER_CHECKSUM];
  return { calculated: checksum, stored: storedChecksum, valid: checksum === storedChecksum };
}

/**
 * Verify global checksum
 */
function verifyGlobalChecksum(rom) {
  let checksum = 0;
  for (let i = 0; i < rom.length; i++) {
    if (i !== OFFSETS.GLOBAL_CHECKSUM && i !== OFFSETS.GLOBAL_CHECKSUM + 1) {
      checksum = (checksum + rom[i]) & 0xFFFF;
    }
  }
  const storedChecksum = (rom[OFFSETS.GLOBAL_CHECKSUM] << 8) | rom[OFFSETS.GLOBAL_CHECKSUM + 1];
  return { calculated: checksum, stored: storedChecksum, valid: checksum === storedChecksum };
}

/**
 * Extract ROM information
 */
function checkROMVersion() {
  console.log('============================================================');
  console.log('Pokemon Red ROM Information');
  console.log('============================================================\n');

  // Check if ROM exists
  if (!fs.existsSync(ROM_PATH)) {
    console.error('[ERROR] ROM file not found at:', ROM_PATH);
    process.exit(1);
  }

  // Load ROM
  const rom = fs.readFileSync(ROM_PATH);
  console.log(`ROM loaded: ${rom.length} bytes (${(rom.length / 1024 / 1024).toFixed(2)} MB)\n`);

  // Extract title
  let title = '';
  for (let i = OFFSETS.TITLE; i < OFFSETS.TITLE + 16; i++) {
    const char = rom[i];
    if (char === 0) break;
    title += String.fromCharCode(char);
  }

  // Extract other info
  const cartridgeType = rom[OFFSETS.CARTRIDGE_TYPE];
  const romSizeCode = rom[OFFSETS.ROM_SIZE];
  const ramSizeCode = rom[OFFSETS.RAM_SIZE];
  const regionCode = rom[OFFSETS.REGION];
  const version = rom[OFFSETS.VERSION];

  const romSize = getROMSize(romSizeCode);
  const ramSize = getRAMSize(ramSizeCode);
  const headerCheck = verifyHeaderChecksum(rom);
  const globalCheck = verifyGlobalChecksum(rom);

  // Display information
  console.log('--- Basic Information ---');
  console.log(`Title:           ${title}`);
  console.log(`Version:         ${version}`);
  console.log(`Region:          ${REGIONS[regionCode] || 'Unknown'} (0x${regionCode.toString(16).toUpperCase()})`);
  console.log();

  console.log('--- Cartridge Information ---');
  console.log(`Type:            ${CARTRIDGE_TYPES[cartridgeType] || 'Unknown'} (0x${cartridgeType.toString(16).toUpperCase()})`);
  console.log(`ROM Size:        ${romSize.kb} KB (${romSize.mb.toFixed(2)} MB) - ${romSize.banks} banks`);
  console.log(`RAM Size:        ${ramSize.description}`);
  console.log();

  console.log('--- Checksums ---');
  console.log(`Header Checksum: 0x${headerCheck.stored.toString(16).toUpperCase().padStart(2, '0')}`);
  console.log(`  Calculated:    0x${headerCheck.calculated.toString(16).toUpperCase().padStart(2, '0')}`);
  console.log(`  Status:        ${headerCheck.valid ? '[OK] Valid' : '[ERROR] Invalid'}`);
  console.log();
  console.log(`Global Checksum: 0x${globalCheck.stored.toString(16).toUpperCase().padStart(4, '0')}`);
  console.log(`  Calculated:    0x${globalCheck.calculated.toString(16).toUpperCase().padStart(4, '0')}`);
  console.log(`  Status:        ${globalCheck.valid ? '[OK] Valid' : '[ERROR] Invalid'}`);
  console.log();

  // ROM identification
  console.log('--- ROM Identification ---');
  if (title.includes('POKEMON RED')) {
    console.log('[OK] This is a Pokemon Red ROM');
    if (regionCode === 0x01) {
      console.log('[OK] USA/Europe version detected');
    }
  } else {
    console.log('[WARNING] Unexpected ROM title');
  }
  
  if (headerCheck.valid) {
    console.log('[OK] Header checksum valid - ROM header is intact');
  } else {
    console.log('[WARNING] Header checksum invalid - ROM may be corrupted or modified');
  }

  console.log('\n============================================================');
}

// Run the check
checkROMVersion();
