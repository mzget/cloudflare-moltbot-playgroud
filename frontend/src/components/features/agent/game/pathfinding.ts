import { TileType } from './types';
import type { TileMap, NPC } from './types';
import { TILE_RULES } from './tilemap';
import { checkOverlap } from './collision';

const TILE_SIZE = 48;

export interface Point {
  r: number;
  c: number;
}

interface Node {
  r: number;
  c: number;
  g: number; // cost from start
  h: number; // heuristic cost to end
  f: number; // total cost
  parent: Node | null;
}

export function findPath(
  map: TileMap,
  start: Point,
  end: Point,
  npcs: NPC[] = [],
  minRow: number = 12,
  maxRow: number = 41
): Point[] | null {
  const rows = map.length;
  const cols = map[0]?.length || 0;

  // Check if start is out of bounds
  if (
    start.r < minRow || start.r > maxRow || start.c < 0 || start.c >= cols
  ) {
    return null;
  }

  // Constrain target end node within walkable rows
  const targetEnd = {
    r: Math.max(minRow, Math.min(maxRow, end.r)),
    c: Math.max(0, Math.min(cols - 1, end.c))
  };

  let finalEnd = { ...targetEnd };

  // If the target tile is blocked, search for the closest walkable tile nearby
  if (isTileBlocked(map, finalEnd.r, finalEnd.c, npcs)) {
    const closest = findClosestWalkableTile(map, finalEnd, start, npcs, minRow, maxRow);
    if (!closest) return null;
    finalEnd = closest;
  }

  const openList: Node[] = [];
  const closedSet = new Set<string>();

  const startNode: Node = {
    r: start.r,
    c: start.c,
    g: 0,
    h: heuristic(start, finalEnd),
    f: 0,
    parent: null
  };
  startNode.f = startNode.g + startNode.h;

  openList.push(startNode);

  while (openList.length > 0) {
    // Sort to get node with lowest f-score
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;
    const key = `${current.r},${current.c}`;
    closedSet.add(key);

    // Reached target
    if (current.r === finalEnd.r && current.c === finalEnd.c) {
      const path: Point[] = [];
      let temp: Node | null = current;
      while (temp !== null) {
        path.push({ r: temp.r, c: temp.c });
        temp = temp.parent;
      }
      return path.reverse();
    }

    // Neighbors (4-directional)
    const neighbors: Point[] = [
      { r: current.r - 1, c: current.c },
      { r: current.r + 1, c: current.c },
      { r: current.r, c: current.c - 1 },
      { r: current.r, c: current.c + 1 },
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor.r < minRow || neighbor.r > maxRow ||
        neighbor.c < 0 || neighbor.c >= cols
      ) {
        continue;
      }

      if (isTileBlocked(map, neighbor.r, neighbor.c, npcs)) {
        continue;
      }

      if (closedSet.has(`${neighbor.r},${neighbor.c}`)) {
        continue;
      }

      const gScore = current.g + 1;
      let neighborNode = openList.find(n => n.r === neighbor.r && n.c === neighbor.c);

      if (!neighborNode) {
        neighborNode = {
          r: neighbor.r,
          c: neighbor.c,
          g: gScore,
          h: heuristic(neighbor, finalEnd),
          f: 0,
          parent: current
        };
        neighborNode.f = neighborNode.g + neighborNode.h;
        openList.push(neighborNode);
      } else if (gScore < neighborNode.g) {
        neighborNode.g = gScore;
        neighborNode.f = gScore + neighborNode.h;
        neighborNode.parent = current;
      }
    }
  }

  return null;
}

function heuristic(p1: Point, p2: Point): number {
  // Manhattan distance for 4-directional grid
  return Math.abs(p1.r - p2.r) + Math.abs(p1.c - p2.c);
}

function isTileBlocked(map: TileMap, r: number, c: number, npcs: NPC[]): boolean {
  // 1. Check if map boundary or solid tile
  const tileType = map[r]?.[c];
  if (tileType === undefined) return true;
  const tile = TILE_RULES[tileType as TileType];
  if (tile && tile.isSolid) return true;

  // 2. Check solid NPC collision with the tile
  const tileBox = {
    x: c * TILE_SIZE,
    y: r * TILE_SIZE,
    width: TILE_SIZE,
    height: TILE_SIZE
  };
  for (const npc of npcs) {
    if (npc.isSolid) {
      const npcBox = {
        x: npc.worldX,
        y: npc.worldY,
        width: npc.width,
        height: npc.height
      };
      if (checkOverlap(tileBox, npcBox)) {
        return true;
      }
    }
  }

  return false;
}

function findClosestWalkableTile(
  map: TileMap,
  target: Point,
  start: Point,
  npcs: NPC[],
  minRow: number,
  maxRow: number
): Point | null {
  const cols = map[0]?.length || 0;
  
  // BFS search outwards from target to find the nearest non-solid tile
  const queue: Point[] = [target];
  const visited = new Set<string>([`${target.r},${target.c}`]);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (!isTileBlocked(map, current.r, current.c, npcs)) {
      return current;
    }
    
    const neighbors: Point[] = [
      { r: current.r - 1, c: current.c },
      { r: current.r + 1, c: current.c },
      { r: current.r, c: current.c - 1 },
      { r: current.r, c: current.c + 1 },
    ];
    
    // Sort neighbors by distance to start point so we prefer tiles towards the player
    neighbors.sort((a, b) => {
      const distA = Math.abs(a.r - start.r) + Math.abs(a.c - start.c);
      const distB = Math.abs(b.r - start.r) + Math.abs(b.c - start.c);
      return distA - distB;
    });
    
    for (const neighbor of neighbors) {
      if (
        neighbor.r < minRow || neighbor.r > maxRow ||
        neighbor.c < 0 || neighbor.c >= cols
      ) {
        continue;
      }
      
      const key = `${neighbor.r},${neighbor.c}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(neighbor);
      }
    }
  }
  
  return null;
}