/**
 * Map Connection Verifier
 * 
 * Verifies map connection data by:
 * 1. Loading all map data from JSON files
 * 2. Checking if connected maps exist
 * 3. Verifying bidirectional connections
 * 4. Building a world map graph
 * 5. Detecting disconnected map islands
 * 6. Exporting connection visualization data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAP_DATA_DIR = path.join(__dirname, '..', 'output', 'map-data');
const MAPS_DIR = path.join(MAP_DATA_DIR, 'maps');
const OUTPUT_FILE = path.join(__dirname, 'map_connections_graph.json');

// Connection direction names
const DIRECTION_NAMES = {
  0: 'NONE',
  1: 'NORTH',
  2: 'SOUTH',
  3: 'WEST',
  4: 'EAST'
};

/**
 * Load all map data from JSON files
 */
function loadAllMaps() {
  const maps = new Map();
  
  if (!fs.existsSync(MAPS_DIR)) {
    console.error('[ERROR] Maps directory not found:', MAPS_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(MAPS_DIR).filter(f => f.endsWith('.json'));
  
  console.log(`Loading ${files.length} map files...`);
  
  for (const file of files) {
    try {
      const filepath = path.join(MAPS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      maps.set(data.mapId, data);
    } catch (error) {
      console.warn(`[WARNING] Failed to load ${file}: ${error.message}`);
    }
  }
  
  console.log(`[OK] Loaded ${maps.size} maps\n`);
  return maps;
}

/**
 * Parse connections from map data
 */
function parseConnections(map) {
  const connections = [];
  
  if (!map.connectionHeaders) {
    return connections;
  }

  // Check each direction
  const directions = ['north', 'south', 'west', 'east'];
  for (const dir of directions) {
    if (map.connectionHeaders[dir] && map.connectionHeaders[dir].connectedMap !== undefined) {
      connections.push({
        direction: dir.toUpperCase(),
        directionValue: { north: 1, south: 2, west: 3, east: 4 }[dir],
        connectedMapId: map.connectionHeaders[dir].connectedMap,
        alignment: {
          x: map.connectionHeaders[dir].xAlignment,
          y: map.connectionHeaders[dir].yAlignment
        },
        connectedMapWidth: map.connectionHeaders[dir].connectedMapWidth
      });
    }
  }
  
  return connections;
}

/**
 * Verify map connections
 */
function verifyConnections(maps) {
  console.log('============================================================');
  console.log('Map Connection Verification');
  console.log('============================================================\n');

  const results = {
    totalMaps: maps.size,
    mapsWithConnections: 0,
    totalConnections: 0,
    validConnections: 0,
    invalidConnections: 0,
    unidirectionalConnections: 0,
    bidirectionalConnections: 0,
    errors: [],
    warnings: [],
    connectionDetails: []
  };

  // First pass: Count connections and verify targets exist
  for (const [mapId, map] of maps) {
    const connections = parseConnections(map);
    
    if (connections.length > 0) {
      results.mapsWithConnections++;
      results.totalConnections += connections.length;
    }

    for (const conn of connections) {
      const detail = {
        sourceMapId: mapId,
        sourceMapName: map.name,
        direction: conn.direction,
        targetMapId: conn.connectedMapId,
        targetMapName: null,
        exists: false,
        bidirectional: false
      };

      // Check if target map exists
      const targetMap = maps.get(conn.connectedMapId);
      if (targetMap) {
        detail.exists = true;
        detail.targetMapName = targetMap.name;
        results.validConnections++;

        // Check for reverse connection
        const reverseConnections = parseConnections(targetMap);
        const oppositeDirection = getOppositeDirection(conn.directionValue);
        const hasReverse = reverseConnections.some(
          rc => rc.directionValue === oppositeDirection && rc.connectedMapId === mapId
        );
        
        if (hasReverse) {
          detail.bidirectional = true;
          results.bidirectionalConnections++;
        } else {
          results.unidirectionalConnections++;
          results.warnings.push(
            `Map ${mapId} (${map.name}) → ${conn.direction} → Map ${conn.connectedMapId} (${targetMap.name}) has no reverse connection`
          );
        }
      } else {
        results.invalidConnections++;
        results.errors.push(
          `Map ${mapId} (${map.name}) → ${conn.direction} → Map ${conn.connectedMapId} DOES NOT EXIST`
        );
      }

      results.connectionDetails.push(detail);
    }
  }

  // Display results
  console.log('Connection Statistics:');
  console.log(`  Total Maps:              ${results.totalMaps}`);
  console.log(`  Maps with Connections:   ${results.mapsWithConnections}`);
  console.log(`  Total Connections:       ${results.totalConnections}`);
  console.log(`  Valid Connections:       ${results.validConnections}`);
  console.log(`  Invalid Connections:     ${results.invalidConnections}`);
  console.log(`  Bidirectional:           ${results.bidirectionalConnections / 2} pairs (${results.bidirectionalConnections} connections)`);
  console.log(`  Unidirectional:          ${results.unidirectionalConnections}`);
  console.log();

  // Display errors
  if (results.errors.length > 0) {
    console.log(`\x1b[31m[ERRORS] ${results.errors.length} connection errors:\x1b[0m`);
    results.errors.forEach(err => console.log(`  - ${err}`));
    console.log();
  }

  // Display warnings (sample)
  if (results.warnings.length > 0) {
    console.log(`\x1b[33m[WARNINGS] ${results.warnings.length} unidirectional connections:\x1b[0m`);
    results.warnings.slice(0, 10).forEach(warn => console.log(`  - ${warn}`));
    if (results.warnings.length > 10) {
      console.log(`  ... and ${results.warnings.length - 10} more`);
    }
    console.log();
  }

  return results;
}

/**
 * Get opposite direction
 */
function getOppositeDirection(direction) {
  const opposites = {
    1: 2, // NORTH <-> SOUTH
    2: 1,
    3: 4, // WEST <-> EAST
    4: 3
  };
  return opposites[direction] || 0;
}

/**
 * Build world map graph using BFS
 */
function buildWorldMapGraph(maps) {
  console.log('============================================================');
  console.log('World Map Graph Analysis');
  console.log('============================================================\n');

  const graph = {
    nodes: [],
    edges: [],
    islands: []
  };

  // Build adjacency list
  const adjacency = new Map();
  const allMapIds = Array.from(maps.keys());

  for (const mapId of allMapIds) {
    adjacency.set(mapId, []);
  }

  // Add edges
  for (const [mapId, map] of maps) {
    const connections = parseConnections(map);
    for (const conn of connections) {
      if (maps.has(conn.connectedMapId)) {
        adjacency.get(mapId).push(conn.connectedMapId);
        
        graph.edges.push({
          from: mapId,
          to: conn.connectedMapId,
          direction: conn.direction
        });
      }
    }
  }

  // Find connected components (islands)
  const visited = new Set();
  let islandId = 0;

  for (const startMapId of allMapIds) {
    if (visited.has(startMapId)) continue;

    // BFS to find all connected maps
    const island = [];
    const queue = [startMapId];
    visited.add(startMapId);

    while (queue.length > 0) {
      const mapId = queue.shift();
      const map = maps.get(mapId);
      island.push({
        mapId: mapId,
        name: map.name,
        tileset: map.tilesetName
      });

      const neighbors = adjacency.get(mapId) || [];
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    graph.islands.push({
      islandId: islandId++,
      size: island.size,
      maps: island
    });
  }

  // Add all nodes
  for (const [mapId, map] of maps) {
    const connections = parseConnections(map);
    graph.nodes.push({
      mapId: mapId,
      name: map.name,
      width: map.width,
      height: map.height,
      tileset: map.tilesetName,
      connectionCount: connections.length,
      islandId: graph.islands.findIndex(island => 
        island.maps.some(m => m.mapId === mapId)
      )
    });
  }

  // Display results
  console.log('Graph Structure:');
  console.log(`  Total Nodes (Maps):      ${graph.nodes.length}`);
  console.log(`  Total Edges:             ${graph.edges.length}`);
  console.log(`  Connected Components:    ${graph.islands.length}`);
  console.log();

  // Display islands
  console.log('Map Islands (Connected Components):');
  for (const island of graph.islands) {
    console.log(`\n  Island ${island.islandId}: ${island.maps.length} maps`);
    island.maps.slice(0, 5).forEach(m => {
      console.log(`    - Map ${m.mapId}: ${m.name}`);
    });
    if (island.maps.length > 5) {
      console.log(`    ... and ${island.maps.length - 5} more maps`);
    }
  }
  console.log();

  return graph;
}

/**
 * Generate ASCII world map visualization
 */
function generateASCIIWorldMap(maps, graph) {
  console.log('============================================================');
  console.log('ASCII World Map Preview (Major Connections)');
  console.log('============================================================\n');

  // Find maps with most connections (likely major areas)
  const majorMaps = graph.nodes
    .filter(n => n.connectionCount >= 2)
    .sort((a, b) => b.connectionCount - a.connectionCount)
    .slice(0, 15);

  console.log('Major Connected Maps:');
  for (const node of majorMaps) {
    const map = maps.get(node.mapId);
    const connections = parseConnections(map);
    
    console.log(`\n  [${node.mapId}] ${node.name} (${node.connectionCount} connections)`);
    for (const conn of connections) {
      const target = maps.get(conn.connectedMapId);
      if (target) {
        const arrow = {
          'NORTH': '↑',
          'SOUTH': '↓',
          'WEST': '←',
          'EAST': '→'
        }[conn.direction] || '?';
        console.log(`    ${arrow} ${conn.direction.padEnd(6)} → [${conn.connectedMapId}] ${target.name}`);
      }
    }
  }
  console.log();
}

/**
 * Export graph data for visualization
 */
function exportGraphData(graph, results) {
  const exportData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalMaps: results.totalMaps,
      totalConnections: results.totalConnections,
      validConnections: results.validConnections,
      islands: graph.islands.length
    },
    nodes: graph.nodes,
    edges: graph.edges,
    islands: graph.islands,
    errors: results.errors,
    warnings: results.warnings.slice(0, 50) // Limit warnings in export
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(exportData, null, 2));
  console.log(`[OK] Exported graph data to: ${OUTPUT_FILE}`);
}

/**
 * Main execution
 */
function main() {
  console.log('\n============================================================');
  console.log('Pokemon Red - Map Connection Verifier');
  console.log('============================================================\n');

  // Load all maps
  const maps = loadAllMaps();

  // Verify connections
  const results = verifyConnections(maps);

  // Build world map graph
  const graph = buildWorldMapGraph(maps);

  // Generate ASCII visualization
  generateASCIIWorldMap(maps, graph);

  // Export data
  exportGraphData(graph, results);

  console.log('\n============================================================');
  console.log('Verification Complete!');
  console.log('============================================================\n');

  // Summary
  if (results.errors.length === 0 && results.warnings.length === 0) {
    console.log('\x1b[32m✓ All connections are valid and bidirectional!\x1b[0m\n');
  } else if (results.errors.length === 0) {
    console.log('\x1b[33m⚠ Connections are valid but some are unidirectional\x1b[0m\n');
  } else {
    console.log('\x1b[31m✗ Some connections point to non-existent maps\x1b[0m\n');
  }
}

// Run the verification
main();
