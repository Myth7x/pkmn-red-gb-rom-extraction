// Sprite constants from pret/pokered
// These constants define sprite facing directions and animation frames

/**
 * Sprite facing direction constants
 * From constants/sprite_data_constants.asm
 */
export const SPRITE_FACING = {
  DOWN: 0x00,  // 0
  UP: 0x04,    // 4
  LEFT: 0x08,  // 8
  RIGHT: 0x0C  // 12
};

/**
 * Get facing direction name
 * @param {number} facing - Facing direction value (0, 4, 8, or 12)
 * @returns {string} Direction name
 */
export function getFacingDirectionName(facing) {
  switch (facing) {
    case SPRITE_FACING.DOWN:
      return 'DOWN';
    case SPRITE_FACING.UP:
      return 'UP';
    case SPRITE_FACING.LEFT:
      return 'LEFT';
    case SPRITE_FACING.RIGHT:
      return 'RIGHT';
    default:
      return `UNKNOWN_0x${facing.toString(16).toUpperCase()}`;
  }
}

/**
 * Get sprite frame offset based on facing direction
 * In Pokemon Red, sprites have 4 tiles arranged as:
 * - 2x2 grid (4 tiles total)
 * - Different tile sets for each facing direction
 * 
 * @param {number} facing - Facing direction (0, 4, 8, or 12)
 * @param {number} animFrame - Animation frame (0-3), 0 for standing still
 * @returns {number} Frame offset for sprite sheet
 */
export function getSpriteFrameOffset(facing, animFrame = 0) {
  // Each facing direction has 4 animation frames
  // Frame 0 = standing still
  // Frames 1-3 = walking animation
  
  switch (facing) {
    case SPRITE_FACING.DOWN:
      return animFrame; // 0, 1, 2, 3
    case SPRITE_FACING.UP:
      return 4 + animFrame; // 4, 5, 6, 7
    case SPRITE_FACING.LEFT:
      return 8 + animFrame; // 8, 9, 10, 11
    case SPRITE_FACING.RIGHT:
      // Right uses left tiles with horizontal flip
      return 8 + animFrame; // 8, 9, 10, 11 (flipped)
    default:
      return 0;
  }
}

/**
 * Check if sprite should be horizontally flipped
 * @param {number} facing - Facing direction
 * @returns {boolean} True if sprite should be flipped
 */
export function shouldFlipSprite(facing) {
  return facing === SPRITE_FACING.RIGHT;
}

/**
 * Get sprite row in spritesheet
 * Pokemon Red sprites are arranged in rows:
 * - Row 0: Down facing (frames 0-3)
 * - Row 1: Up facing (frames 0-3)
 * - Row 2: Left facing (frames 0-3)
 * - Row 3: Right facing (same as left, flipped)
 * 
 * @param {number} facing - Facing direction
 * @returns {number} Row index (0-2)
 */
export function getSpriteRow(facing) {
  switch (facing) {
    case SPRITE_FACING.DOWN:
      return 0;
    case SPRITE_FACING.UP:
      return 1;
    case SPRITE_FACING.LEFT:
    case SPRITE_FACING.RIGHT:
      return 2;
    default:
      return 0;
  }
}

/**
 * Get sprite column in spritesheet (for given animation frame)
 * @param {number} animFrame - Animation frame (0-3)
 * @returns {number} Column index
 */
export function getSpriteColumn(animFrame = 0) {
  return animFrame % 4;
}

/**
 * Animation frame constants
 */
export const ANIM_FRAME = {
  STAND: 0,      // Standing still
  WALK_1: 1,     // First walking frame
  WALK_2: 2,     // Second walking frame  
  WALK_3: 3      // Third walking frame
};

/**
 * Movement status constants
 * From constants/map_object_constants.asm
 */
export const MOVEMENT_STATUS = {
  WALK: 0xFE,
  STAY: 0xFF
};

/**
 * Movement direction patterns
 */
export const MOVEMENT_PATTERN = {
  ANY_DIR: 0x00,     // Walk randomly in all directions
  UP_DOWN: 0x01,     // Pace vertically
  LEFT_RIGHT: 0x02   // Pace horizontally
};

export default {
  SPRITE_FACING,
  MOVEMENT_STATUS,
  MOVEMENT_PATTERN,
  ANIM_FRAME,
  getFacingDirectionName,
  getSpriteFrameOffset,
  shouldFlipSprite,
  getSpriteRow,
  getSpriteColumn
};
