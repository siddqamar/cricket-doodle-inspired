export class Input {
  /** True only on the frame a swing is requested. */
  swingPressed = false;
  private swingQueued = false;

  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onPointer: (e: Event) => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly isGameplayInteractive: () => boolean,
  ) {
    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        if (this.isGameplayInteractive()) {
          e.preventDefault();
          this.swingQueued = true;
        }
      }
    };

    this.onPointer = (e: Event) => {
      // Ignore UI chrome clicks.
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest('button, .panel, .top-controls')) return;
      if (!this.isGameplayInteractive()) return;
      this.swingQueued = true;
    };

    window.addEventListener('keydown', this.onKeyDown);
    canvas.addEventListener('pointerdown', this.onPointer);
  }

  /** Call once at the start of each frame. */
  beginFrame(): void {
    this.swingPressed = this.swingQueued;
    this.swingQueued = false;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('pointerdown', this.onPointer);
  }
}
