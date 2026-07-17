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
};

export class VfxSystem {
  floats: FloatText[] = [];
  particles: Particle[] = [];
  private readonly maxParticles: number;

  constructor(maxParticles = 80) {
    this.maxParticles = maxParticles;
  }

  clear(): void {
    this.floats.length = 0;
    this.particles.length = 0;
  }

  float(x: number, y: number, text: string, color: string = COLORS.accent): void {
    this.floats.push({
      x,
      y,
      text,
      color,
      life: 1.1,
      maxLife: 1.1,
      vy: -40,
    });
  }

  burst(x: number, y: number, color: string, n = 12, reduced = false): void {
    const count = reduced ? Math.ceil(n * 0.35) : n;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) this.particles.shift();
      const a = randRange(0, Math.PI * 2);
      const sp = randRange(60, 220);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        life: randRange(0.35, 0.8),
        maxLife: 0.8,
        color,
        size: randRange(2, 5),
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
      p.vy += 400 * dt;
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
    ctx.font = 'bold 28px Segoe UI, system-ui, sans-serif';
    for (const f of this.floats) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = a;
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
