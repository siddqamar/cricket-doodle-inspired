import { COLORS, FIELD, LOGICAL_H, LOGICAL_W } from '../config/constants';
import { easeOutCubic } from '../utils/math';

export function drawSky(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, LOGICAL_H * 0.72);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Soft clouds
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  cloud(ctx, 120, 70, 40);
  cloud(ctx, 420, 50, 55);
  cloud(ctx, 780, 80, 45);
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
  ctx.arc(x + r * 0.6, y + 4, r * 0.85, 0, Math.PI * 2);
  ctx.arc(x + r * 1.3, y, r * 0.65, 0, Math.PI * 2);
  ctx.fill();
}

export function drawField(ctx: CanvasRenderingContext2D): void {
  // Outfield
  const grass = ctx.createLinearGradient(0, 280, 0, LOGICAL_H);
  grass.addColorStop(0, COLORS.grassLight);
  grass.addColorStop(1, COLORS.grassDark);
  ctx.fillStyle = grass;
  ctx.beginPath();
  ctx.ellipse(LOGICAL_W * 0.48, 430, 520, 150, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mowing stripes
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(LOGICAL_W * 0.48, 430, 520, 150, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(0, 300 + i * 18, LOGICAL_W, 10);
  }
  ctx.restore();

  // Boundary rope
  ctx.strokeStyle = COLORS.boundary;
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.ellipse(LOGICAL_W * 0.48, 430, 500, 138, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Pitch
  const px = FIELD.pitchLeft;
  const py = FIELD.pitchTop;
  const pw = FIELD.pitchRight - FIELD.pitchLeft;
  const ph = FIELD.pitchBottom - FIELD.pitchTop;
  ctx.fillStyle = COLORS.pitch;
  ctx.beginPath();
  roundRect(ctx, px, py, pw, ph, 8);
  ctx.fill();
  ctx.strokeStyle = COLORS.pitchLine;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Crease lines
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(FIELD.batterX - 50, py + 4);
  ctx.lineTo(FIELD.batterX - 50, py + ph - 4);
  ctx.moveTo(FIELD.bowlerX + 40, py + 4);
  ctx.lineTo(FIELD.bowlerX + 40, py + ph - 4);
  ctx.stroke();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCrowd(
  ctx: CanvasRenderingContext2D,
  time: number,
  cheer: number,
  reducedMotion: boolean,
): void {
  const amp = reducedMotion ? 0.5 : 2 + cheer * 4;
  const rows = 3;
  for (let row = 0; row < rows; row++) {
    const y = 210 + row * 22;
    const count = 22 - row * 2;
    for (let i = 0; i < count; i++) {
      const x = 40 + i * ((LOGICAL_W - 80) / count) + (row % 2) * 10;
      const bob = Math.sin(time * 3 + i * 0.7 + row) * amp;
      const hue = (i * 37 + row * 50) % 360;
      ctx.fillStyle = `hsl(${hue} 45% ${35 + row * 5}%)`;
      // body
      ctx.beginPath();
      ctx.ellipse(x, y + bob + 8, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // head
      ctx.fillStyle = `hsl(${(hue + 40) % 360} 40% 55%)`;
      ctx.beginPath();
      ctx.arc(x, y + bob - 4, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Simple stands bar
  ctx.fillStyle = 'rgba(20,40,30,0.35)';
  ctx.fillRect(0, 250, LOGICAL_W, 18);
}

export type BatterPose = {
  swingT: number; // 0 idle, 0..1 swinging
  celebrate: number;
};

export function drawBatter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: BatterPose,
): void {
  ctx.save();
  // Celebrate: small hop + body lift
  const hop =
    pose.celebrate > 0
      ? Math.abs(Math.sin(pose.celebrate * 10)) * 6 * Math.min(1, pose.celebrate)
      : 0;
  ctx.translate(x, y - hop);

  // Shadow (stays grounded)
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 18 + hop, 22 - hop * 0.4, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const swing = pose.swingT > 0 ? easeOutCubic(Math.min(1, pose.swingT)) : 0;
  // Bat angle: cocked back → through contact → follow through
  let batAngle = -0.9;
  if (swing > 0) {
    batAngle = -0.9 + swing * 2.4;
  }
  if (pose.celebrate > 0) {
    // Arms up victory flourish
    batAngle = -1.45 + Math.sin(pose.celebrate * 9) * 0.28;
  }

  // Legs
  ctx.strokeStyle = COLORS.batterBody;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, 8);
  ctx.lineTo(-10, 18 + hop * 0.15);
  ctx.moveTo(6, 8);
  ctx.lineTo(10, 18 + hop * 0.15);
  ctx.stroke();

  // Body
  ctx.fillStyle = COLORS.batterBody;
  ctx.beginPath();
  ctx.ellipse(0, -2, 16, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.batterBelly;
  ctx.beginPath();
  ctx.ellipse(2, 0, 9, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wings (flutter more while celebrating)
  const wingFlap = pose.celebrate > 0 ? Math.sin(pose.celebrate * 14) * 0.25 : 0;
  ctx.fillStyle = COLORS.batterWing;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(-14, -8, 10, 6, -0.5 - wingFlap, 0, Math.PI * 2);
  ctx.ellipse(14, -10, 10, 6, 0.5 + wingFlap, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Head
  ctx.fillStyle = COLORS.batterBelly;
  ctx.beginPath();
  ctx.arc(0, -24, 12, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(-4, -25, 2.2, 0, Math.PI * 2);
  ctx.arc(5, -25, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // Smile
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(1, -21, 4, 0.15, Math.PI - 0.15);
  ctx.stroke();
  // Antennae
  ctx.strokeStyle = COLORS.batterBody;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -34);
  ctx.quadraticCurveTo(-10, -44, -8, -48);
  ctx.moveTo(4, -34);
  ctx.quadraticCurveTo(10, -44, 8, -48);
  ctx.stroke();
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.arc(-8, -48, 3, 0, Math.PI * 2);
  ctx.arc(8, -48, 3, 0, Math.PI * 2);
  ctx.fill();

  // Bat
  ctx.save();
  ctx.translate(10, 0);
  ctx.rotate(batAngle);
  drawBat(ctx);
  ctx.restore();

  ctx.restore();
}

export function drawBat(ctx: CanvasRenderingContext2D): void {
  // Handle
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(-3, -4, 6, 28);
  // Blade
  ctx.fillStyle = '#d4a373';
  ctx.beginPath();
  roundRect(ctx, -10, 20, 20, 48, 6);
  ctx.fill();
  ctx.strokeStyle = '#b08968';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Face sticker
  ctx.fillStyle = 'rgba(82,183,136,0.35)';
  ctx.fillRect(-6, 30, 12, 22);
}

export type BowlerPose = {
  phase: number; // 0..1 delivery cycle
};

export function drawBowler(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: BowlerPose,
): void {
  ctx.save();
  ctx.translate(x, y);

  const p = pose.phase;
  const lean = Math.sin(p * Math.PI) * 0.25;
  const arm = -0.4 + Math.sin(p * Math.PI * 2) * 1.2;

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(lean);

  // Shell
  ctx.fillStyle = COLORS.bowlerShell;
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.stroke();

  // Head / body nub
  ctx.fillStyle = COLORS.bowlerBody;
  ctx.beginPath();
  ctx.ellipse(16, -4, 12, 10, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Eye stalks
  ctx.strokeStyle = COLORS.bowlerBody;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(20, -10);
  ctx.lineTo(24, -22);
  ctx.moveTo(14, -12);
  ctx.lineTo(12, -24);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(24, -22, 4, 0, Math.PI * 2);
  ctx.arc(12, -24, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(25, -22, 1.8, 0, Math.PI * 2);
  ctx.arc(13, -24, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Bowling arm
  ctx.save();
  ctx.translate(10, -6);
  ctx.rotate(arm);
  ctx.strokeStyle = COLORS.bowlerBody;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(18, -8);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

export function drawFielder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  alert: number,
  time: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(time * 2.5 + x * 0.01) * 1.5;
  ctx.translate(0, bob - alert * 4);

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.bowlerShell;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.bowlerBody;
  ctx.beginPath();
  ctx.ellipse(10, -2, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(12, -4, 1.5, 0, Math.PI * 2);
  ctx.fill();

  if (alert > 0.3) {
    // Arms up for catch
    ctx.strokeStyle = COLORS.bowlerBody;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, -4);
    ctx.lineTo(0, -16);
    ctx.moveTo(8, -4);
    ctx.lineTo(14, -16);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawStumps(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  broken: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 3; i++) {
    const ox = (i - 1) * 8;
    ctx.save();
    if (broken > 0) {
      ctx.translate(ox, 0);
      ctx.rotate((i - 1) * broken * 0.9);
      ctx.translate(-ox, broken * 10);
    }
    ctx.fillStyle = COLORS.stump;
    ctx.fillRect(ox - 2.5, -36, 5, 40);
    // bails
    if (broken <= 0) {
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(ox - 4, -40, 8, 4);
    }
    ctx.restore();
  }
  if (broken <= 0) {
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(-12, -42, 24, 3);
  }
  ctx.restore();
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // shadow approximated by caller usually; small self shadow
  ctx.fillStyle = COLORS.ball;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.ballSeam;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 5, -0.8, 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 5, Math.PI - 0.8, Math.PI + 0.8);
  ctx.stroke();
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(-2.5, -2.5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBallShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  height: number,
): void {
  const s = Math.max(0.35, 1 - height / 180);
  ctx.fillStyle = `rgba(0,0,0,${0.2 * s})`;
  ctx.beginPath();
  ctx.ellipse(x, groundY + 8, 10 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawScoreboard(
  ctx: CanvasRenderingContext2D,
  score: number,
  high: number,
  balls: number,
): void {
  const w = 160;
  const h = 64;
  const x = 16;
  const y = 14;
  ctx.fillStyle = 'rgba(8,32,21,0.72)';
  ctx.strokeStyle = 'rgba(244,211,94,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 28px Segoe UI, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(String(score), x + 14, y + 36);

  ctx.fillStyle = 'rgba(246,255,248,0.75)';
  ctx.font = '12px Segoe UI, system-ui, sans-serif';
  ctx.fillText('RUNS', x + 14, y + 52);

  ctx.textAlign = 'right';
  ctx.fillText(`BEST ${high}`, x + w - 12, y + 28);
  ctx.fillText(`BALL ${balls}`, x + w - 12, y + 48);
  ctx.textAlign = 'left';
}

export function drawTitleBackdrop(ctx: CanvasRenderingContext2D, time: number): void {
  drawSky(ctx);
  drawCrowd(ctx, time, 0.2, false);
  drawField(ctx);
  drawStumps(ctx, FIELD.stumpX, FIELD.stumpY, 0);
  drawBowler(ctx, FIELD.bowlerX, FIELD.bowlerY, { phase: (time * 0.25) % 1 });
  drawBatter(ctx, FIELD.batterX, FIELD.batterY, { swingT: 0, celebrate: 0 });
  // Decorative ball
  const bx = FIELD.bowlerX + 80 + Math.sin(time) * 10;
  const by = FIELD.pitchTop + 20 + Math.abs(Math.sin(time * 2)) * 30;
  drawBallShadow(ctx, bx, FIELD.groundY - 20, FIELD.groundY - 20 - by);
  drawBall(ctx, bx, by);
}
