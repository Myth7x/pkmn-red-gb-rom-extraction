/**
 * ConnectionRenderer.js
 * 
 * Handles rendering of connections between rooms in interior layout mode.
 * Draws connection lines, arrows, and handles grouped connections.
 */

import { TILE_SIZE, BLOCK_SIZE } from '../core/Constants.js';

export const MODULE_VERSION = '1.0.0';

export class ConnectionRenderer {
    constructor(canvasRenderer) {
        this.renderer = canvasRenderer;
        this.hoveredConnection = null;
    }

    /**
     * Set the currently hovered connection for highlighting
     * @param {Object|null} connection - Hovered connection data or null
     */
    setHoveredConnection(connection) {
        this.hoveredConnection = connection;
    }

    /**
     * Render connection lines between rooms
     * @param {Object} layout - Complete layout data
     * @param {number} scale - Render scale
     * @param {number} cameraOffsetX - Camera X offset
     * @param {number} cameraOffsetY - Camera Y offset
     */
    renderConnections(layout, scale, cameraOffsetX, cameraOffsetY) {
        const roomMap = new Map(layout.rooms.map(r => [r.mapId, r]));
        const warpSizePixels = 2 * TILE_SIZE * scale;
        
        // Collect all connections with their positions
        const connectionLines = [];
        
        for (const room of layout.rooms) {
            const baseX = (room.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetX;
            const baseY = (room.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetY;
            
            for (const connection of room.connections) {
                const destRoom = roomMap.get(connection.toMapId);
                if (!destRoom) continue;
                
                const warp = connection.fromWarp;
                
                // Source warp position (center)
                const fromX = baseX + (warp.x * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                const fromY = baseY + (warp.y * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                
                // Destination position
                const destBaseX = (destRoom.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetX;
                const destBaseY = (destRoom.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetY;
                
                let toX, toY, destWarp = null;
                
                // Find destination warp
                if (connection.toWarpId !== undefined && destRoom.warps) {
                    destWarp = destRoom.warps.find(w => w.warpId === connection.toWarpId);
                    if (destWarp) {
                        toX = destBaseX + (destWarp.x * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                        toY = destBaseY + (destWarp.y * 2 * TILE_SIZE * scale) + (warpSizePixels / 2);
                    } else {
                        toX = destBaseX + (destRoom.mapData.width * BLOCK_SIZE * TILE_SIZE * scale / 2);
                        toY = destBaseY + (destRoom.mapData.height * BLOCK_SIZE * TILE_SIZE * scale / 2);
                    }
                } else {
                    toX = destBaseX + (destRoom.mapData.width * BLOCK_SIZE * TILE_SIZE * scale / 2);
                    toY = destBaseY + (destRoom.mapData.height * BLOCK_SIZE * TILE_SIZE * scale / 2);
                }
                
                // Check if hovered
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
        
        // Group overlapping connections
        const lineGroups = this.groupOverlappingConnections(connectionLines, scale);
        
        // Render grouped connections
        for (const group of lineGroups) {
            if (group.length === 1) {
                this.renderSingleConnection(group[0], scale);
            } else {
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
        const POSITION_THRESHOLD = 5 * scale;
        
        for (let i = 0; i < connections.length; i++) {
            if (processed.has(i)) continue;
            
            const group = [connections[i]];
            processed.add(i);
            
            for (let j = i + 1; j < connections.length; j++) {
                if (processed.has(j)) continue;
                
                const conn1 = connections[i];
                const conn2 = connections[j];
                
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
        if (conn.isHovered) {
            this.renderer.ctx.strokeStyle = 'rgba(0, 200, 255, 1.0)';
            this.renderer.ctx.lineWidth = 4 * scale;
            this.renderer.ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
            this.renderer.ctx.shadowBlur = 10 * scale;
        } else {
            this.renderer.ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
            this.renderer.ctx.lineWidth = 2 * scale;
            this.renderer.ctx.shadowColor = 'transparent';
            this.renderer.ctx.shadowBlur = 0;
        }
        
        this.renderer.ctx.setLineDash([5 * scale, 5 * scale]);
        this.renderer.ctx.beginPath();
        this.renderer.ctx.moveTo(conn.fromX, conn.fromY);
        this.renderer.ctx.lineTo(conn.toX, conn.toY);
        this.renderer.ctx.stroke();
        this.renderer.ctx.setLineDash([]);
        
        this.renderer.ctx.shadowColor = 'transparent';
        this.renderer.ctx.shadowBlur = 0;
        
        this.drawArrow(conn.fromX, conn.fromY, conn.toX, conn.toY, scale, conn.isHovered);
    }

    /**
     * Render merged connections with split lines
     * @param {Array} group - Array of overlapping connections
     * @param {number} scale - Render scale
     */
    renderMergedConnections(group, scale) {
        const firstConn = group[0];
        const midX = (firstConn.fromX + firstConn.toX) / 2;
        const midY = (firstConn.fromY + firstConn.toY) / 2;
        
        const dx = firstConn.toX - firstConn.fromX;
        const dy = firstConn.toY - firstConn.fromY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / length;
        const perpY = dx / length;
        
        const spreadDistance = 15 * scale;
        const isAnyHovered = group.some(c => c.isHovered);
        
        // Draw main line to midpoint
        if (isAnyHovered) {
            this.renderer.ctx.strokeStyle = 'rgba(0, 200, 255, 1.0)';
            this.renderer.ctx.lineWidth = 4 * scale;
            this.renderer.ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
            this.renderer.ctx.shadowBlur = 10 * scale;
        } else {
            this.renderer.ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
            this.renderer.ctx.lineWidth = 2 * scale;
            this.renderer.ctx.shadowColor = 'transparent';
            this.renderer.ctx.shadowBlur = 0;
        }
        
        this.renderer.ctx.setLineDash([5 * scale, 5 * scale]);
        this.renderer.ctx.beginPath();
        this.renderer.ctx.moveTo(firstConn.fromX, firstConn.fromY);
        this.renderer.ctx.lineTo(midX, midY);
        this.renderer.ctx.stroke();
        
        // Draw split lines
        const numConnections = group.length;
        const startOffset = -(numConnections - 1) * spreadDistance / 2;
        
        for (let i = 0; i < numConnections; i++) {
            const conn = group[i];
            const offset = startOffset + (i * spreadDistance);
            
            const offsetMidX = midX + (perpX * offset);
            const offsetMidY = midY + (perpY * offset);
            
            if (conn.isHovered) {
                this.renderer.ctx.strokeStyle = 'rgba(0, 200, 255, 1.0)';
                this.renderer.ctx.lineWidth = 4 * scale;
            } else {
                this.renderer.ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
                this.renderer.ctx.lineWidth = 2 * scale;
            }
            
            this.renderer.ctx.beginPath();
            this.renderer.ctx.moveTo(offsetMidX, offsetMidY);
            this.renderer.ctx.lineTo(conn.toX, conn.toY);
            this.renderer.ctx.stroke();
            
            this.drawArrow(offsetMidX, offsetMidY, conn.toX, conn.toY, scale, conn.isHovered);
        }
        
        this.renderer.ctx.setLineDash([]);
        this.renderer.ctx.shadowColor = 'transparent';
        this.renderer.ctx.shadowBlur = 0;
    }

    /**
     * Draw an arrow at the end of a line
     * @param {number} fromX - Start X
     * @param {number} fromY - Start Y
     * @param {number} toX - End X
     * @param {number} toY - End Y
     * @param {number} scale - Render scale
     * @param {boolean} isHovered - Whether arrow is hovered
     */
    drawArrow(fromX, fromY, toX, toY, scale, isHovered = false) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);
        
        const arrowLength = 10 * scale;
        
        const tipX = toX;
        const tipY = toY;
        const leftX = tipX - arrowLength * Math.cos(angle - Math.PI / 6);
        const leftY = tipY - arrowLength * Math.sin(angle - Math.PI / 6);
        const rightX = tipX - arrowLength * Math.cos(angle + Math.PI / 6);
        const rightY = tipY - arrowLength * Math.sin(angle + Math.PI / 6);
        
        this.renderer.ctx.fillStyle = isHovered ? 'rgba(0, 200, 255, 1.0)' : 'rgba(0, 150, 255, 0.8)';
        this.renderer.ctx.beginPath();
        this.renderer.ctx.moveTo(tipX, tipY);
        this.renderer.ctx.lineTo(leftX, leftY);
        this.renderer.ctx.lineTo(rightX, rightY);
        this.renderer.ctx.closePath();
        this.renderer.ctx.fill();
    }

    /**
     * Render room labels
     * @param {Object} layout - Complete layout data
     * @param {number} scale - Render scale
     * @param {number} cameraOffsetX - Camera X offset
     * @param {number} cameraOffsetY - Camera Y offset
     * @param {number} mainMapId - ID of main/current map
     */
    renderRoomLabels(layout, scale, cameraOffsetX, cameraOffsetY, mainMapId = null) {
        for (const room of layout.rooms) {
            const baseX = (room.offsetX * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetX;
            const baseY = (room.offsetY * BLOCK_SIZE * TILE_SIZE * scale) + cameraOffsetY;
            
            const blockSizePixels = BLOCK_SIZE * TILE_SIZE * scale;
            const centerX = baseX + (room.mapData.width * blockSizePixels / 2);
            const labelY = baseY - (10 * scale);
            
            const isMainRoom = room.mapData.mapId === mainMapId;
            
            const labelText = `Map ${room.mapId} (${room.mapData.width}x${room.mapData.height})`;
            const fontSize = Math.max(12, 12 * scale);
            this.renderer.ctx.font = `${fontSize}px monospace`;
            const textWidth = this.renderer.ctx.measureText(labelText).width;
            
            // Draw background
            this.renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.renderer.ctx.fillRect(
                centerX - textWidth / 2 - 5,
                labelY - 15 * scale,
                textWidth + 10,
                20 * scale
            );
            
            // Draw text
            this.renderer.ctx.fillStyle = isMainRoom ? '#00ff00' : '#ffcc00';
            this.renderer.ctx.textAlign = 'center';
            this.renderer.ctx.textBaseline = 'middle';
            this.renderer.ctx.fillText(labelText, centerX, labelY);
        }
    }

    /**
     * Render drag overlay at top center of screen
     * @param {number} canvasWidth - Canvas width
     */
    renderDragOverlay(canvasWidth) {
        const centerX = canvasWidth / 2;
        const topY = 40;
        
        const padding = 20;
        const fontSize = 18;
        this.renderer.ctx.font = `bold ${fontSize}px Arial`;
        const text = 'Ctrl+Click to Move Rooms';
        const textWidth = this.renderer.ctx.measureText(text).width;
        
        const bgWidth = textWidth + padding * 2;
        const bgHeight = fontSize + padding;
        const bgX = centerX - bgWidth / 2;
        const bgY = topY;
        
        // Draw background
        this.renderer.ctx.fillStyle = 'rgba(100, 200, 255, 0.9)';
        this.renderer.ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        
        // Draw border
        this.renderer.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.renderer.ctx.lineWidth = 2;
        this.renderer.ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
        
        // Draw text with shadow
        this.renderer.ctx.textAlign = 'center';
        this.renderer.ctx.textBaseline = 'middle';
        this.renderer.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        this.renderer.ctx.shadowBlur = 4;
        this.renderer.ctx.shadowOffsetX = 1;
        this.renderer.ctx.shadowOffsetY = 1;
        
        this.renderer.ctx.fillStyle = '#ffffff';
        this.renderer.ctx.fillText(text, centerX, bgY + bgHeight / 2);
        
        // Reset shadow
        this.renderer.ctx.shadowColor = 'transparent';
        this.renderer.ctx.shadowBlur = 0;
        this.renderer.ctx.shadowOffsetX = 0;
        this.renderer.ctx.shadowOffsetY = 0;
    }
}
