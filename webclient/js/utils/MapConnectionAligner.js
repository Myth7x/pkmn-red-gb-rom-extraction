/**
 * MapConnectionAligner.js
 * 
 * Analyzes connection boundaries between maps and aligns them based on walkable tiles.
 * This ensures that paths and doorways between connected maps line up correctly.
 * 
 * Pokemon Red's connection system uses alignment offsets (xAlignment/yAlignment) but
 * sometimes these need fine-tuning based on actual walkable tile positions.
 */

import { Logger } from '../utils/Logger.js';

export class MapConnectionAligner {
    constructor(tilesetManager) {
        this.tilesetManager = tilesetManager;
    }
    
    /**
     * Calculate optimal alignment offset for connected maps based on walkable tiles
     * @param {Object} mainMap - Main map data
     * @param {Object} connectedMap - Connected map data
     * @param {string} direction - Connection direction ('north', 'south', 'east', 'west')
     * @param {number} currentAlignment - Current alignment from connection header
     * @returns {number} - Adjusted alignment offset
     */
    async calculateOptimalAlignment(mainMap, connectedMap, direction, currentAlignment) {
        // Get edge tiles for both maps at the connection boundary
        const mainEdge = this.getConnectionEdgeTiles(mainMap, direction, 'main');
        const connectedEdge = this.getConnectionEdgeTiles(connectedMap, direction, 'connected');
        
        if (!mainEdge || !connectedEdge) {
            Logger.warn(`Could not analyze edge tiles for ${direction} connection`);
            return currentAlignment;
        }
        
        // Find walkable tile positions on both edges
        const mainWalkable = await this.findWalkableTilePositions(mainMap, mainEdge);
        const connectedWalkable = await this.findWalkableTilePositions(connectedMap, connectedEdge);
        
        if (mainWalkable.length === 0 || connectedWalkable.length === 0) {
            Logger.log(`No walkable tiles found on ${direction} connection boundary`);
            return currentAlignment;
        }
        
        // Calculate best alignment based on walkable tile matching
        const bestAlignment = this.findBestAlignment(
            mainWalkable,
            connectedWalkable,
            currentAlignment,
            direction
        );
        
        if (bestAlignment !== currentAlignment) {
            Logger.log(`Adjusted ${direction} alignment: ${currentAlignment} → ${bestAlignment}`);
        }
        
        return bestAlignment;
    }
    
    /**
     * Get tiles along the connection edge
     * @param {Object} map - Map data
     * @param {string} direction - Connection direction
     * @param {string} role - 'main' or 'connected'
     * @returns {Object} - Edge tile information
     */
    getConnectionEdgeTiles(map, direction, role) {
        const BLOCK_SIZE = 4; // 4x4 tiles per block
        
        let tiles = [];
        let edgeRow, edgeCol;
        
        if (direction === 'north' || direction === 'south') {
            // Horizontal edge
            if (direction === 'north') {
                // Top edge of main map or bottom edge of connected map
                edgeRow = (role === 'main') ? 0 : map.height - 1;
            } else {
                // Bottom edge of main map or top edge of connected map
                edgeRow = (role === 'main') ? map.height - 1 : 0;
            }
            
            // Get all tiles along this row
            for (let blockX = 0; blockX < map.width; blockX++) {
                const blockIndex = edgeRow * map.width + blockX;
                const blockId = map.blockData[blockIndex];
                
                // Get tiles from this block (bottom row for north, top row for south)
                const tileRow = (direction === 'north' && role === 'main') ? 0 : 
                               (direction === 'south' && role === 'main') ? 3 : 
                               (direction === 'north' && role === 'connected') ? 3 : 0;
                
                for (let tileX = 0; tileX < BLOCK_SIZE; tileX++) {
                    tiles.push({
                        blockX,
                        tileX,
                        tileRow,
                        blockId,
                        position: blockX * BLOCK_SIZE + tileX // Absolute position along edge
                    });
                }
            }
            
            return {
                tiles,
                isHorizontal: true,
                length: map.width * BLOCK_SIZE
            };
        } else {
            // Vertical edge (east/west)
            if (direction === 'west') {
                // Left edge of main map or right edge of connected map
                edgeCol = (role === 'main') ? 0 : map.width - 1;
            } else {
                // Right edge of main map or left edge of connected map
                edgeCol = (role === 'main') ? map.width - 1 : 0;
            }
            
            // Get all tiles along this column
            for (let blockY = 0; blockY < map.height; blockY++) {
                const blockIndex = blockY * map.width + edgeCol;
                const blockId = map.blockData[blockIndex];
                
                // Get tiles from this block (left column for west, right column for east)
                const tileCol = (direction === 'west' && role === 'main') ? 0 : 
                               (direction === 'east' && role === 'main') ? 3 : 
                               (direction === 'west' && role === 'connected') ? 3 : 0;
                
                for (let tileY = 0; tileY < BLOCK_SIZE; tileY++) {
                    tiles.push({
                        blockY,
                        tileY,
                        tileCol,
                        blockId,
                        position: blockY * BLOCK_SIZE + tileY // Absolute position along edge
                    });
                }
            }
            
            return {
                tiles,
                isHorizontal: false,
                length: map.height * BLOCK_SIZE
            };
        }
    }
    
    /**
     * Find positions of walkable tiles along the edge
     * @param {Object} map - Map data
     * @param {Object} edgeInfo - Edge tile information
     * @returns {Array<number>} - Positions of walkable tiles
     */
    async findWalkableTilePositions(map, edgeInfo) {
        const walkablePositions = [];
        
        // Ensure tileset blocks are loaded
        if (!this.tilesetManager.hasBlockDefinitions(map.tileset)) {
            await this.tilesetManager.loadTilesetBlocks(map.tileset);
        }
        
        for (const tileInfo of edgeInfo.tiles) {
            const blockDef = this.tilesetManager.getBlockDefinition(map.tileset, tileInfo.blockId);
            if (!blockDef || !blockDef.tiles) continue;
            
            // Get the specific tile ID from the block
            let tileId;
            if (edgeInfo.isHorizontal) {
                tileId = blockDef.tiles[tileInfo.tileRow][tileInfo.tileX];
            } else {
                tileId = blockDef.tiles[tileInfo.tileY][tileInfo.tileCol];
            }
            
            // Check if this tile is passable
            const isPassable = this.tilesetManager.isTilePassable(map.tileset, tileId);
            
            if (isPassable) {
                walkablePositions.push(tileInfo.position);
            }
        }
        
        return walkablePositions;
    }
    
    /**
     * Find best alignment offset to match walkable tiles
     * @param {Array<number>} mainWalkable - Walkable positions on main map edge
     * @param {Array<number>} connectedWalkable - Walkable positions on connected map edge
     * @param {number} currentAlignment - Current alignment offset
     * @param {string} direction - Connection direction
     * @returns {number} - Best alignment offset
     */
    findBestAlignment(mainWalkable, connectedWalkable, currentAlignment, direction) {
        // For north/south connections, alignment is horizontal offset (xAlignment)
        // For east/west connections, alignment is vertical offset (yAlignment)
        
        // Calculate a score for each possible alignment adjustment
        const searchRange = 4; // Search ±4 tiles from current alignment
        let bestScore = -1;
        let bestAlignment = currentAlignment;
        
        for (let adjustment = -searchRange; adjustment <= searchRange; adjustment++) {
            const testAlignment = currentAlignment + adjustment;
            const score = this.calculateAlignmentScore(
                mainWalkable,
                connectedWalkable,
                testAlignment
            );
            
            if (score > bestScore) {
                bestScore = score;
                bestAlignment = testAlignment;
            }
        }
        
        // Only adjust if we found a significantly better alignment
        if (bestScore > 0) {
            return bestAlignment;
        }
        
        return currentAlignment;
    }
    
    /**
     * Calculate how well walkable tiles align with a given offset
     * @param {Array<number>} mainWalkable - Walkable positions on main map edge
     * @param {Array<number>} connectedWalkable - Walkable positions on connected map edge
     * @param {number} offset - Alignment offset to test
     * @returns {number} - Alignment score (higher is better)
     */
    calculateAlignmentScore(mainWalkable, connectedWalkable, offset) {
        let score = 0;
        
        // Count how many walkable tiles align with this offset
        for (const mainPos of mainWalkable) {
            // Adjust connected positions by offset
            for (const connectedPos of connectedWalkable) {
                const adjustedPos = connectedPos + offset;
                
                // If positions match (within 1 tile tolerance), add to score
                if (Math.abs(mainPos - adjustedPos) <= 1) {
                    score += 2; // Exact or near match
                }
                
                // Bonus for exact matches
                if (mainPos === adjustedPos) {
                    score += 3;
                }
            }
        }
        
        return score;
    }
    
    /**
     * Analyze and log connection alignment information (for debugging)
     * @param {Object} mainMap - Main map data
     * @param {Object} connectedMap - Connected map data
     * @param {string} direction - Connection direction
     * @param {number} alignment - Current alignment (in pixels)
     * @returns {Object} - Analysis results with optimal alignment
     */
    async analyzeConnectionAlignment(mainMap, connectedMap, direction, alignment) {
        Logger.log(`\n=== Analyzing ${direction} connection ===`);
        Logger.log(`Main Map: ${mainMap.name} (${mainMap.width}x${mainMap.height})`);
        Logger.log(`Connected Map: ${connectedMap.name} (${connectedMap.width}x${connectedMap.height})`);
        Logger.log(`Current Alignment: ${alignment} pixels`);
        
        const mainEdge = this.getConnectionEdgeTiles(mainMap, direction, 'main');
        const connectedEdge = this.getConnectionEdgeTiles(connectedMap, direction, 'connected');
        
        const mainWalkable = await this.findWalkableTilePositions(mainMap, mainEdge);
        const connectedWalkable = await this.findWalkableTilePositions(connectedMap, connectedEdge);
        
        Logger.log(`Main map walkable tile positions: [${mainWalkable.join(', ')}]`);
        Logger.log(`Connected map walkable tile positions: [${connectedWalkable.join(', ')}]`);
        
        // Convert pixel alignment to tile offset (8 pixels per tile)
        const TILE_SIZE = 8;
        const currentTileOffset = Math.round(alignment / TILE_SIZE);
        
        // Test a range of alignment offsets
        const searchRange = 10; // Test ±10 tiles
        const testResults = [];
        
        for (let tileOffset = currentTileOffset - searchRange; tileOffset <= currentTileOffset + searchRange; tileOffset++) {
            const score = this.calculateAlignmentScore(mainWalkable, connectedWalkable, tileOffset);
            if (score > 0) {
                testResults.push({
                    tileOffset,
                    pixelOffset: tileOffset * TILE_SIZE,
                    score,
                    isCurrent: tileOffset === currentTileOffset
                });
            }
        }
        
        // Sort by score (best first)
        testResults.sort((a, b) => b.score - a.score);
        
        Logger.log(`\nTested ${searchRange * 2 + 1} alignment offsets:`);
        Logger.log(`Found ${testResults.length} viable alignments`);
        
        if (testResults.length > 0) {
            Logger.log(`\n📊 Top 5 Alignments:`);
            testResults.slice(0, 5).forEach((result, index) => {
                const marker = result.isCurrent ? '⭐ CURRENT' : (index === 0 ? '✅ BEST' : '');
                Logger.log(`  ${index + 1}. Offset: ${result.tileOffset} tiles (${result.pixelOffset}px) | Score: ${result.score} ${marker}`);
            });
            
            const currentScore = this.calculateAlignmentScore(mainWalkable, connectedWalkable, currentTileOffset);
            const bestResult = testResults[0];
            
            if (bestResult.tileOffset !== currentTileOffset) {
                Logger.warn(`⚠️  Current alignment (${currentTileOffset} tiles, score: ${currentScore}) is NOT optimal!`);
                Logger.success(`💡 Recommended alignment: ${bestResult.tileOffset} tiles (${bestResult.pixelOffset}px, score: ${bestResult.score})`);
                Logger.log(`   Improvement: ${((bestResult.score - currentScore) / Math.max(currentScore, 1) * 100).toFixed(1)}% better`);
                
                return {
                    currentAlignment: alignment,
                    currentScore,
                    optimalAlignment: bestResult.pixelOffset,
                    optimalScore: bestResult.score,
                    shouldAdjust: true,
                    improvement: bestResult.score - currentScore
                };
            } else {
                Logger.success(`✅ Current alignment is optimal (score: ${currentScore})`);
                return {
                    currentAlignment: alignment,
                    currentScore,
                    optimalAlignment: alignment,
                    optimalScore: currentScore,
                    shouldAdjust: false,
                    improvement: 0
                };
            }
        } else {
            Logger.warn(`⚠️  No walkable tile alignments found for this connection`);
            return {
                currentAlignment: alignment,
                currentScore: 0,
                optimalAlignment: alignment,
                optimalScore: 0,
                shouldAdjust: false,
                improvement: 0
            };
        }
    }
}
