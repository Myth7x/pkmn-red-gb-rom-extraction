/**
 * NPC Movement Type Constants
 * Based on pret/pokered home/overworld.asm
 */

export const MOVEMENT_TYPES = {
    // STAY movements (standing still)
    0xFF: { name: 'STAY', category: 'STAY', pattern: 'STAY', description: 'Stand still facing down' },
    0x00: { name: 'STAY DOWN', category: 'STAY', pattern: 'STAY', description: 'Stand still facing down' },
    0x01: { name: 'STAY UP', category: 'STAY', pattern: 'STAY', description: 'Stand still facing up' },
    0x02: { name: 'STAY LEFT', category: 'STAY', pattern: 'STAY', description: 'Stand still facing left' },
    0x03: { name: 'STAY RIGHT', category: 'STAY', pattern: 'STAY', description: 'Stand still facing right' },
    
    // WALK movements
    0xFE: { name: 'WALK', category: 'WALK', pattern: 'ANY_DIR', description: 'Walk randomly in any direction' },
    0xD0: { name: 'WALK LEFT RIGHT', category: 'WALK', pattern: 'LEFT_RIGHT', description: 'Walk left and right' },
    0xD1: { name: 'WALK UP DOWN', category: 'WALK', pattern: 'UP_DOWN', description: 'Walk up and down' },
    0xD2: { name: 'WALK ANY DIR', category: 'WALK', pattern: 'ANY_DIR', description: 'Walk in any direction' },
    
    // LOOK movements (turn to look but don't walk)
    0xD3: { name: 'LOOK AROUND', category: 'STAY', pattern: 'LOOK_AROUND', description: 'Look around randomly' },
    
    // Directional walks
    0x04: { name: 'WALK DOWN', category: 'WALK', pattern: 'DOWN', description: 'Walk down continuously' },
    0x05: { name: 'WALK UP', category: 'WALK', pattern: 'UP', description: 'Walk up continuously' },
    0x06: { name: 'WALK LEFT', category: 'WALK', pattern: 'LEFT', description: 'Walk left continuously' },
    0x07: { name: 'WALK RIGHT', category: 'WALK', pattern: 'RIGHT', description: 'Walk right continuously' },
};

/**
 * Get movement type info for a movement byte
 */
export function getMovementType(movementByte) {
    return MOVEMENT_TYPES[movementByte] || { 
        name: 'NONE', 
        category: 'NONE', 
        pattern: 'NONE',
        description: `Unknown movement type: 0x${movementByte.toString(16).toUpperCase()}` 
    };
}

/**
 * Check if movement type involves walking
 */
export function isWalkingMovement(movementByte) {
    const type = MOVEMENT_TYPES[movementByte];
    return type && type.category === 'WALK';
}

/**
 * Check if movement type is stationary
 */
export function isStayMovement(movementByte) {
    const type = MOVEMENT_TYPES[movementByte];
    return type && type.category === 'STAY';
}
