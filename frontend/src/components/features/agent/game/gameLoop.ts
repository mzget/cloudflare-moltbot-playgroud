export class GameLoop {
  private updateFn: (dt: number) => void;
  private renderFn: () => void;
  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private maxFrameTime: number = 0.1;
  constructor(updateFn: (dt: number) => void, renderFn: () => void) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
  }
  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.loop);
  }
  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  private loop = (time: number) => {
    if (!this.isRunning) return;
    let dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (dt > this.maxFrameTime) {
      dt = this.maxFrameTime;
    }
    this.updateFn(dt);
    this.renderFn();
    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}