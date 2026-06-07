import type { CameraState, Coordinate } from './types';

export class Camera {
  public pos: CameraState = { x: 0, y: 0 };
  private mapWidth: number;
  private mapHeight: number;
  private viewportWidth: number;
  private viewportHeight: number;
  private lerpFactor: number = 0.1;

  constructor(mapWidth: number, mapHeight: number, viewportWidth: number, viewportHeight: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  public resize(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  public update(targetX: number, targetY: number) {
    const targetCamX = targetX - this.viewportWidth / 2;
    const targetCamY = targetY - this.viewportHeight / 2;

    this.pos.x += (targetCamX - this.pos.x) * this.lerpFactor;
    this.pos.y += (targetCamY - this.pos.y) * this.lerpFactor;

    const maxCamX = Math.max(0, this.mapWidth - this.viewportWidth);
    const maxCamY = Math.max(0, this.mapHeight - this.viewportHeight);

    this.pos.x = Math.max(0, Math.min(maxCamX, this.pos.x));
    this.pos.y = Math.max(0, Math.min(maxCamY, this.pos.y));
  }

  public getRelativeCoords(worldX: number, worldY: number): Coordinate {
    return {
      x: worldX - this.pos.x,
      y: worldY - this.pos.y
    };
  }
}
