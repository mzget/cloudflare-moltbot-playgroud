import { TileType } from './types';
import type { TileMap, TileConfig } from './types';

export const TILE_RULES: Record<TileType, TileConfig> = {
  [TileType.GRASS]: { id: TileType.GRASS, name: 'Grass', color: '#1a742c', isSolid: false },
  [TileType.PATH]:  { id: TileType.PATH,  name: 'Path',  color: '#353406', isSolid: false },
  [TileType.WATER]: { id: TileType.WATER, name: 'Water', color: '#212b62', isSolid: true  },
  [TileType.FENCE]: { id: TileType.FENCE, name: 'Fence', color: '#8a6020', isSolid: true  },
  [TileType.WALL]:  { id: TileType.WALL,  name: 'Wall',  color: '#2a2048', isSolid: true  },
  [TileType.TREE]:  { id: TileType.TREE,  name: 'Tree',  color: '#0a3808', isSolid: true  },
};

const G = TileType.GRASS;
const P = TileType.PATH;
const W = TileType.WATER;
const F = TileType.FENCE;
const L = TileType.WALL;
const T = TileType.TREE;

export function generateTileMap(rows: number, cols: number): TileMap {
  const map: TileMap = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      // Border trees
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) { row.push(T); continue; }

      // Water strip along top
      if (r >= 1 && r <= 3 && c >= 8 && c <= 16) { row.push(W); continue; }

      // Lab building walls (top-left area rows 3-10, cols 1-8)
      if (r === 3 && c >= 1 && c <= 8)  { row.push(L); continue; }
      if (r === 10 && c >= 1 && c <= 8) { row.push(L); continue; }
      if (r >= 3 && r <= 10 && (c === 1 || c === 8)) { row.push(L); continue; }
      // Lab floor
      if (r >= 4 && r <= 9 && c >= 2 && c <= 7) { row.push(P); continue; }

      // DB Agent desk area (top-center rows 3-10, cols 9-14)
      if (r === 3 && c >= 9 && c <= 14)  { row.push(L); continue; }
      if (r === 10 && c >= 9 && c <= 14) { row.push(L); continue; }
      if (r >= 3 && r <= 10 && (c === 9 || c === 14)) { row.push(L); continue; }
      if (r >= 4 && r <= 9 && c >= 10 && c <= 13) { row.push(P); continue; }

      // Main paths
      if (c === 12 && r >= 10 && r <= 22) { row.push(P); continue; }
      if (r === 16 && c >= 1 && c <= 18)  { row.push(P); continue; }
      if (c === 18 && r >= 16 && r <= 23) { row.push(P); continue; }

      // Safari Zone fence (right side rows 5-24, cols 19-30)
      if (r === 5 && c >= 19 && c <= 30)  { row.push(F); continue; }
      if (r === 24 && c >= 19 && c <= 30) { row.push(F); continue; }
      if (r >= 5 && r <= 24 && (c === 19 || c === 30)) { row.push(F); continue; }
      // Safari Zone interior grass
      if (r > 5 && r < 24 && c > 19 && c < 30) { row.push(G); continue; }

      // Scattered trees outside
      if ((r + c) % 7 === 0 && r > 11 && c < 18) { row.push(T); continue; }

      row.push(G);
    }
    map.push(row);
  }
  return map;
}

export function drawTileMap(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  cameraY: number,
  viewportWidth: number,
  viewportHeight: number,
  tileSize: number,
  timeSec: number = 0
) {
  const rows = map.length;
  const cols = map[0]?.length || 0;
  const startCol = Math.max(0, Math.floor(cameraX / tileSize));
  const endCol   = Math.min(cols - 1, Math.ceil((cameraX + viewportWidth) / tileSize));
  const startRow = Math.max(0, Math.floor(cameraY / tileSize));
  const endRow   = Math.min(rows - 1, Math.ceil((cameraY + viewportHeight) / tileSize));

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const tileType = map[r][c] as TileType;
      const tile = TILE_RULES[tileType] || TILE_RULES[TileType.GRASS];
      const drawX = c * tileSize - cameraX;
      const drawY = r * tileSize - cameraY;

      // Base tile rendering with pixel-art details
      if (tileType === TileType.GRASS) {
        ctx.fillStyle = '#1a742c';
        ctx.fillRect(drawX, drawY, tileSize, tileSize);

        // Deterministic grass blades
        const hash = (r * 73 + c * 31) % 4;
        ctx.fillStyle = '#0e5b16'; // Shadow
        if (hash === 0) {
          ctx.fillRect(drawX + 8, drawY + 8, 2, 4);
          ctx.fillRect(drawX + 24, drawY + 16, 2, 4);
          ctx.fillRect(drawX + 16, drawY + 32, 2, 4);
          ctx.fillStyle = '#2a8047'; // Highlight
          ctx.fillRect(drawX + 10, drawY + 6, 2, 2);
          ctx.fillRect(drawX + 26, drawY + 14, 2, 2);
        } else if (hash === 1) {
          ctx.fillRect(drawX + 12, drawY + 20, 2, 4);
          ctx.fillRect(drawX + 32, drawY + 12, 2, 4);
          ctx.fillStyle = '#2a8047';
          ctx.fillRect(drawX + 14, drawY + 18, 2, 2);
        } else if (hash === 2) {
          ctx.fillRect(drawX + 20, drawY + 24, 2, 4);
          ctx.fillRect(drawX + 4, drawY + 16, 2, 4);
          ctx.fillStyle = '#2a8047';
          ctx.fillRect(drawX + 22, drawY + 22, 2, 2);
        }
      } else if (tileType === TileType.PATH) {
        ctx.fillStyle = '#353406';
        ctx.fillRect(drawX, drawY, tileSize, tileSize);

        // Sand/gravel texture
        const pathHash = (r * 19 + c * 37) % 3;
        ctx.fillStyle = '#1e1c03'; // Dark gravel
        if (pathHash === 0) {
          ctx.fillRect(drawX + 6, drawY + 10, 2, 2);
          ctx.fillRect(drawX + 28, drawY + 20, 2, 2);
          ctx.fillStyle = '#4e4c0d'; // Light gravel
          ctx.fillRect(drawX + 18, drawY + 30, 2, 2);
        } else if (pathHash === 1) {
          ctx.fillRect(drawX + 22, drawY + 6, 2, 2);
          ctx.fillRect(drawX + 10, drawY + 24, 2, 2);
          ctx.fillStyle = '#4e4c0d';
          ctx.fillRect(drawX + 30, drawY + 12, 2, 2);
        }
      } else if (tileType === TileType.WATER) {
        ctx.fillStyle = '#212b62';
        ctx.fillRect(drawX, drawY, tileSize, tileSize);

        // 2-frame wave shimmer
        const frame = Math.floor(timeSec * 2) % 2;
        ctx.fillStyle = '#324290';
        if (frame === 0) {
          ctx.fillRect(drawX + 4, drawY + 12, 16, 2);
          ctx.fillRect(drawX + 24, drawY + 28, 16, 2);
          ctx.fillRect(drawX + 12, drawY + 40, 12, 2);
        } else {
          ctx.fillRect(drawX + 12, drawY + 14, 16, 2);
          ctx.fillRect(drawX + 8, drawY + 26, 16, 2);
          ctx.fillRect(drawX + 20, drawY + 38, 12, 2);
        }
      } else if (tileType === TileType.TREE) {
        // Draw grass under the tree
        ctx.fillStyle = '#1a742c';
        ctx.fillRect(drawX, drawY, tileSize, tileSize);

        // Trunk
        ctx.fillStyle = '#4a2c08';
        ctx.fillRect(drawX + tileSize * 0.42, drawY + tileSize * 0.5, tileSize * 0.16, tileSize * 0.5);

        // Bottom layer shadow
        ctx.fillStyle = '#051f05';
        ctx.beginPath();
        ctx.arc(drawX + tileSize / 2, drawY + tileSize * 0.42, tileSize * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Main canopy
        ctx.fillStyle = '#0a3808';
        ctx.beginPath();
        ctx.arc(drawX + tileSize * 0.32, drawY + tileSize * 0.35, tileSize * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(drawX + tileSize * 0.68, drawY + tileSize * 0.35, tileSize * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(drawX + tileSize / 2, drawY + tileSize * 0.26, tileSize * 0.28, 0, Math.PI * 2);
        ctx.fill();

        // Highlights
        ctx.fillStyle = '#1a742c';
        ctx.beginPath();
        ctx.arc(drawX + tileSize / 2, drawY + tileSize * 0.22, tileSize * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(drawX + tileSize * 0.32, drawY + tileSize * 0.31, tileSize * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(drawX + tileSize * 0.68, drawY + tileSize * 0.31, tileSize * 0.14, 0, Math.PI * 2);
        ctx.fill();
      } else if (tileType === TileType.FENCE) {
        ctx.fillStyle = '#1a742c';
        ctx.fillRect(drawX, drawY, tileSize, tileSize);

        // Posts
        ctx.fillStyle = '#5c3e10';
        ctx.fillRect(drawX + 4, drawY + 4, 6, tileSize - 8);
        ctx.fillRect(drawX + tileSize - 10, drawY + 4, 6, tileSize - 8);

        ctx.fillStyle = '#8a6020';
        ctx.fillRect(drawX + 4, drawY + 4, 4, tileSize - 8);
        ctx.fillRect(drawX + tileSize - 10, drawY + 4, 4, tileSize - 8);

        // Rails
        ctx.fillStyle = '#5c3e10';
        ctx.fillRect(drawX, drawY + tileSize * 0.3, tileSize, 5);
        ctx.fillRect(drawX, drawY + tileSize * 0.65, tileSize, 5);

        ctx.fillStyle = '#8a6020';
        ctx.fillRect(drawX, drawY + tileSize * 0.3, tileSize, 3);
        ctx.fillRect(drawX, drawY + tileSize * 0.65, tileSize, 3);
      } else if (tileType === TileType.WALL) {
        ctx.fillStyle = '#2a2048';
        ctx.fillRect(drawX, drawY, tileSize, tileSize);

        // Borders
        ctx.fillStyle = '#41356e';
        ctx.fillRect(drawX, drawY, tileSize, 3);
        ctx.fillRect(drawX, drawY, 3, tileSize);

        ctx.fillStyle = '#140e24';
        ctx.fillRect(drawX, drawY + tileSize - 3, tileSize, 3);
        ctx.fillRect(drawX + tileSize - 3, drawY, 3, tileSize);

        // Brick grid lines
        ctx.fillStyle = '#140e24';
        ctx.fillRect(drawX, drawY + tileSize * 0.5, tileSize, 2);
        ctx.fillRect(drawX + tileSize * 0.25, drawY, 2, tileSize * 0.5);
        ctx.fillRect(drawX + tileSize * 0.75, drawY, 2, tileSize * 0.5);
        ctx.fillRect(drawX + tileSize * 0.5, drawY + tileSize * 0.5, 2, tileSize * 0.5);
      } else {
        ctx.fillStyle = tile.color;
        ctx.fillRect(drawX, drawY, tileSize, tileSize);
      }

      // Tile grid subtle line
      ctx.strokeStyle = 'rgba(255,255,255,0.015)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(drawX, drawY, tileSize, tileSize);
    }
  }
}
