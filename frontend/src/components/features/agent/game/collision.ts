import { TileType } from './types';
import type { TileMap } from './types';
import { TILE_RULES } from './tilemap';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function checkOverlap(rect1: BoundingBox, rect2: BoundingBox): boolean {
  return rect1.x < rect2.x + rect2.width &&
         rect1.x + rect1.width > rect2.x &&
         rect1.y < rect2.y + rect2.height &&
         rect1.y + rect1.height > rect2.y;
}

export function checkMapCollision(hitbox: BoundingBox, map: TileMap, tileSize: number): boolean {
  const rows = map.length;
  const cols = map[0]?.length || 0;
  const startCol = Math.max(0, Math.floor(hitbox.x / tileSize));
  const endCol = Math.min(cols - 1, Math.floor((hitbox.x + hitbox.width) / tileSize));
  const startRow = Math.max(0, Math.floor(hitbox.y / tileSize));
  const endRow = Math.min(rows - 1, Math.floor((hitbox.y + hitbox.height) / tileSize));
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const tileType = map[r][c] as TileType;
      const tile = TILE_RULES[tileType];
      if (tile && tile.isSolid) {
        const tileHitbox: BoundingBox = {
          x: c * tileSize,
          y: r * tileSize,
          width: tileSize,
          height: tileSize
        };
        if (checkOverlap(hitbox, tileHitbox)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function checkNPCCollision(hitbox: BoundingBox, npcs: any[], activeNPCId?: string): boolean {
  for (const npc of npcs) {
    if (npc.isSolid && npc.id !== activeNPCId) {
      const npcHitbox: BoundingBox = {
        x: npc.worldX,
        y: npc.worldY,
        width: npc.width,
        height: npc.height
      };
      if (checkOverlap(hitbox, npcHitbox)) {
        return true;
      }
    }
  }
  return false;
}
