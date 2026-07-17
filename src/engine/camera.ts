import { clamp, lerp } from '../utils/math';
import { LOGICAL_H, LOGICAL_W } from '../config/constants';

export class Camera {
  shake = 0;
  private ox = 0;
  private oy = 0;
  reducedMotion = false;

  constructor() {
    this.reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
  }

  addShake(amount: number): void {
    if (this.reducedMotion) {
      this.shake = Math.max(this.shake, amount * 0.25);
      return;
    }
    this.shake = Math.max(this.shake, amount);
  }

  update(dt: number): void {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 8);
      const m = this.shake * 4;
      this.ox = (Math.random() * 2 - 1) * m;
      this.oy = (Math.random() * 2 - 1) * m;
    } else {
      this.ox = lerp(this.ox, 0, 0.3);
      this.oy = lerp(this.oy, 0, 0.3);
    }
  }

  apply(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.ox, this.oy);
  }

  get offset(): { x: number; y: number } {
    return { x: this.ox, y: this.oy };
  }
}

export type FitResult = {
  scale: number;
  cssW: number;
  cssH: number;
  offsetX: number;
  offsetY: number;
};

export function fitCanvasToParent(
  canvas: HTMLCanvasElement,
  parent: HTMLElement,
): FitResult {
  const rect = parent.getBoundingClientRect();
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
  const cssW = rect.width;
  const cssH = rect.height;
  const scale = Math.min(cssW / LOGICAL_W, cssH / LOGICAL_H);

  canvas.width = Math.max(1, Math.floor(LOGICAL_W * dpr));
  canvas.height = Math.max(1, Math.floor(LOGICAL_H * dpr));
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return {
    scale,
    cssW,
    cssH,
    offsetX: (cssW - LOGICAL_W * scale) / 2,
    offsetY: (cssH - LOGICAL_H * scale) / 2,
  };
}
