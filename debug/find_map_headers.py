import struct

# Read ROM
with open('rom/Pokemon - Red Version (USA, Europe).gb', 'rb') as f:
    rom = f.read()

# Known offsets from pret/pokered disassembly
# MapHeaderBanks should be at 0x0182 in ROM
# MapHeaderPointers should be at 0x01CE in ROM
# These are the addresses after adjusting for ROM bank 0

MAP_HEADER_BANKS_OFFSET = 0x0182
MAP_HEADER_POINTERS_OFFSET = 0x01CE
NUM_MAPS = 248

print("=== Map Header Banks (first 20) ===")
banks = [rom[MAP_HEADER_BANKS_OFFSET + i] for i in range(20)]
print([f"0x{b:02X}" for b in banks])

print("\n=== Map Header Pointers (first 20) ===")
pointers = [struct.unpack('<H', rom[MAP_HEADER_POINTERS_OFFSET + i*2:MAP_HEADER_POINTERS_OFFSET + i*2+2])[0] 
            for i in range(20)]
print([f"0x{p:04X}" for p in pointers])

# Try to read Pallet Town (map 0)
print("\n=== Pallet Town (Map 0) ===")
print(f"Bank: 0x{banks[0]:02X}")
print(f"Pointer: 0x{pointers[0]:04X}")

# Calculate ROM offset for Pallet Town
def bank_pointer_to_offset(bank, pointer):
    if pointer >= 0x4000 and pointer < 0x8000:
        return (bank - 1) * 0x4000 + pointer
    elif pointer < 0x4000:
        return pointer
    else:
        return None

pallet_offset = bank_pointer_to_offset(banks[0], pointers[0])
if pallet_offset:
    print(f"ROM Offset: 0x{pallet_offset:X}")
    print(f"Header data: {rom[pallet_offset:pallet_offset+15].hex()}")
    
    # Parse Pallet Town header
    tileset = rom[pallet_offset]
    height = rom[pallet_offset + 1]
    width = rom[pallet_offset + 2]
    blocks_ptr = struct.unpack('<H', rom[pallet_offset + 3:pallet_offset + 5])[0]
    
    print(f"\nPallet Town Details:")
    print(f"  Tileset: {tileset}")
    print(f"  Height: {height} blocks")
    print(f"  Width: {width} blocks")
    print(f"  Blocks Pointer: 0x{blocks_ptr:04X}")

print("\n=== All Town/City Maps (0-10) ===")
map_names = [
    "Pallet Town", "Viridian City", "Pewter City", "Cerulean City",
    "Lavender Town", "Vermilion City", "Celadon City", "Fuchsia City",
    "Cinnabar Island", "Indigo Plateau", "Saffron City"
]

for i in range(11):
    bank = rom[MAP_HEADER_BANKS_OFFSET + i]
    pointer = struct.unpack('<H', rom[MAP_HEADER_POINTERS_OFFSET + i*2:MAP_HEADER_POINTERS_OFFSET + i*2+2])[0]
    offset = bank_pointer_to_offset(bank, pointer)
    
    if offset and offset < len(rom):
        tileset = rom[offset]
        height = rom[offset + 1]
        width = rom[offset + 2]
        print(f"{i:3d}: {map_names[i]:20s} Bank=0x{bank:02X} Ptr=0x{pointer:04X} Off=0x{offset:X} Tileset={tileset} Size={width}x{height}")
    else:
        print(f"{i:3d}: {map_names[i]:20s} INVALID OFFSET")
