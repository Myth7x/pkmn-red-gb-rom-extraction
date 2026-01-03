/**
 * Tile Metadata Analyzer
 * 
 * Analyzes map tiles and provides metadata about:
 * - Collision/movement permissions
 * - Grass tiles (encounter zones)
 * - Warp tiles
 * - Water tiles (surfable areas)
 * - Ledges and special tiles
 */

import { getTileCollisionInfo, isTilePassable } from './tilesetBlockReader.js';

/**
 * Analyze tile metadata for a map
 * @param {Object} mapData - Map data with blockData and tilesetInfo
 * @param {Object} tilesetData - Complete tileset data with collision info
 * @returns {Object} - Tile metadata analysis
 */
export function analyzeTileMetadata(mapData, tilesetData) {
  if (!mapData.blockData || mapData.blockData.length === 0) {
    return null;
  }

  const analysis = {
    totalTiles: mapData.blockData.length,
    tilesByType: {},
    grassTiles: [],
    warpTiles: [],
    waterTiles: [],
    ledgeTiles: [],
    wallTiles: [],
    passableTiles: [],
    encounterZones: [],
    surfableAreas: []
  };

  // Get collision data for the tileset
  const tileset = tilesetData.tilesets.find(t => t.tilesetId === mapData.tileset);
  if (!tileset || !tileset.passableTiles || !tileset.blocks) {
    return analysis;
  }

  // Analyze each block in the map
  // Note: Each block is 4x4 tiles, so we analyze at block level for now
  for (let i = 0; i < mapData.blockData.length; i++) {
    const blockId = mapData.blockData[i];
    const block = tileset.blocks[blockId];
    
    if (!block) continue;

    const x = i % mapData.width;
    const y = Math.floor(i / mapData.width);
    
    // Analyze the tiles within this block (4x4)
    for (let tileRow = 0; tileRow < 4; tileRow++) {
      for (let tileCol = 0; tileCol < 4; tileCol++) {
        const tileId = block.tiles[tileRow][tileCol];
        const tileInfo = getTileCollisionInfo(tileId, tileset);
        
        const tileData = {
          index: i,
          blockX: x,
          blockY: y,
          tileRow: tileRow,
          tileCol: tileCol,
          blockId: blockId,
          tileId: tileId,
          collisionType: tileInfo.type
        };

        // Categorize tile
        const typeKey = tileInfo.type;
        if (!analysis.tilesByType[typeKey]) {
          analysis.tilesByType[typeKey] = 0;
        }
        analysis.tilesByType[typeKey]++;

        // Add to specific lists
        if (typeKey.includes('GRASS')) {
          analysis.grassTiles.push(tileData);
        } else if (typeKey.includes('WARP')) {
          analysis.warpTiles.push(tileData);
        } else if (typeKey.includes('WATER') && !typeKey.includes('BLOCK')) {
          analysis.waterTiles.push(tileData);
        } else if (typeKey.includes('LEDGE')) {
          analysis.ledgeTiles.push(tileData);
        } else if (typeKey.includes('WALL') || typeKey === 'WALL') {
          analysis.wallTiles.push(tileData);
        } else if (typeKey === 'PASSABLE') {
          analysis.passableTiles.push(tileData);
        }
      }
    }
  }

  // Detect grass encounter zones (clusters of grass tiles)
  analysis.encounterZones = detectGrassZones(analysis.grassTiles, mapData.width);

  // Detect surfable areas (clusters of water tiles)
  analysis.surfableAreas = detectWaterAreas(analysis.waterTiles, mapData.width);

  return analysis;
}

/**
 * Detect grass encounter zones (contiguous grass areas)
 * @param {Array} grassTiles - Array of grass tile info
 * @param {number} mapWidth - Map width in tiles
 * @returns {Array} - Array of grass zone regions
 */
function detectGrassZones(grassTiles, mapWidth) {
  if (grassTiles.length === 0) return [];

  const zones = [];
  const visited = new Set();

  for (const tile of grassTiles) {
    if (visited.has(tile.index)) continue;

    // BFS to find connected grass tiles
    const zone = [];
    const queue = [tile];
    visited.add(tile.index);

    while (queue.length > 0) {
      const current = queue.shift();
      zone.push(current);

      // Check neighbors (up, down, left, right)
      const neighbors = [
        grassTiles.find(t => t.x === current.x && t.y === current.y - 1),
        grassTiles.find(t => t.x === current.x && t.y === current.y + 1),
        grassTiles.find(t => t.x === current.x - 1 && t.y === current.y),
        grassTiles.find(t => t.x === current.x + 1 && t.y === current.y)
      ];

      for (const neighbor of neighbors) {
        if (neighbor && !visited.has(neighbor.index)) {
          visited.add(neighbor.index);
          queue.push(neighbor);
        }
      }
    }

    if (zone.length > 0) {
      zones.push({
        tileCount: zone.length,
        minX: Math.min(...zone.map(t => t.x)),
        maxX: Math.max(...zone.map(t => t.x)),
        minY: Math.min(...zone.map(t => t.y)),
        maxY: Math.max(...zone.map(t => t.y)),
        tiles: zone.map(t => ({ x: t.x, y: t.y, blockId: t.blockId }))
      });
    }
  }

  return zones;
}

/**
 * Detect water/surfable areas (contiguous water tiles)
 * @param {Array} waterTiles - Array of water tile info
 * @param {number} mapWidth - Map width in tiles
 * @returns {Array} - Array of water area regions
 */
function detectWaterAreas(waterTiles, mapWidth) {
  if (waterTiles.length === 0) return [];

  const areas = [];
  const visited = new Set();

  for (const tile of waterTiles) {
    if (visited.has(tile.index)) continue;

    // BFS to find connected water tiles
    const area = [];
    const queue = [tile];
    visited.add(tile.index);

    while (queue.length > 0) {
      const current = queue.shift();
      area.push(current);

      // Check neighbors (up, down, left, right)
      const neighbors = [
        waterTiles.find(t => t.x === current.x && t.y === current.y - 1),
        waterTiles.find(t => t.x === current.x && t.y === current.y + 1),
        waterTiles.find(t => t.x === current.x - 1 && t.y === current.y),
        waterTiles.find(t => t.x === current.x + 1 && t.y === current.y)
      ];

      for (const neighbor of neighbors) {
        if (neighbor && !visited.has(neighbor.index)) {
          visited.add(neighbor.index);
          queue.push(neighbor);
        }
      }
    }

    if (area.length > 0) {
      areas.push({
        tileCount: area.length,
        minX: Math.min(...area.map(t => t.x)),
        maxX: Math.max(...area.map(t => t.x)),
        minY: Math.min(...area.map(t => t.y)),
        maxY: Math.max(...area.map(t => t.y)),
        tiles: area.map(t => ({ x: t.x, y: t.y, blockId: t.blockId }))
      });
    }
  }

  return areas;
}

/**
 * Generate tile metadata summary for display
 * @param {Object} metadata - Tile metadata analysis
 * @returns {Object} - Summary statistics
 */
export function generateMetadataSummary(metadata) {
  if (!metadata) {
    return {
      totalTiles: 0,
      hasGrass: false,
      hasWater: false,
      hasWarps: false,
      typeCount: 0
    };
  }

  return {
    totalTiles: metadata.totalTiles,
    hasGrass: metadata.grassTiles.length > 0,
    hasWater: metadata.waterTiles.length > 0,
    hasWarps: metadata.warpTiles.length > 0,
    hasLedges: metadata.ledgeTiles.length > 0,
    encounterZoneCount: metadata.encounterZones.length,
    surfableAreaCount: metadata.surfableAreas.length,
    typeCount: Object.keys(metadata.tilesByType).length,
    typeBreakdown: metadata.tilesByType,
    grassCoverage: ((metadata.grassTiles.length / metadata.totalTiles) * 100).toFixed(2) + '%',
    waterCoverage: ((metadata.waterTiles.length / metadata.totalTiles) * 100).toFixed(2) + '%',
    walkableCoverage: ((metadata.passableTiles.length / metadata.totalTiles) * 100).toFixed(2) + '%'
  };
}

/**
 * Check if a specific tile is walkable
 * @param {number} x - Block X coordinate
 * @param {number} y - Block Y coordinate
 * @param {Object} mapData - Map data
 * @param {Object} tilesetData - Tileset data
 * @returns {boolean} - True if walkable (checks if ANY tile in block is walkable)
 */
export function isTileWalkable(x, y, mapData, tilesetData) {
  if (x < 0 || y < 0 || x >= mapData.width || y >= mapData.height) {
    return false;
  }

  const index = y * mapData.width + x;
  if (index >= mapData.blockData.length) {
    return false;
  }

  const blockId = mapData.blockData[index];
  const tileset = tilesetData.tilesets.find(t => t.tilesetId === mapData.tileset);
  if (!tileset || !tileset.blocks || !tileset.passableTiles) return false;

  const block = tileset.blocks[blockId];
  if (!block) return false;

  // Check if any tile in the 4x4 block is walkable
  for (let tileRow = 0; tileRow < 4; tileRow++) {
    for (let tileCol = 0; tileCol < 4; tileCol++) {
      const tileId = block.tiles[tileRow][tileCol];
      if (isTilePassable(tileId, tileset.passableTiles)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if a specific tile is surfable
 * @param {number} x - Block X coordinate
 * @param {number} y - Block Y coordinate
 * @param {Object} mapData - Map data
 * @param {Object} tilesetData - Tileset data
 * @returns {boolean} - True if surfable
 */
export function isTileSurfable(x, y, mapData, tilesetData) {
  if (x < 0 || y < 0 || x >= mapData.width || y >= mapData.height) {
    return false;
  }

  const index = y * mapData.width + x;
  if (index >= mapData.blockData.length) {
    return false;
  }

  const blockId = mapData.blockData[index];
  const tileset = tilesetData.tilesets.find(t => t.tilesetId === mapData.tileset);
  if (!tileset || !tileset.blocks || !tileset.passableTiles) return false;

  const block = tileset.blocks[blockId];
  if (!block) return false;

  // Check if any tile in the 4x4 block is surfable water
  const waterTiles = [0x14, 0x32, 0x48];
  for (let tileRow = 0; tileRow < 4; tileRow++) {
    for (let tileCol = 0; tileCol < 4; tileCol++) {
      const tileId = block.tiles[tileRow][tileCol];
      const tileInfo = getTileCollisionInfo(tileId, tileset);
      if (tileInfo.surfable) {
        return true;
      }
    }
  }
  
  return false;
}
