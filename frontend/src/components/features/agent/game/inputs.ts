import type { Inputs } from './types';

export class InputManager {
  public inputs: Inputs = {
    up: false,
    down: false,
    left: false,
    right: false,
    a: false,
    b: false
  };

  private activeKeys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      e.preventDefault();
    }
    this.activeKeys.add(key);
    this.updateInputs();
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.activeKeys.delete(key);
    this.updateInputs();
  };

  private updateInputs() {
    this.inputs.up = this.activeKeys.has('w') || this.activeKeys.has('arrowup');
    this.inputs.down = this.activeKeys.has('s') || this.activeKeys.has('arrowdown');
    this.inputs.left = this.activeKeys.has('a') || this.activeKeys.has('arrowleft');
    this.inputs.right = this.activeKeys.has('d') || this.activeKeys.has('arrowright');
    this.inputs.a = this.activeKeys.has('e') || this.activeKeys.has('enter') || this.activeKeys.has(' ');
    this.inputs.b = this.activeKeys.has('escape') || this.activeKeys.has('backspace') || this.activeKeys.has('shift');
  }

  public getMovementVector() {
    let dx = 0;
    let dy = 0;

    if (this.inputs.up) dy -= 1;
    if (this.inputs.down) dy += 1;
    if (this.inputs.left) dx -= 1;
    if (this.inputs.right) dx += 1;

    if (dx !== 0 && dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;
    }

    return { dx, dy };
  }

  public setVirtualInput(key: keyof Inputs, value: boolean) {
    this.inputs[key] = value;
  }

  public cleanup() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
