import struct

# Read ROM
with open('rom/Pokemon - Red Version (USA, Europe).gb', 'rb') as f:
    rom = f.read()

# We know from pret/pokered that:
# - Map 0 is Pallet Town (should be in bank 1, which is 0x01)
# - Map 1 is Viridian City (should be in bank 1)
# - Map 2 is Pewter City (should be in bank 1)
# etc.

# MapHeaderBanks should be a table of 248 bytes (0xF8) with bank IDs
# Looking for pattern: 01 01 01 01 03 01 01 01 01 01 01 (first 11 maps)
# Based on map_header_banks.asm

print("Searching for MapHeaderBanks table...")
print("Expected first 15 bytes: 01 01 01 01 03 01 01 01 01 01 01 01 01 01 01...")

# Search for this pattern
pattern = bytes([0x01, 0x01, 0x01, 0x01, 0x03, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01])

for offset in range(0, min(0x8000, len(rom) - 248)):  # Search in bank 0
    if rom[offset:offset+11] == pattern:
        print(f"\nFound potential MapHeaderBanks at offset 0x{offset:X}")
        banks = rom[offset:offset+20]
        print(f"First 20 banks: {' '.join(f'{b:02X}' for b in banks)}")
        
        # Verify it looks reasonable (should be mostly 01, 03, with some higher values)
        if all(b <= 0x40 for b in rom[offset:offset+248]):
            print("✓ All values <= 0x40 (looks valid)")
            
            # Try to find MapHeaderPointers nearby
            # It should be close by and be 248 * 2 = 496 bytes (0x1F0)
            for ptr_off in range(max(0, offset - 1000), min(offset + 1000, len(rom) - 496)):
                # Check if this could be a pointer table
                # Pointers should mostly be in range 0x4000-0x7FFF
                ptrs = [struct.unpack('<H', rom[ptr_off + i*2:ptr_off + i*2 + 2])[0] 
                        for i in range(min(20, 248))]
                valid_ptrs = sum(1 for p in ptrs if 0x4000 <= p < 0x8000)
                
                if valid_ptrs >= 15:  # At least 15 out of 20 should be in valid range
                    print(f"\nPotential MapHeaderPointers at offset 0x{ptr_off:X}")
                    print(f"First 10 pointers: {' '.join(f'{p:04X}' for p in ptrs[:10])}")
                    print(f"Valid pointers: {valid_ptrs}/20")
                    
                    # Test with map 0 (Pallet Town)
                    bank0 = rom[offset]
                    ptr0 = ptrs[0]
                    if bank0 == 0x01 and 0x4000 <= ptr0 < 0x8000:
                        test_offset = ptr0  # Bank 1 offset calculation
                        if test_offset < len(rom):
                            tileset = rom[test_offset]
                            height = rom[test_offset + 1]
                            width = rom[test_offset + 2]
                            print(f"\nTest Map 0 (Pallet Town):")
                            print(f"  Bank: 0x{bank0:02X}, Pointer: 0x{ptr0:04X}")
                            print(f"  Tileset: {tileset}, Size: {width}x{height}")
                            if 0 <= tileset < 24 and 1 <= width <= 50 and 1 <= height <= 50:
                                print(f"✓✓✓ FOUND IT! ✓✓✓")
                                print(f"MapHeaderBanks offset: 0x{offset:X}")
                                print(f"MapHeaderPointers offset: 0x{ptr_off:X}")
                                break

print("\n" + "="*60)
print("If not found, trying alternative search...")

# Alternative: Look for pointer table first
print("\nSearching for pointer tables with many 0x4xxx values...")
for offset in range(0, min(0x8000, len(rom) - 496), 2):
    ptrs = [struct.unpack('<H', rom[offset + i*2:offset + i*2 + 2])[0] 
            for i in range(20)]
    valid_ptrs = sum(1 for p in ptrs if 0x4000 <= p < 0x8000)
    
    if valid_ptrs >= 18:  # Very high confidence
        print(f"\nHighly likely MapHeaderPointers at 0x{offset:X}")
        print(f"First 10: {' '.join(f'{p:04X}' for p in ptrs[:10])}")
        break
