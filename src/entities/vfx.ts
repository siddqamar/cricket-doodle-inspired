import { clamp, randRange } from '../utils/math';
import { COLORS } from '../config/constants';

export type FloatText = {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
  size: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
};

const CONFETTI_COLORS = [
  '#f4d35e',
  '#fff',
  '#e76f51',
  '#52b788',
  '#7ec8e3',
  '#ff85a1',
  '#ffd166',
];

export class VfxSystem {
  floats: FloatText[] = [];
  particles: Particle[] = [];
  private readonly maxParticles: number;

  constructor(maxParticles = 140) {
    this.maxParticles = maxParticles;
  }

  clear(): void {
    this.floats.length = 0;
    this.particles.length = 0;
  }

  float(
    x: number,
    y: number,
    text: string,
    color: string = COLORS.accent,
    opts?: { life?: number; size?: number; vy?: number },
  ): void {
    const life = opts?.life ?? 1.1;
    this.floats.push({
      x,
      y,
      text,
      color,
      life,
      maxLife: life,
      vy: opts?.vy ?? -40,
      size: opts?.size ?? 28,
    });
  }

  burst(
    x: number,
    y: number,
    color: string,
    n = 12,
    reduced = false,
    opts?: { speedMin?: number; speedMax?: number; life?: number },
  ): void {
    const count = reduced ? Math.ceil(n * 0.35) : n;
    const speedMin = opts?.speedMin ?? 60;
    const speedMax = opts?.speedMax ?? 220;
    const maxLife = opts?.life ?? 0.8;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) this.particles.shift();
      const a = randRange(0, Math.PI * 2);
      const sp = randRange(speedMin, speedMax);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        life: randRange(maxLife * 0.45, maxLife),
        maxLife,
        color,
        size: randRange(2, 5),
        gravity: 400,
      });
    }
  }

  /** Multicolor confetti for sixes / big boundaries. */
  confetti(x: number, y: number, n = 36, reduced = false): void {
    const count = reduced ? Math.ceil(n * 0.3) : n;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) this.particles.shift();
      const a = randRange(-Math.PI * 0.95, -Math.PI * 0.05);
      const sp = randRange(90, 320);
      const color =
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!;
      this.particles.push({
        x: x + randRange(-18, 18),
        y: y + randRange(-10, 10),
        vx: Math.cos(a) * sp + randRange(-40, 40),
        vy: Math.sin(a) * sp,
        life: randRange(0.7, 1.35),
        maxLife: 1.35,
        color,
        size: randRange(2.5, 6.5),
        gravity: 520,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]!;
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `bold ${f.size}px Segoe UI, system-ui, sans-serif`;
      ctx.fillStyle = f.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}
