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
const T = TileType.TREE;

export function generateTileMap(rows: number, cols: number): TileMap {
  const actualRows = 42;
  const actualCols = 25;
  const map: TileMap = [];
  
  for (let r = 0; r < actualRows; r++) {
    const row: number[] = [];
    for (let c = 0; c < actualCols; c++) {
      let isSolid = false;
      
      if (c <= 3) isSolid = true;
      if (c >= 21) isSolid = true;
      
      if (r < 10 && c <= 4) isSolid = true;
      if (r > 32 && c <= 4) isSolid = true;
      if (r > 15 && r < 20 && c >= 20) isSolid = true;

      if (r >= 39) {
        if (c >= 9 && c <= 13) isSolid = false;
        else isSolid = true;
      }
      
      if (r <= 2) {
        if (c >= 9 && c <= 13) isSolid = false;
        else isSolid = true;
      }
      
      if (r === 11 && c >= 5 && c <= 11) isSolid = true;
      if (r === 21 && c >= 13 && c <= 19) isSolid = true;
      if (r === 31 && c >= 5 && c <= 11) isSolid = true;
      
      if (r === 6 && c >= 4 && c <= 8) isSolid = true;
      if (r === 31 && c >= 14 && c <= 20) isSolid = true;

      row.push(isSolid ? T : G);
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
  timeSec: number = 0,
  bgImage?: HTMLImageElement | null
) {
  const rows = map.length;
  const cols = map[0]?.length || 0;

  if (bgImage) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      bgImage,
      -cameraX,
      -cameraY,
      cols * tileSize,
      rows * tileSize
    );
    return;
  }

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

      if (tileType === TileType.GRASS) {
        ctx.fillStyle = '#1a742c';
        ctx.fillRect(drawX, drawY, tileSize, tileSize);

        const hash = (r * 73 + c * 31) % 4;
        ctx.fillStyle = '#0e5b16';
        if (hash === 0) {
          ctx.fillRect(drawX + 8, drawY + 8, 2, 4);
          ctx.fillRect(drawX + 24, drawY + 16, 2, 4);
          ctx.fillRect(drawX + 16, drawY + 32, 2, 4);
          ctx.fillStyle = '#2a8047';
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
      } else {
        ctx.fillStyle = tile.color;
        ctx.fillRect(drawX, drawY, tileSize, tileSize);
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.015)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(drawX, drawY, tileSize, tileSize);
    }
  }
}
