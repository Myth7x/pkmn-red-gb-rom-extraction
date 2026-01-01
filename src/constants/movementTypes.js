// Movement constants from pret/pokered
// These constants define NPC movement patterns in Pokemon Red

// Movement byte 1 (type)
const WALK = 0xFE;
const STAY = 0xFF;
// 0x00-0xFD are scripted movement indices

// Movement byte 2 (direction/range for WALK, facing direction for STAY)
const ANY_DIR = 0x00;
const UP_DOWN = 0x01;
const LEFT_RIGHT = 0x02;

// Facing directions (for STAY movement)
const DOWN = 0xD0;
const UP = 0xD1;
const LEFT = 0xD2;
const RIGHT = 0xD3;
const NONE = 0xFF;

/**
 * Decode movement byte 1 to human-readable type
 * @param {number} movementByte - The movement byte (0x00-0xFF)
 * @returns {string} Movement type description
 */
function decodeMovementType(movementByte) {
  if (movementByte === STAY) {
    return 'STAY';
  } else if (movementByte === WALK) {
    return 'WALK';
  } else {
    return 'scripted';
  }
}

/**
 * Decode movement byte 2 (range/direction)
 * @param {number} movementType - The decoded movement type from byte 1
 * @param {number} rangeByte - The range/direction byte
 * @returns {string} Direction/range description
 */
function decodeMovementDirection(movementType, rangeByte) {
  if (movementType === 'WALK') {
    // For WALK movement, byte 2 is the pattern
    switch (rangeByte) {
      case ANY_DIR:
        return 'ANY_DIR';
      case UP_DOWN:
        return 'UP_DOWN';
      case LEFT_RIGHT:
        return 'LEFT_RIGHT';
      default:
        return `unknown_pattern_0x${rangeByte.toString(16).toUpperCase()}`;
    }
  } else if (movementType === 'STAY') {
    // For STAY movement, byte 2 is the facing direction
    switch (rangeByte) {
      case DOWN:
        return 'DOWN';
      case UP:
        return 'UP';
      case LEFT:
        return 'LEFT';
      case RIGHT:
        return 'RIGHT';
      case NONE:
        return 'NONE';
      default:
        return `unknown_facing_0x${rangeByte.toString(16).toUpperCase()}`;
    }
  } else {
    // For scripted movement, byte 2 is not used consistently
    return `0x${rangeByte.toString(16).toUpperCase()}`;
  }
}

/**
 * Get a human-readable description of the movement pattern
 * @param {number} movementByte - Movement byte 1
 * @param {number} rangeByte - Movement byte 2
 * @returns {string} Full movement description
 */
function getMovementDescription(movementByte, rangeByte) {
  const type = decodeMovementType(movementByte);
  const direction = decodeMovementDirection(type, rangeByte);
  
  switch (`${type}_${direction}`) {
    case 'STAY_DOWN':
      return 'standing still, facing down';
    case 'STAY_UP':
      return 'standing still, facing up';
    case 'STAY_LEFT':
      return 'standing still, facing left';
    case 'STAY_RIGHT':
      return 'standing still, facing right';
    case 'STAY_NONE':
      return 'standing still';
    case 'WALK_ANY_DIR':
      return 'walking randomly (all directions)';
    case 'WALK_UP_DOWN':
      return 'pacing vertically';
    case 'WALK_LEFT_RIGHT':
      return 'pacing horizontally';
    case 'scripted_0x00':
      return 'scripted movement';
    default:
      if (type === 'scripted') {
        return `scripted movement (script index ${movementByte})`;
      }
      return `${type}, ${direction}`;
  }
}

export {
  // Constants
  WALK,
  STAY,
  ANY_DIR,
  UP_DOWN,
  LEFT_RIGHT,
  DOWN,
  UP,
  LEFT,
  RIGHT,
  NONE,
  
  // Functions
  decodeMovementType,
  decodeMovementDirection,
  getMovementDescription
};
