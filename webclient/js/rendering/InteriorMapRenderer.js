/**
 * InteriorMapRenderer.js
 * 
 * Renders interior map layouts with multiple connected rooms.
 * Draws rooms side-by-side with connection indicators.
 */

import { Logger } from '../utils/Logger.js';
import { TILE_SIZE, BLOCK_SIZE } from '../core/Constants.js';

// Version: Update patch number for bug fixes, minor for new features, major for breaking changes
export const MODULE_VERSION = '1.4.2';

export class InteriorMapRenderer {
    constructor(canvas, ctx, tilesetManager, collisionTileManager, tileAnimator) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.tilesetManager = tilesetManager;
        this.collisionTileManager = collisionTileManager;
        this.tileAnimator = tileAnimator;
        
        this.showConnections = true;
        this.showWarpPoints = true;
        this.showCollisionOverlays = false; // Controlled by MapViewer overlay toggle
        this.hoveredConnection = null; // Track hovered connection for highlighting
        this.showDragOverlay = false; // Show "Click to Move" overlay when Ctrl is pressed
        this.tileOptimizationEnabled = true; // Use optimized (pre-scaled) tilesets
    }
    
    /**
     * Set whether to show collision overlays
     * @param {boolean} show - Whether to show collision overlays
     */
    setShowCollisionOverlays(show) {
        this.showCollisionOverlays = show;
        this.showConnections = show;
        this.showWarpPoints = show;
    }
    
    /**
     * Set the currently hovered connection for highlighting
     * @param {Object|null} connection - Hovered connection data or null
     */
    setHoveredConnection(connection) {
        this.hoveredConnection = connection;
    }
    
    /**
     * Set whether to show drag overlay (Ctrl key pressed)
     * @param {boolean} show - Whether to show drag overlay
     */
    setShowDragOverlay(show) {
        this.showDragOverlay = show;
    }
    
    /**
     * Set whether to use tile optimization (pre-scaled tilesets)
     * @param {boolean} enabled - Whether to use optimized tilesets
     */
    setTileOptimization(enabled) {
        this.tileOptimizationEnabled = enabled;
    }
    
    /**
     * Render an entire interior layout with all connected rooms
     * @param {Object} layout - Layout data from InteriorMapLayoutManager
     * @param {number} scale - Render scale
     * @param {number} cameraOffsetX - Camera X offset for panning
     * @param {number} cameraOffsetY - Camera Y offset for panning
     * @param {number} mainMapId - The ID of the main/current map (for highlighting)
     */
    renderInteriorLayout(layout, scale, cameraOffsetX = 0, cameraOffsetY = 0, mainMapId = null) {
        if (!layout || !layout.rooms || layout.rooms.length === 0) {
            Logger.warn('No layout to render');
            return;
        }
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background (same as normal mode)
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render each room
        for (const room of layout.rooms) {
            const isMainRoom = room.mapData.mapId === mainMapId;
            this.renderRoom(room, scale, cameraOffsetX, cameraOffsetY, isMainRoom);
        }
        
        // Draw connections between rooms
        if (this.showConnections) {
            this.renderConnections(layout, scale, cameraOffsetX, cameraOffsetY);
        }
        
        // Draw room labels (only when overlays are shown)
        if (this.showCollisionOverlays) {
            this.renderRoomLabels(layout, scale, cameraOffsetX, cameraOffsetY, mainMapId);
        }
        
        // Show drag overlay at top center of screen (not on each room)
        if (this.showDragOverlay) {
            this.renderScreenDragOverlay();
        }
    }
    
    /**
     * Render a single room in the layout
     * @param {Object} room - Room data with mapData and offset
     * @param {number} scale - Render scale
     * @param {number} cameraOffsetX - Camera X offset
     * @param {number} cameraOffsetY - Camera Y offset
     * @param {boolean} isMainRoom - Whether this is the currently selected main room
     */
    renderRoom(room, scale, cameraOffsetX, cameraOffsetY, isMainRoom = false) {
        const mapData = room.mapData;
        
        // Calculate base position in pixels (offsetX/Y are in blocks, need to convert to pixels)
        const baseX = (room.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetX;
        const baseY = (room.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetY;
        
        // Draw room border (highlight main room with different color)
        this.ctx.strokeStyle = isMainRoom ? '#00ff00' : '#ffcc00';
        this.ctx.lineWidth = isMainRoom ? 3 : 2;
        this.ctx.strokeRect(
            baseX,
            baseY,
            mapData.width * BLOCK_SIZE * TILE_SIZE * scale,
            mapData.height * BLOCK_SIZE * TILE_SIZE * scale
        );
        
        // Render blocks
        for (let blockY = 0; blockY < mapData.height; blockY++) {
            for (let blockX = 0; blockX < mapData.width; blockX++) {
                const blockIndex = blockY * mapData.width + blockX;
                const blockId = mapData.blockData[blockIndex];
                
                const screenX = baseX + (blockX * BLOCK_SIZE * TILE_SIZE * scale);
                const screenY = baseY + (blockY * BLOCK_SIZE * TILE_SIZE * scale);
                
                // Show collision overlays only for main room
                this.renderBlock(blockId, screenX, screenY, scale, mapData.tileset, isMainRoom && this.showCollisionOverlays);
            }
        }
        
        // Draw warp points
        if (this.showWarpPoints && room.warps) {
            this.renderWarpPoints(room, baseX, baseY, scale);
        }
    }
    
    /**
     * Render a single block
     * @param {number} blockId - Block ID to render
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} scale - Render scale
     * @param {number} tilesetNumber - Tileset to use
     * @param {boolean} showCollision - Whether to show collision overlays
     */
    renderBlock(blockId, x, y, scale, tilesetNumber, showCollision = false) {
        const blockData = this.tilesetManager.getBlockDefinition(tilesetNumber, blockId);
        if (!blockData || !blockData.tiles) return;
        
        // Render 4x4 tiles in the block (tiles is a 2D array [row][col])
        for (let tileY = 0; tileY < BLOCK_SIZE; tileY++) {
            for (let tileX = 0; tileX < BLOCK_SIZE; tileX++) {
                // Access 2D array structure: tiles[row][col]
                const tileId = blockData.tiles[tileY][tileX];
                
                if (tileId === undefined) continue;
                
                const tileScreenX = x + (tileX * TILE_SIZE * scale);
                const tileScreenY = y + (tileY * TILE_SIZE * scale);
                
                this.renderTile(tileId, tileScreenX, tileScreenY, scale, tilesetNumber);
                
                // Render collision indicators if enabled
                if (showCollision) {
                    this.renderCollisionIndicator(tileId, tileScreenX, tileScreenY, scale, tilesetNumber);
                }
            }
        }
    }
    
    /**
     * Render a single tile
     * @param {number} tileId - Tile ID to render
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} scale - Render scale
     * @param {number} tilesetNumber - Tileset to use
     */
    renderTile(tileId, x, y, scale, tilesetNumber) {
        // Get the tileset image (or optimized version for current scale)
        const tilesetImg = this.tilesetManager.getTilesetImage(tilesetNumber);
        if (!tilesetImg) return;
        
        // Get animation type for this tileset
        const animationType = this.tilesetManager.getAnimationTypeValue(tilesetNumber);
        
        // Check if this is an animated tile and render it separately (disable at very small scales)
        if (scale >= 0.5 && this.tileAnimator && this.tileAnimator.isAnimatedTile(tileId, animationType)) {
            const animatedCanvas = this.tileAnimator.renderAnimatedTile(tilesetImg, tileId, animationType, scale);
            if (animatedCanvas) {
                this.ctx.drawImage(animatedCanvas, x, y);
                return;
            }
        }
        
        // Use optimized tileset for small scales (only if optimization enabled)
        const optimizedTileset = this.tileOptimizationEnabled 
            ? this.tilesetManager.getOptimizedTileset(tilesetNumber, scale)
            : null;
        const tilesetToUse = optimizedTileset || tilesetImg;
        
        // Calculate source position in tileset image (16 tiles per row)
        const srcX = (tileId % 16) * TILE_SIZE;
        const srcY = Math.floor(tileId / 16) * TILE_SIZE;
        
        // Draw the tile
        this.ctx.drawImage(
            tilesetToUse,
            srcX, srcY, TILE_SIZE, TILE_SIZE,
            x, y,
            TILE_SIZE * scale,
            TILE_SIZE * scale
        );
    }
    
    /**
     * Render collision indicator overlay for a tile
     * @param {number} tileId - Tile ID
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} scale - Render scale
     * @param {number} tilesetNumber - Tileset to use
     */
    renderCollisionIndicator(tileId, x, y, scale, tilesetNumber) {
        const tileSize = TILE_SIZE * scale;
        
        // Analyze tile collision type (same logic as MapViewer)
        const isPassable = this.tilesetManager.isTilePassable(tilesetNumber, tileId);
        const isGrass = this.tilesetManager.isGrassTile(tilesetNumber, tileId);
        const isWater = this.tilesetManager.isWaterTile(tileId);
        const isLedge = this.tilesetManager.isLedgeTile(tileId);
        const isFlower = this.tilesetManager.isFlowerTile(tilesetNumber, tileId);
        const isDoor = this.tilesetManager.isDoorTile(tileId);
        const isWarpCarpet = this.tilesetManager.isWarpCarpetTile(tileId);
        const isCounter = this.tilesetManager.isCounterTile(tileId);
        
        // Determine collision overlay color based on tile type (priority order)
        let overlayColor = null;
        let overlayAlpha = 0.3;
        
        if (isGrass) {
            overlayColor = 'rgba(0, 255, 0, 1.0)';
            overlayAlpha = 0.4;
        } else if (isWater) {
            overlayColor = 'rgba(0, 100, 255, 1.0)';
            overlayAlpha = 0.35;
        } else if (isLedge) {
            overlayColor = 'rgba(255, 140, 0, 1.0)';
            overlayAlpha = 0.4;
        } else if (isWarpCarpet) {
            overlayColor = 'rgba(255, 0, 255, 1.0)';
            overlayAlpha = 0.35;
        } else if (isDoor) {
            overlayColor = 'rgba(128, 0, 255, 1.0)';
            overlayAlpha = 0.35;
        } else if (isCounter) {
            overlayColor = 'rgba(255, 200, 0, 1.0)';
            overlayAlpha = 0.3;
        } else if (isFlower) {
            overlayColor = 'rgba(255, 192, 203, 1.0)';
            overlayAlpha = 0.25;
        } else if (!isPassable) {
            overlayColor = 'rgba(255, 0, 0, 1.0)';
            overlayAlpha = 0.25;
        }
        
        // Draw overlay if applicable
        if (overlayColor) {
            this.ctx.save();
            this.ctx.globalAlpha = overlayAlpha;
            this.ctx.fillStyle = overlayColor;
            this.ctx.fillRect(x, y, tileSize, tileSize);
            this.ctx.restore();
        }
    }
    
    /**
     * Render warp points in a room
     * @param {Object} room - Room data
     * @param {number} baseX - Base screen X position (already in pixels)
     * @param {number} baseY - Base screen Y position (already in pixels)
     * @param {number} scale - Render scale
     */
    renderWarpPoints(room, baseX, baseY, scale) {
        for (const warp of room.warps) {
            // Warp coordinates are in 2-tile units (half-blocks), convert to pixels
            const warpX = baseX + (warp.x * 2 * TILE_SIZE * scale);
            const warpY = baseY + (warp.y * 2 * TILE_SIZE * scale);
            
            const warpSizePixels = 2 * TILE_SIZE * scale; // Warps are 2x2 tiles
            
            // Draw warp indicator (blue circle)
            this.ctx.fillStyle = 'rgba(0, 100, 255, 0.6)';
            this.ctx.beginPath();
            this.ctx.arc(
                warpX + (warpSizePixels / 2),
                warpY + (warpSizePixels / 2),
                warpSizePixels / 3,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
            
            // Draw warp ID
            this.ctx.fillStyle = 'white';
            this.ctx.font = `bold ${Math.max(10, 10 * scale)}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                `W${warp.warpId}`,
                warpX + (warpSizePixels / 2),
                warpY + (warpSizePixels / 2)
            );
        }
    }
    
    /**
     * Render connection lines between rooms
     * Groups overlapping connections and shows them with directional arrows
     * @param {Object} layout - Complete layout data
     * @param {number} scale - Render scale
     * @param {number} cameraOffsetX - Camera X offset
     * @param {number} cameraOffsetY - Camera Y offset
     */
    renderConnections(layout, scale, cameraOffsetX, cameraOffsetY) {
        const roomMap = new Map(layout.rooms.map(r => [r.mapId, r]));
        const warpSizePixels = 2 * TILE_SIZE * scale;
        
        // First pass: collect all connections with their positions
        const connectionLines = [];
        
        for (const room of layout.rooms) {
            const baseX = (room.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetX;
            const baseY = (room.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetY;
            
            for (const connection of room.connections) {
                const destRoom = roomMap.get(connection.toMapId);
                if (!destRoom) continue;
                
                const warp = connection.fromWarp;
                
                // Source warp position (center of the warp) - warp coords are in 2-tile units
                const fromX = baseX + (warp.x * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                const fromY = baseY + (warp.y * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                
                // Find the destination warp in the destination room
                const destBaseX = (destRoom.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetX;
                const destBaseY = (destRoom.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetY;
                
                let toX, toY, destWarp = null;
                
                // Look for the destination warp using toWarpId
                if (connection.toWarpId !== undefined && destRoom.warps) {
                    destWarp = destRoom.warps.find(w => w.warpId === connection.toWarpId);
                    if (destWarp) {
                        // Use actual destination warp position - warp coords are in 2-tile units
                        toX = destBaseX + (destWarp.x * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                        toY = destBaseY + (destWarp.y * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                    } else {
                        // Fallback to room center if warp not found
                        toX = destBaseX + (destRoom.mapData.width * BLOCK_SIZE * TILE_SIZE * scale / 2);
                        toY = destBaseY + (destRoom.mapData.height * BLOCK_SIZE * TILE_SIZE * scale / 2);
                    }
                } else {
                    // Fallback to room center if no toWarpId
                    toX = destBaseX + (destRoom.mapData.width * BLOCK_SIZE * TILE_SIZE * scale / 2);
                    toY = destBaseY + (destRoom.mapData.height * BLOCK_SIZE * TILE_SIZE * scale / 2);
                }
                
                // Check if this connection is hovered
                const isHovered = this.hoveredConnection && 
                                 this.hoveredConnection.fromMapId === room.mapId &&
                                 this.hoveredConnection.toMapId === connection.toMapId &&
                                 this.hoveredConnection.fromWarp.warpId === warp.warpId;
                
                connectionLines.push({
                    fromX, fromY, toX, toY,
                    isHovered,
                    room, connection, destRoom, destWarp
                });
            }
        }
        
        // Second pass: group overlapping connections
        const lineGroups = this.groupOverlappingConnections(connectionLines, scale);
        
        // Third pass: render grouped connections
        for (const group of lineGroups) {
            if (group.length === 1) {
                // Single connection - render normally
                this.renderSingleConnection(group[0], scale);
            } else {
                // Multiple overlapping connections - render with split and arrows
                this.renderMergedConnections(group, scale);
            }
        }
    }
    
    /**
     * Group connections that overlap (same start and end points)
     * @param {Array} connections - Array of connection line data
     * @param {number} scale - Render scale
     * @returns {Array} - Array of connection groups
     */
    groupOverlappingConnections(connections, scale) {
        const groups = [];
        const processed = new Set();
        const POSITION_THRESHOLD = 5 * scale; // Consider positions same if within 5 pixels
        
        for (let i = 0; i < connections.length; i++) {
            if (processed.has(i)) continue;
            
            const group = [connections[i]];
            processed.add(i);
            
            // Find other connections with same start/end points
            for (let j = i + 1; j < connections.length; j++) {
                if (processed.has(j)) continue;
                
                const conn1 = connections[i];
                const conn2 = connections[j];
                
                // Check if start and end points are close enough to be considered overlapping
                const sameStart = Math.abs(conn1.fromX - conn2.fromX) < POSITION_THRESHOLD &&
                                 Math.abs(conn1.fromY - conn2.fromY) < POSITION_THRESHOLD;
                const sameEnd = Math.abs(conn1.toX - conn2.toX) < POSITION_THRESHOLD &&
                               Math.abs(conn1.toY - conn2.toY) < POSITION_THRESHOLD;
                
                if (sameStart && sameEnd) {
                    group.push(connections[j]);
                    processed.add(j);
                }
            }
            
            groups.push(group);
        }
        
        return groups;
    }
    
    /**
     * Render a single connection line
     * @param {Object} conn - Connection data
     * @param {number} scale - Render scale
     */
    renderSingleConnection(conn, scale) {
        // Draw connection line with vibrant color if hovered
        if (conn.isHovered) {
            this.ctx.strokeStyle = 'rgba(0, 200, 255, 1.0)'; // Vibrant cyan blue
            this.ctx.lineWidth = 4 * scale;
            this.ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
            this.ctx.shadowBlur = 10 * scale;
        } else {
            this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
            this.ctx.lineWidth = 2 * scale;
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
        }
        
        this.ctx.setLineDash([5 * scale, 5 * scale]);
        this.ctx.beginPath();
        this.ctx.moveTo(conn.fromX, conn.fromY);
        this.ctx.lineTo(conn.toX, conn.toY);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        
        // Draw arrow at the end
        this.drawArrow(conn.fromX, conn.fromY, conn.toX, conn.toY, scale, conn.isHovered);
    }
    
    /**
     * Render merged connections with split lines and directional arrows
     * @param {Array} group - Array of overlapping connections
     * @param {number} scale - Render scale
     */
    renderMergedConnections(group, scale) {
        // Calculate midpoint and angle
        const firstConn = group[0];
        const midX = (firstConn.fromX + firstConn.toX) / 2;
        const midY = (firstConn.fromY + firstConn.toY) / 2;
        
        // Calculate perpendicular offset for spreading the split lines
        const dx = firstConn.toX - firstConn.fromX;
        const dy = firstConn.toY - firstConn.fromY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / length; // Perpendicular vector
        const perpY = dx / length;
        
        const spreadDistance = 15 * scale; // Distance to spread the lines
        const isAnyHovered = group.some(c => c.isHovered);
        
        // Draw main line to midpoint
        if (isAnyHovered) {
            this.ctx.strokeStyle = 'rgba(0, 200, 255, 1.0)';
            this.ctx.lineWidth = 4 * scale;
            this.ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
            this.ctx.shadowBlur = 10 * scale;
        } else {
            this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
            this.ctx.lineWidth = 2 * scale;
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
        }
        
        this.ctx.setLineDash([5 * scale, 5 * scale]);
        this.ctx.beginPath();
        this.ctx.moveTo(firstConn.fromX, firstConn.fromY);
        this.ctx.lineTo(midX, midY);
        this.ctx.stroke();
        
        // Draw split lines from midpoint to each destination
        const numConnections = group.length;
        const startOffset = -(numConnections - 1) * spreadDistance / 2;
        
        for (let i = 0; i < numConnections; i++) {
            const conn = group[i];
            const offset = startOffset + (i * spreadDistance);
            
            // Calculate offset midpoint
            const offsetMidX = midX + (perpX * offset);
            const offsetMidY = midY + (perpY * offset);
            
            // Draw line from offset midpoint to destination
            if (conn.isHovered) {
                this.ctx.strokeStyle = 'rgba(0, 200, 255, 1.0)';
                this.ctx.lineWidth = 4 * scale;
            } else {
                this.ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
                this.ctx.lineWidth = 2 * scale;
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(offsetMidX, offsetMidY);
            this.ctx.lineTo(conn.toX, conn.toY);
            this.ctx.stroke();
            
            // Draw arrow at the end of each split line
            this.drawArrow(offsetMidX, offsetMidY, conn.toX, conn.toY, scale, conn.isHovered);
        }
        
        this.ctx.setLineDash([]);
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
    }
    
    /**
     * Draw an arrow at the end of a line
     * @param {number} fromX - Start X
     * @param {number} fromY - Start Y
     * @param {number} toX - End X
     * @param {number} toY - End Y
     * @param {number} scale - Render scale
     * @param {boolean} isHovered - Whether this arrow is hovered
     */
    drawArrow(fromX, fromY, toX, toY, scale, isHovered = false) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);
        
        const arrowLength = 10 * scale;
        const arrowWidth = 6 * scale;
        
        // Calculate arrow points
        const tipX = toX;
        const tipY = toY;
        const leftX = tipX - arrowLength * Math.cos(angle - Math.PI / 6);
        const leftY = tipY - arrowLength * Math.sin(angle - Math.PI / 6);
        const rightX = tipX - arrowLength * Math.cos(angle + Math.PI / 6);
        const rightY = tipY - arrowLength * Math.sin(angle + Math.PI / 6);
        
        // Draw filled arrow
        this.ctx.fillStyle = isHovered ? 'rgba(0, 200, 255, 1.0)' : 'rgba(0, 150, 255, 0.8)';
        this.ctx.beginPath();
        this.ctx.moveTo(tipX, tipY);
        this.ctx.lineTo(leftX, leftY);
        this.ctx.lineTo(rightX, rightY);
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    /**
     * Render room labels
     * @param {Object} layout - Complete layout data
     * @param {number} scale - Render scale
     * @param {number} cameraOffsetX - Camera X offset
     * @param {number} cameraOffsetY - Camera Y offset
     * @param {number} mainMapId - The ID of the main/current map (for highlighting)
     */
    renderRoomLabels(layout, scale, cameraOffsetX, cameraOffsetY, mainMapId = null) {
        for (const room of layout.rooms) {
            const baseX = (room.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetX;
            const baseY = (room.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetY;
            
            const blockSizePixels = BLOCK_SIZE * TILE_SIZE * scale;
            const centerX = baseX + (room.mapData.width * blockSizePixels / 2);
            const labelY = baseY - (10 * scale);
            
            const isMainRoom = room.mapData.mapId === mainMapId;
            
            // Draw label background
            const labelText = `Map ${room.mapId} (${room.mapData.width}x${room.mapData.height})`;
            this.ctx.font = `${Math.max(12, 12 * scale)}px monospace`;
            const textWidth = this.ctx.measureText(labelText).width;
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(
                centerX - textWidth / 2 - 5,
                labelY - 15 * scale,
                textWidth + 10,
                20 * scale
            );
            
            // Draw label text (highlight main room with green)
            this.ctx.fillStyle = isMainRoom ? '#00ff00' : '#ffcc00';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(labelText, centerX, labelY);
        }
    }
    
    /**
     * Render drag overlay at top center of screen
     */
    renderScreenDragOverlay() {
        const centerX = this.canvas.width / 2;
        const topY = 40;
        
        // Calculate background dimensions
        const padding = 20;
        const fontSize = 18;
        this.ctx.font = `bold ${fontSize}px Arial`;
        const text = 'Ctrl+Click to Move Rooms';
        const textWidth = this.ctx.measureText(text).width;
        
        const bgWidth = textWidth + padding * 2;
        const bgHeight = fontSize + padding;
        const bgX = centerX - bgWidth / 2;
        const bgY = topY;
        
        // Draw semi-transparent background box
        this.ctx.fillStyle = 'rgba(100, 200, 255, 0.9)';
        this.ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        
        // Draw border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
        
        // Draw text centered
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Draw text with shadow for readability
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        this.ctx.shadowBlur = 4;
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(text, centerX, bgY + bgHeight / 2);
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }
    
    /**
     * Toggle connection line visibility
     */
    toggleConnections() {
        this.showConnections = !this.showConnections;
        return this.showConnections;
    }
    
    /**
     * Toggle warp point visibility
     */
    toggleWarpPoints() {
        this.showWarpPoints = !this.showWarpPoints;
        return this.showWarpPoints;
    }
}
