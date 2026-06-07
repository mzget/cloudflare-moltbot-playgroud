import type { PlayerState, TileMap, NPC } from './types';
import { checkMapCollision, checkNPCCollision } from './collision';
import type { BoundingBox } from './collision';

export class Player {
  public state: PlayerState;
  constructor(startX: number, startY: number) {
    this.state = {
      worldX: startX,
      worldY: startY,
      width: 48,
      height: 48,
      speed: 200,
      direction: 0,
      frameIndex: 0,
      animTime: 0,
      isMoving: false
    };
  }
  public getFeetHitbox(x: number, y: number): BoundingBox {
    return {
      x: x + this.state.width * 0.2,
      y: y + this.state.height * 0.6,
      width: this.state.width * 0.6,
      height: this.state.height * 0.4
    };
  }
  public move(dx: number, dy: number, dt: number, map: TileMap, npcs: NPC[], tileSize: number) {
    const moveDist = this.state.speed * dt;
    this.state.isMoving = dx !== 0 || dy !== 0;
    if (this.state.isMoving) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.state.direction = dx > 0 ? 2 : 1;
      } else {
        this.state.direction = dy > 0 ? 0 : 3;
      }
      if (dx !== 0) {
        const nextX = this.state.worldX + dx * moveDist;
        const hitboxX = this.getFeetHitbox(nextX, this.state.worldY);
        const collidesMap = checkMapCollision(hitboxX, map, tileSize);
        const collidesNPC = checkNPCCollision(hitboxX, npcs);
        if (!collidesMap && !collidesNPC) {
          this.state.worldX = nextX;
        }
      }
      if (dy !== 0) {
        const nextY = this.state.worldY + dy * moveDist;
        // Limit player: cannot walk past Y = 22 (worldY must be >= 22 * tileSize)
        if (nextY >= 22 * tileSize) {
          const hitboxY = this.getFeetHitbox(this.state.worldX, nextY);
          const collidesMap = checkMapCollision(hitboxY, map, tileSize);
          const collidesNPC = checkNPCCollision(hitboxY, npcs);
          if (!collidesMap && !collidesNPC) {
            this.state.worldY = nextY;
          }
        }
      }
      this.state.animTime += dt;
      if (this.state.animTime > 0.12) {
        this.state.frameIndex = (this.state.frameIndex + 1) % 4;
        this.state.animTime = 0;
      }
    } else {
      this.state.frameIndex = 0;
      this.state.animTime = 0;
    }
  }
  public draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, timeSec: number) {
    const screenX = this.state.worldX - cameraX;
    const screenY = this.state.worldY - cameraY;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(screenX + this.state.width / 2, screenY + this.state.height * 0.9, this.state.width * 0.35, this.state.height * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    let bounce = 0;
    let limbSwing = 0;
    if (this.state.isMoving) {
      bounce = Math.abs(Math.sin(timeSec * 15)) * 3;
      limbSwing = Math.sin(timeSec * 15) * 8;
    }
    const bodyY = screenY - bounce;
    ctx.strokeStyle = '#312e81';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(screenX + 16, bodyY + 36);
    ctx.lineTo(screenX + 16 + (this.state.isMoving ? limbSwing : 0), screenY + 44);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(screenX + 32, bodyY + 36);
    ctx.lineTo(screenX + 32 - (this.state.isMoving ? limbSwing : 0), screenY + 44);
    ctx.stroke();
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(screenX + 12, bodyY + 18, 24, 20);
    ctx.fillStyle = '#4f46e5';
    if (this.state.direction === 1) {
      ctx.fillRect(screenX + 30, bodyY + 20, 6, 14);
    } else if (this.state.direction === 2) {
      ctx.fillRect(screenX + 12, bodyY + 20, 6, 14);
    } else if (this.state.direction === 0) {
      ctx.fillRect(screenX + 10, bodyY + 20, 4, 14);
      ctx.fillRect(screenX + 34, bodyY + 20, 4, 14);
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(screenX + 24, bodyY + 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    if (this.state.direction === 0) {
      ctx.fillRect(screenX + 18, bodyY + 7, 12, 6);
    } else if (this.state.direction === 1) {
      ctx.fillRect(screenX + 14, bodyY + 7, 7, 6);
    } else if (this.state.direction === 2) {
      ctx.fillRect(screenX + 27, bodyY + 7, 7, 6);
    } else {
      ctx.fillStyle = '#4f46e5';
      ctx.fillRect(screenX + 16, bodyY + 18, 16, 16);
    }
    ctx.restore();
  }
}
