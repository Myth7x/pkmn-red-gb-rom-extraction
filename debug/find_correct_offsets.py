import struct

# Read ROM
with open('rom/Pokemon - Red Version (USA, Europe).gb', 'rb') as f:
    rom = f.read()

# Found MapHeaderPointers at 0x1AA
# MapHeaderBanks should be nearby (usually before it)
# Banks is 248 bytes (0xF8), Pointers is 496 bytes (0x1F0)

MAP_HEADER_POINTERS_OFFSET = 0x1AA
print(f"MapHeaderPointers found at: 0x{MAP_HEADER_POINTERS_OFFSET:X}")

# Banks table should be 0xF8 bytes before pointers table, or nearby
# Let's check offsets around 0x1AA - 0xF8 = 0xB2

for banks_offset in range(0x50, 0x150):
    banks = rom[banks_offset:banks_offset + 20]
    
    # Check if this looks like bank IDs (should be mostly 0x01, 0x03, some higher values)
    # Valid bank range is 0x01-0x40 typically
    if all(0x01 <= b <= 0x40 or b == 0x01 for b in banks if b != 0):
        # Check specific known values from pret/pokered
        # Map 4 (Lavender Town) should be bank 0x03
        if banks_offset + 4 < len(rom) and rom[banks_offset + 4] == 0x03:
            print(f"\nPotential MapHeaderBanks at: 0x{banks_offset:X}")
            print(f"First 20 banks: {' '.join(f'{b:02X}' for b in banks)}")
            
            # Test with known maps
            pointers_offset = MAP_HEADER_POINTERS_OFFSET
            ptrs = [struct.unpack('<H', rom[pointers_offset + i*2:pointers_offset + i*2 + 2])[0] 
                    for i in range(11)]
            
            print(f"First 11 pointers: {' '.join(f'{p:04X}' for p in ptrs)}")
            
            # Test maps 0-10 (towns/cities)
            map_names = [
                "Pallet Town", "Viridian City", "Pewter City", "Cerulean City",
                "Lavender Town", "Vermilion City", "Celadon City", "Fuchsia City",
                "Cinnabar Island", "Indigo Plateau", "Saffron City"
            ]
            
            print("\nTesting town/city maps:")
            valid_count = 0
            for i in range(11):
                bank = rom[banks_offset + i]
                ptr = struct.unpack('<H', rom[pointers_offset + i*2:pointers_offset + i*2 + 2])[0]
                
                # Calculate ROM offset
                if 0x4000 <= ptr < 0x8000:
                    offset = (bank - 1) * 0x4000 + ptr
                elif ptr < 0x4000:
                    offset = ptr
                else:
                    continue
                
                if offset >= len(rom):
                    continue
                
                tileset = rom[offset]
                height = rom[offset + 1]
                width = rom[offset + 2]
                
                # Validate: tileset should be 0-23, dimensions should be reasonable
                if 0 <= tileset < 24 and 1 <= width <= 60 and 1 <= height <= 100:
                    valid_count += 1
                    print(f"  ✓ {i:2d}: {map_names[i]:20s} Bank={bank:02X} Ptr={ptr:04X} Tileset={tileset:2d} Size={width:2d}x{height:2d}")
                else:
                    print(f"  ✗ {i:2d}: {map_names[i]:20s} INVALID (tileset={tileset}, size={width}x{height})")
            
            if valid_count >= 8:
                print(f"\n✓✓✓ FOUND VALID TABLES! ✓✓✓")
                print(f"MapHeaderBanks offset: 0x{banks_offset:X}")
                print(f"MapHeaderPointers offset: 0x{pointers_offset:X}")
                
                # Test all 248 maps
                print(f"\nTesting all {248} maps...")
                valid_maps = 0
                for map_id in range(248):
                    bank = rom[banks_offset + map_id]
                    ptr = struct.unpack('<H', rom[pointers_offset + map_id*2:pointers_offset + map_id*2 + 2])[0]
                    
                    if 0x4000 <= ptr < 0x8000:
                        offset = (bank - 1) * 0x4000 + ptr
                    elif ptr < 0x4000:
                        offset = ptr
                    else:
                        continue
                    
                    if offset >= len(rom):
                        continue
                    
                    tileset = rom[offset]
                    height = rom[offset + 1]
                    width = rom[offset + 2]
                    
                    if 0 <= tileset < 24 and 1 <= width <= 60 and 1 <= height <= 100:
                        valid_maps += 1
                
                print(f"Valid maps: {valid_maps}/248 ({valid_maps/248*100:.1f}%)")
                break
