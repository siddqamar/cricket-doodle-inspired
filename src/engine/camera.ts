import { CAMERA, LOGICAL_H, LOGICAL_W } from '../config/constants';
import { clamp, lerp } from '../utils/math';

export type CameraTarget = {
  x?: number;
  y?: number;
  zoom?: number;
  /** Instantly jump to target (no lerp). */
  snap?: boolean;
  /** Override position lerp rate for this framing. */
  posRate?: number;
  /** Override zoom lerp rate for this framing. */
  zoomRate?: number;
};

/**
 * Virtual stage camera: smooth look + zoom + mild screen shake.
 * Apply only to world layers; draw HUD in screen space after restore.
 */
export class Camera {
  shake = 0;
  private ox = 0;
  private oy = 0;
  reducedMotion = false;

  private targetX = LOGICAL_W / 2;
  private targetY = LOGICAL_H / 2;
  private targetZoom: number = CAMERA.restZoom;

  private x = LOGICAL_W / 2;
  private y = LOGICAL_H / 2;
  private scale: number = CAMERA.restZoom;

  private posRate: number = CAMERA.lerpPos;
  private zoomRate: number = CAMERA.lerpZoom;

  constructor() {
    this.reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
  }

  reset(snap = true): void {
    this.setTarget({
      x: LOGICAL_W / 2,
      y: LOGICAL_H / 2,
      zoom: CAMERA.restZoom,
      snap,
      posRate: CAMERA.lerpPos,
      zoomRate: CAMERA.lerpZoom,
    });
    if (snap) {
      this.shake = 0;
      this.ox = 0;
      this.oy = 0;
    }
  }

  setTarget(t: CameraTarget): void {
    if (t.x !== undefined) {
      this.targetX = clamp(t.x, CAMERA.lookMinX, CAMERA.lookMaxX);
    }
    if (t.y !== undefined) {
      this.targetY = clamp(t.y, CAMERA.lookMinY, CAMERA.lookMaxY);
    }
    if (t.zoom !== undefined) {
      let z = clamp(t.zoom, CAMERA.zoomMin, CAMERA.zoomMax);
      if (this.reducedMotion) {
        // Pull zooms toward rest so motion stays gentle.
        z = lerp(CAMERA.restZoom, z, 0.35);
      }
      this.targetZoom = z;
    }
    if (t.posRate !== undefined) this.posRate = t.posRate;
    if (t.zoomRate !== undefined) this.zoomRate = t.zoomRate;

    if (t.snap) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.scale = this.targetZoom;
    }
  }

  addShake(amount: number): void {
    if (this.reducedMotion) {
      this.shake = Math.max(this.shake, amount * 0.25);
      return;
    }
    this.shake = Math.max(this.shake, amount);
  }

  update(dt: number): void {
    const pt = 1 - Math.exp(-this.posRate * dt);
    const zt = 1 - Math.exp(-this.zoomRate * dt);
    this.x = lerp(this.x, this.targetX, pt);
    this.y = lerp(this.y, this.targetY, pt);
    this.scale = lerp(this.scale, this.targetZoom, zt);

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

  /**
   * World transform: zoom + look around logical center, then shake.
   * Call inside ctx.save()/restore() around world drawing only.
   */
  apply(ctx: CanvasRenderingContext2D): void {
    const cx = LOGICAL_W / 2;
    const cy = LOGICAL_H / 2;
    ctx.translate(cx + this.ox, cy + this.oy);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.x, -this.y);
  }

  get offset(): { x: number; y: number } {
    return { x: this.ox, y: this.oy };
  }

  get zoom(): number {
    return this.scale;
  }

  get look(): { x: number; y: number } {
    return { x: this.x, y: this.y };
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
