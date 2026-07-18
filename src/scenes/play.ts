import {
  CAMERA,
  COLORS,
  DIFFICULTY,
  FIELD,
  LOGICAL_H,
  LOGICAL_W,
  PHYSICS,
  TIMING,
} from '../config/constants';
import {
  drawBall,
  drawBallShadow,
  drawBatter,
  drawBowler,
  drawCrowd,
  drawField,
  drawFielder,
  drawScoreboard,
  drawSky,
  drawStumps,
} from '../assets/draw';
import { Camera } from '../engine/camera';
import { audio } from '../audio/audio';
import { VfxSystem } from '../entities/vfx';
import { clamp, easeOutCubic, lerp, randRange } from '../utils/math';
import { loadHighScore, saveHighScore } from '../utils/storage';

export type ShotResultKind =
  | 'miss'
  | 'edge'
  | 'one'
  | 'two'
  | 'four'
  | 'six'
  | 'bowled'
  | 'caught';

type Phase =
  | 'intro'
  | 'bowling'
  | 'flight'
  | 'hit_flight'
  | 'result'
  | 'out';

type Fielder = {
  x: number;
  y: number;
  catchR: number;
  alert: number;
};

export type PlayEvents = {
  onGameOver: (score: number, high: number) => void;
};

/**
 * Core match scene: bowl → swing timing → trajectory → score/out.
 * Camera is phase-driven for broadcast-style zoom/pan.
 */
export class PlayScene {
  score = 0;
  highScore = loadHighScore();
  deliveries = 0;
  private phase: Phase = 'intro';
  private phaseT = 0;
  private time = 0;
  private cheer = 0;

  private ball = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    active: false,
    bounced: false,
    height: 0,
  };

  private delivery: {
    speed: number;
    releaseT: number;
    idealContactT: number;
    bounceAtX: number;
    startX: number;
    startY: number;
    endX: number;
    flightDuration: number;
    elapsed: number;
  } = {
    speed: PHYSICS.baseDeliverySpeed,
    releaseT: 0.55,
    idealContactT: 0,
    bounceAtX: 0,
    startX: 0,
    startY: 0,
    endX: 0,
    flightDuration: 0,
    elapsed: 0,
  };

  private batterSwingT = 0;
  private swinging = false;
  private swungThisBall = false;
  private celebrate = 0;
  private bowlerPhase = 0;
  private stumpsBroken = 0;
  private lastResult: ShotResultKind | null = null;
  private resultRuns = 0;
  private resultHold: number = TIMING.resultHold;
  private windowScale = 1;
  private fielders: Fielder[] = [];
  private pendingOut: ShotResultKind | null = null;
  /** Delayed confetti ring for six celebrations. */
  private confettiT = -1;
  readonly vfx = new VfxSystem();
  private readonly camera: Camera;
  private readonly events: PlayEvents;
  private reducedMotion: boolean;

  constructor(camera: Camera, events: PlayEvents) {
    this.camera = camera;
    this.events = events;
    this.reducedMotion = camera.reducedMotion;
    this.resetMatch();
  }

  resetMatch(): void {
    this.score = 0;
    this.highScore = loadHighScore();
    this.deliveries = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.cheer = 0;
    this.stumpsBroken = 0;
    this.celebrate = 0;
    this.lastResult = null;
    this.resultHold = TIMING.resultHold;
    this.ball.active = false;
    this.confettiT = -1;
    this.vfx.clear();
    this.setupFielders();
    this.camera.reset(true);
  }

  private setupFielders(): void {
    this.fielders = [
      { x: 200, y: 340, catchR: 28, alert: 0 },
      { x: 140, y: 400, catchR: 30, alert: 0 },
      { x: 260, y: 300, catchR: 26, alert: 0 },
      { x: 100, y: 360, catchR: 28, alert: 0 },
      { x: 380, y: 320, catchR: 24, alert: 0 },
    ];
  }

  private difficultySpeed(): number {
    const s =
      PHYSICS.baseDeliverySpeed +
      Math.min(this.score * DIFFICULTY.speedPerScore, 180) +
      this.deliveries * DIFFICULTY.speedPerDelivery;
    return clamp(s, PHYSICS.baseDeliverySpeed, PHYSICS.maxDeliverySpeed);
  }

  private difficultyWindowScale(): number {
    return clamp(
      1 - this.score / DIFFICULTY.windowScoreFactor,
      DIFFICULTY.minWindowScale,
      1,
    );
  }

  private prepareDelivery(): void {
    this.deliveries += 1;
    this.phase = 'bowling';
    this.phaseT = 0;
    this.swinging = false;
    this.batterSwingT = 0;
    this.swungThisBall = false;
    this.bowlerPhase = 0;
    this.stumpsBroken = 0;
    this.pendingOut = null;
    this.lastResult = null;
    this.resultRuns = 0;
    this.resultHold = TIMING.resultHold;
    this.confettiT = -1;
    this.windowScale = this.difficultyWindowScale();

    const speed = this.difficultySpeed();
    const variance = clamp(
      this.score / DIFFICULTY.varianceScoreFactor,
      0,
      DIFFICULTY.maxVariance,
    );

    // Length variety: short / good / full
    const lengthRoll = Math.random();
    let bounceX: number;
    if (lengthRoll < 0.25 + variance * 0.1) {
      bounceX = randRange(480, 560); // short
    } else if (lengthRoll > 0.78 - variance * 0.1) {
      bounceX = randRange(640, 700); // full
    } else {
      bounceX = randRange(560, 640); // good length
    }

    const startX = FIELD.bowlerX + 28;
    const startY = FIELD.pitchTop + 8;
    const endX = FIELD.stumpX - 8;
    const contactX = FIELD.batterX - 18;
    const distToContact = contactX - startX;
    const flightDuration = distToContact / speed;

    this.delivery = {
      speed,
      releaseT: 0.45 + randRange(-0.04, 0.04),
      idealContactT: 0, // set when ball released
      bounceAtX: bounceX,
      startX,
      startY,
      endX,
      flightDuration,
      elapsed: 0,
    };

    this.ball.active = false;
    this.ball.bounced = false;
    this.ball.x = startX;
    this.ball.y = startY;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.height = 0;

    // Start bowl framing: mid pitch, gentle zoom-in
    this.camera.setTarget({
      x: lerp(FIELD.bowlerX, FIELD.batterX, 0.35),
      y: FIELD.pitchTop + 20,
      zoom: CAMERA.bowlZoomStart,
      posRate: CAMERA.lerpPos,
      zoomRate: CAMERA.lerpZoom,
    });
  }

  trySwing(): void {
    if (this.phase !== 'flight' && this.phase !== 'bowling') return;
    if (this.swungThisBall) return;
    // Only meaningful once ball is in flight (or very late in bowling)
    if (this.phase === 'bowling' && this.phaseT < this.delivery.releaseT) return;

    this.swungThisBall = true;
    this.swinging = true;
    this.batterSwingT = 0.001;

    if (this.phase === 'flight' && this.ball.active) {
      this.resolveSwing();
    }
  }

  private resolveSwing(): void {
    const ideal = this.delivery.idealContactT;
    const now = this.delivery.elapsed;
    const err = now - ideal;
    const abs = Math.abs(err);
    const pw = TIMING.perfectWindow * this.windowScale;
    const gw = TIMING.goodWindow * this.windowScale;
    const ew = TIMING.edgeWindow * this.windowScale;

    // Contact must be near the bat in space as well
    const batX = FIELD.batterX - 10;
    const batY = FIELD.batterY - 10;
    const d = Math.hypot(this.ball.x - batX, this.ball.y - batY);
    const inReach = d < 70 || this.ball.x > batX - 40;

    if (!inReach || abs > ew) {
      // Whiff — ball continues; may be bowled
      this.lastResult = 'miss';
      return;
    }

    let quality: 'perfect' | 'good' | 'edge';
    if (abs <= pw) quality = 'perfect';
    else if (abs <= gw) quality = 'good';
    else quality = 'edge';

    // Late swing (err > 0) tends to loft more in our model (satisfying sixes).
    // Early (err < 0) drives lower/harder.
    const loftBias = clamp(err / ew, -1, 1);
    let power: number;
    let angle: number; // radians, leftward shot (negative x)

    if (quality === 'perfect') {
      power = randRange(560, 680);
      // Aim into the left outfield with playable loft.
      angle = Math.PI - randRange(0.28, 0.48);
    } else if (quality === 'good') {
      power = randRange(420, 540);
      angle = Math.PI - randRange(0.18, 0.42);
    } else {
      power = randRange(200, 300);
      angle = Math.PI - randRange(0.05, 0.3) + randRange(-0.25, 0.2);
    }

    // Late contact adds loft (sixes); early contact stays flatter (drives/fours).
    const loft = quality === 'edge'
      ? 0.15
      : clamp(0.42 + loftBias * 0.35 + (quality === 'perfect' ? 0.08 : 0), 0.2, 0.95);

    this.ball.vx = Math.cos(angle) * power;
    this.ball.vy = -Math.sin(Math.PI * loft * 0.5) * power * 0.95;
    if (quality === 'edge') {
      this.ball.vx *= 0.5;
      this.ball.vy = randRange(-60, 20);
      this.lastResult = 'edge';
    }

    this.ball.active = true;
    this.phase = 'hit_flight';
    this.phaseT = 0;
    audio.batHit(quality === 'perfect' ? 1 : quality === 'good' ? 0.8 : 0.45);
    this.camera.addShake(quality === 'perfect' ? 1.2 : 0.6);
    this.vfx.burst(this.ball.x, this.ball.y, '#fff', quality === 'edge' ? 6 : 14, this.reducedMotion);

    // Contact punch zoom on the bat zone
    this.camera.setTarget({
      x: this.ball.x,
      y: this.ball.y,
      zoom: quality === 'edge' ? CAMERA.flightZoom : CAMERA.hitPunchZoom,
      posRate: CAMERA.hitLerpPos,
      zoomRate: CAMERA.hitLerpZoom,
    });

    if (quality !== 'edge') {
      // Tentative — refined when ball ends
      this.lastResult = null;
    }
  }

  update(dt: number, swingPressed: boolean): void {
    this.time += dt;
    this.cheer = Math.max(0, this.cheer - dt * 0.55);
    this.celebrate = Math.max(0, this.celebrate - dt);
    this.vfx.update(dt);

    if (this.confettiT >= 0) {
      this.confettiT -= dt;
      if (this.confettiT <= 0) {
        this.confettiT = -1;
        this.vfx.confetti(
          clamp(this.ball.x, 60, 420),
          clamp(this.ball.y, 70, 320),
          28,
          this.reducedMotion,
        );
      }
    }

    if (swingPressed) this.trySwing();

    if (this.swinging) {
      this.batterSwingT += dt / TIMING.swingDuration;
      if (this.batterSwingT >= 1) {
        this.batterSwingT = 0;
        this.swinging = false;
      }
    }

    for (const f of this.fielders) {
      f.alert = Math.max(0, f.alert - dt);
    }

    switch (this.phase) {
      case 'intro':
        this.phaseT += dt;
        this.camera.setTarget({
          x: LOGICAL_W / 2,
          y: LOGICAL_H / 2,
          zoom: CAMERA.restZoom,
        });
        if (this.phaseT > 0.4) this.prepareDelivery();
        break;
      case 'bowling':
        this.updateBowling(dt);
        break;
      case 'flight':
        this.updatePreHitFlight(dt);
        break;
      case 'hit_flight':
        this.updateHitFlight(dt);
        break;
      case 'result':
        this.phaseT += dt;
        this.updateResultCamera();
        if (this.phaseT >= this.resultHold) {
          this.prepareDelivery();
        }
        break;
      case 'out':
        this.phaseT += dt;
        if (this.stumpsBroken > 0) {
          this.stumpsBroken = Math.min(1, this.stumpsBroken + dt * 2);
        }
        if (this.phaseT >= TIMING.outHold) {
          const high = saveHighScore(this.score);
          this.highScore = high;
          this.events.onGameOver(this.score, high);
        }
        break;
    }
  }

  private updateBowling(dt: number): void {
    this.phaseT += dt;
    const p = clamp(this.phaseT / this.delivery.releaseT, 0, 1);
    this.bowlerPhase = p;

    // Zoom in through the run-up; look drifts toward the pitch corridor
    const lookX = lerp(FIELD.bowlerX + 40, FIELD.batterX - 80, p * 0.55);
    const lookY = lerp(FIELD.bowlerY - 10, FIELD.pitchTop + 10, p * 0.4);
    const zoom = lerp(CAMERA.bowlZoomStart, CAMERA.bowlZoomEnd, p);
    this.camera.setTarget({
      x: lookX,
      y: lookY,
      zoom,
      posRate: CAMERA.lerpPos,
      zoomRate: CAMERA.lerpZoom,
    });

    if (this.phaseT >= this.delivery.releaseT) {
      // Release ball
      this.ball.active = true;
      this.ball.x = this.delivery.startX;
      this.ball.y = this.delivery.startY;
      this.ball.vx = this.delivery.speed;
      this.ball.vy = 0;
      this.ball.bounced = false;
      this.delivery.elapsed = 0;
      // Ideal contact when ball reaches bat zone
      const contactX = FIELD.batterX - 18;
      this.delivery.idealContactT =
        (contactX - this.delivery.startX) / this.delivery.speed;
      this.phase = 'flight';
      this.phaseT = 0;

      // If player already swung extremely early during late bowling, resolve if possible
      if (this.swungThisBall && this.swinging) {
        // wait until closer
      }
    }
  }

  private updatePreHitFlight(dt: number): void {
    this.delivery.elapsed += dt;
    this.bowlerPhase = clamp(0.5 + this.delivery.elapsed * 0.3, 0, 1);

    // Horizontal motion
    this.ball.x += this.delivery.speed * dt;

    // Height via bounce model
    const bounceX = this.delivery.bounceAtX;
    const ground = FIELD.pitchTop + 12;
    if (!this.ball.bounced && this.ball.x >= bounceX) {
      this.ball.bounced = true;
    }

    if (!this.ball.bounced) {
      // Descending toward bounce
      const t = clamp(
        (this.ball.x - this.delivery.startX) / (bounceX - this.delivery.startX),
        0,
        1,
      );
      this.ball.y = lerp(this.delivery.startY, ground, t * t);
    } else {
      // Post bounce rise and fall toward bat
      const t = clamp(
        (this.ball.x - bounceX) / (FIELD.batterX - bounceX),
        0,
        1,
      );
      const bounceH = 28 + (1 - this.windowScale) * 10;
      this.ball.y = ground - Math.sin(t * Math.PI) * bounceH * (1 - t * 0.35);
    }

    // Tight framing on the contest: bias look toward ball as it nears the bat
    const approach = clamp(
      (this.ball.x - this.delivery.startX) /
        (FIELD.batterX - this.delivery.startX),
      0,
      1,
    );
    const lookX = lerp(this.ball.x, FIELD.batterX - 20, 0.35 + approach * 0.35);
    const lookY = lerp(this.ball.y, FIELD.batterY - 20, 0.4);
    this.camera.setTarget({
      x: lookX,
      y: lookY,
      zoom: CAMERA.flightZoom,
      posRate: CAMERA.lerpPos + 2,
      zoomRate: CAMERA.lerpZoom,
    });

    // Late swing resolve if swung while ball approaching
    if (this.swungThisBall && this.swinging && this.phase === 'flight') {
      const batX = FIELD.batterX - 10;
      if (this.ball.x >= batX - 50 && this.ball.x <= batX + 30) {
        this.resolveSwing();
        return;
      }
    }

    // Past stumps without solid contact → bowled
    if (this.ball.x >= FIELD.stumpX - 4) {
      this.triggerOut('bowled');
    }
  }

  private updateHitFlight(dt: number): void {
    this.phaseT += dt;
    this.ball.vy += PHYSICS.gravity * dt;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    const groundY = FIELD.groundY - 30;

    // Ground bounce / roll
    if (this.ball.y >= groundY) {
      this.ball.y = groundY;
      if (Math.abs(this.ball.vy) > 40) {
        this.ball.vy *= -PHYSICS.bounceRestitution;
        this.ball.vx *= PHYSICS.groundFriction;
      } else {
        this.ball.vy = 0;
        this.ball.vx *= 0.9;
      }
    }

    // Catch check while lofted (generous miss-space for fun arcade feel)
    const height = groundY - this.ball.y;
    if (height > 18 && height < 100 && this.ball.vy > -40) {
      for (const f of this.fielders) {
        const d = Math.hypot(this.ball.x - f.x, this.ball.y - (f.y - 8));
        // Smaller effective radius so clean hits clear more often
        if (d < f.catchR * 0.85) {
          f.alert = 1;
          this.triggerOut('caught');
          return;
        }
      }
    }

    // Follow the ball; start opening out on lofted power shots
    const speed = Math.hypot(this.ball.vx, this.ball.vy);
    const lofted = height > 50 || this.ball.vy < -120;
    const zoom = lofted
      ? lerp(CAMERA.hitPunchZoom, CAMERA.sixZoom, clamp(this.phaseT / 0.9, 0, 1))
      : lerp(CAMERA.hitPunchZoom, CAMERA.hitFollowZoom, clamp(this.phaseT / 0.55, 0, 1));
    this.camera.setTarget({
      x: clamp(this.ball.x, CAMERA.lookMinX, CAMERA.lookMaxX),
      y: clamp(this.ball.y - (lofted ? 30 : 0), CAMERA.lookMinY, CAMERA.lookMaxY),
      zoom,
      posRate: CAMERA.hitLerpPos,
      zoomRate: CAMERA.hitLerpZoom,
    });

    // Boundary checks (left outfield)
    const boundary = this.hitBoundary();
    if (boundary === 6) {
      this.finishShot('six', 6);
      return;
    }
    if (boundary === 4) {
      this.finishShot('four', 4);
      return;
    }

    // Ball nearly stopped in field
    if (
      this.phaseT > 0.35 &&
      speed < 35 &&
      this.ball.y >= groundY - 2
    ) {
      const distTravel = FIELD.batterX - this.ball.x;
      if (distTravel > 280) this.finishShot('two', 2);
      else if (this.lastResult === 'edge') this.finishShot('edge', 1);
      else this.finishShot('one', 1);
      return;
    }

    // Safety timeout
    if (this.phaseT > 2.8) {
      const distTravel = FIELD.batterX - this.ball.x;
      if (distTravel > 320) this.finishShot('two', 2);
      else this.finishShot('one', 1);
    }

    // Off left edge of screen high = six
    if (this.ball.x < -20 && this.ball.y < groundY - FIELD.sixClearHeight) {
      this.finishShot('six', 6);
    } else if (this.ball.x < FIELD.boundaryX && this.ball.y >= groundY - 5) {
      this.finishShot('four', 4);
    }
  }

  private updateResultCamera(): void {
    if (this.lastResult === 'six') {
      this.camera.setTarget({
        x: clamp(this.ball.x, 60, 360),
        y: clamp(this.ball.y - 40, CAMERA.lookMinY, 280),
        zoom: CAMERA.sixZoom,
        posRate: 5,
        zoomRate: 4,
      });
    } else if (this.lastResult === 'four') {
      this.camera.setTarget({
        x: clamp(this.ball.x, 80, 280),
        y: FIELD.groundY - 50,
        zoom: CAMERA.fourZoom,
        posRate: 6,
        zoomRate: 5,
      });
    } else {
      // Quiet singles — ease back to rest
      this.camera.setTarget({
        x: LOGICAL_W / 2,
        y: LOGICAL_H / 2,
        zoom: CAMERA.restZoom,
        posRate: CAMERA.lerpPos,
        zoomRate: CAMERA.lerpZoom,
      });
    }
  }

  private hitBoundary(): 0 | 4 | 6 {
    // Ellipse boundary approx: center 0.48*W, 430, rx 500, ry 138
    const cx = LOGICAL_W * 0.48;
    const cy = 430;
    const rx = 500;
    const ry = 138;
    const nx = (this.ball.x - cx) / rx;
    const ny = (this.ball.y - cy) / ry;
    const e = nx * nx + ny * ny;
    if (e < 1) return 0;
    const groundY = FIELD.groundY - 30;
    const height = groundY - this.ball.y;
    // Only count as boundary if ball is on left half (scoring direction)
    if (this.ball.x > FIELD.batterX - 40) return 0;
    if (height > FIELD.sixClearHeight * 0.55 && this.ball.vy < 80) return 6;
    if (this.ball.y >= groundY - 15 || height < 20) return 4;
    // still flying outside ellipse high
    if (height > 40) return 6;
    return 4;
  }

  private finishShot(kind: ShotResultKind, runs: number): void {
    this.lastResult = kind;
    this.resultRuns = runs;
    this.score += runs;
    this.phase = 'result';
    this.phaseT = 0;
    this.ball.active = kind === 'six' || kind === 'four'; // may continue offscreen briefly

    if (kind === 'six') {
      this.resultHold = TIMING.resultHoldSix;
      this.cheer = 1.35;
      this.celebrate = 2.1;
      audio.cheerBig();
      this.camera.addShake(1.85);
      this.camera.setTarget({
        x: clamp(this.ball.x, 60, 360),
        y: clamp(this.ball.y - 50, CAMERA.lookMinY, 260),
        zoom: CAMERA.sixZoom,
        posRate: CAMERA.hitLerpPos,
        zoomRate: CAMERA.hitLerpZoom,
      });
      this.vfx.float(FIELD.batterX - 40, FIELD.batterY - 90, 'SIX!', COLORS.accent, {
        life: 1.8,
        size: 40,
        vy: -48,
      });
      this.vfx.float(FIELD.batterX - 40, FIELD.batterY - 50, '+6', '#fff', {
        life: 1.4,
        size: 26,
        vy: -32,
      });
      this.vfx.burst(
        clamp(this.ball.x, 40, 400),
        clamp(this.ball.y, 80, 360),
        '#f4d35e',
        32,
        this.reducedMotion,
        { speedMin: 80, speedMax: 280, life: 1.1 },
      );
      this.vfx.confetti(
        clamp(this.ball.x, 50, 420),
        clamp(this.ball.y, 70, 340),
        48,
        this.reducedMotion,
      );
      this.confettiT = 0.28;
    } else if (kind === 'four') {
      this.resultHold = TIMING.resultHoldFour;
      this.cheer = 1;
      this.celebrate = 1.35;
      audio.cheer(0.85);
      this.camera.addShake(1.1);
      this.camera.setTarget({
        x: clamp(this.ball.x, 80, 280),
        y: FIELD.groundY - 45,
        zoom: CAMERA.fourZoom,
        posRate: CAMERA.hitLerpPos,
        zoomRate: CAMERA.hitLerpZoom,
      });
      this.vfx.float(FIELD.batterX - 40, FIELD.batterY - 80, 'FOUR!', '#fff', {
        life: 1.35,
        size: 34,
        vy: -42,
      });
      this.vfx.burst(
        clamp(this.ball.x, 40, 400),
        clamp(this.ball.y, 80, 360),
        '#fff',
        20,
        this.reducedMotion,
        { speedMin: 70, speedMax: 240, life: 0.9 },
      );
      this.vfx.confetti(
        clamp(this.ball.x, 50, 400),
        clamp(this.ball.y, 100, 360),
        18,
        this.reducedMotion,
      );
    } else {
      this.resultHold = TIMING.resultHold;
      const label =
        kind === 'two' ? '+2' : kind === 'edge' ? 'EDGE +1' : '+1';
      this.vfx.float(FIELD.batterX - 40, FIELD.batterY - 80, label, COLORS.accent);
      audio.cheer(0.25);
      this.camera.setTarget({
        x: LOGICAL_W / 2,
        y: LOGICAL_H / 2,
        zoom: CAMERA.restZoom,
        posRate: CAMERA.lerpPos,
        zoomRate: CAMERA.lerpZoom,
      });
    }
  }

  private triggerOut(kind: 'bowled' | 'caught'): void {
    this.lastResult = kind;
    this.phase = 'out';
    this.phaseT = 0;
    this.pendingOut = kind;
    audio.wicket();
    this.camera.addShake(1.4);
    if (kind === 'bowled') {
      this.stumpsBroken = 0.05;
      this.vfx.float(FIELD.stumpX, FIELD.stumpY - 60, 'BOWLED!', COLORS.danger);
      this.camera.setTarget({
        x: FIELD.stumpX - 20,
        y: FIELD.stumpY - 20,
        zoom: CAMERA.outZoom,
        posRate: CAMERA.hitLerpPos,
        zoomRate: CAMERA.hitLerpZoom,
      });
    } else {
      this.vfx.float(this.ball.x, this.ball.y - 30, 'CAUGHT!', '#e76f51');
      for (const f of this.fielders) {
        const d = Math.hypot(this.ball.x - f.x, this.ball.y - f.y);
        if (d < 80) f.alert = 1;
      }
      this.camera.setTarget({
        x: this.ball.x,
        y: this.ball.y,
        zoom: CAMERA.outZoom,
        posRate: CAMERA.hitLerpPos,
        zoomRate: CAMERA.hitLerpZoom,
      });
    }
    this.ball.active = false;
  }

  /**
   * World layers (affected by camera). HUD is drawn separately in screen space.
   */
  drawWorld(ctx: CanvasRenderingContext2D): void {
    drawSky(ctx);
    drawCrowd(ctx, this.time, this.cheer, this.reducedMotion);
    drawField(ctx);

    for (const f of this.fielders) {
      drawFielder(ctx, f.x, f.y, f.alert, this.time);
    }

    drawStumps(ctx, FIELD.stumpX, FIELD.stumpY, this.stumpsBroken);
    drawBowler(ctx, FIELD.bowlerX, FIELD.bowlerY, { phase: this.bowlerPhase });

    const groundY = FIELD.groundY - 30;
    if (this.ball.active || this.phase === 'flight' || this.phase === 'hit_flight') {
      const h = Math.max(0, groundY - this.ball.y);
      drawBallShadow(ctx, this.ball.x, groundY, h);
      drawBall(ctx, this.ball.x, this.ball.y);
    }

    drawBatter(ctx, FIELD.batterX, FIELD.batterY, {
      swingT: this.swinging ? this.batterSwingT : 0,
      celebrate: this.celebrate,
    });

    this.vfx.draw(ctx);

    // Timing coach ring during flight (world space near batter)
    if (this.phase === 'flight' && this.ball.active) {
      const idealX =
        this.delivery.startX + this.delivery.speed * this.delivery.idealContactT;
      const prog = clamp(
        1 - Math.abs(this.ball.x - idealX) / 80,
        0,
        1,
      );
      ctx.strokeStyle = `rgba(244,211,94,${0.15 + prog * 0.35})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(FIELD.batterX - 12, FIELD.batterY - 8, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Screen-space UI: scoreboard, banners, vignette — not zoomed with the pitch. */
  drawHud(ctx: CanvasRenderingContext2D): void {
    drawScoreboard(ctx, this.score, this.highScore, this.deliveries);

    // Result banner
    if (this.phase === 'result' && this.lastResult) {
      if (this.lastResult === 'six') {
        this.drawBanner(ctx, 'SIX!', COLORS.accent, {
          size: 64,
          pop: true,
          subtitle: 'BOUNDARY!',
        });
      } else if (this.lastResult === 'four') {
        this.drawBanner(ctx, 'FOUR!', '#fff', {
          size: 54,
          pop: true,
          subtitle: 'ALONG THE GROUND',
        });
      } else {
        this.drawBanner(ctx, `+${this.resultRuns}`);
      }
    }
    if (this.phase === 'out' && this.pendingOut) {
      this.drawBanner(
        ctx,
        this.pendingOut === 'bowled' ? 'BOWLED!' : 'CAUGHT!',
        '#e76f51',
      );
    }

    // Dim vignette edges
    const vg = ctx.createRadialGradient(
      LOGICAL_W / 2,
      LOGICAL_H / 2,
      200,
      LOGICAL_W / 2,
      LOGICAL_H / 2,
      560,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  /** @deprecated Prefer drawWorld + drawHud; kept for any external callers. */
  draw(ctx: CanvasRenderingContext2D): void {
    this.drawWorld(ctx);
    this.drawHud(ctx);
  }

  private drawBanner(
    ctx: CanvasRenderingContext2D,
    text: string,
    color: string = COLORS.accent,
    opts?: { size?: number; pop?: boolean; subtitle?: string },
  ): void {
    const size = opts?.size ?? 48;
    const popT = opts?.pop ? easeOutCubic(clamp(this.phaseT / 0.28, 0, 1)) : 1;
    const scale = opts?.pop ? 0.65 + popT * 0.45 : 1;
    const alpha = clamp(this.phaseT < 0.08 ? this.phaseT / 0.08 : 1, 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(LOGICAL_W / 2, 118);
    ctx.scale(scale, scale);

    // Soft glow for big hits
    if (opts?.pop) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 22;
    }

    ctx.font = `bold ${size}px Segoe UI, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(text, 2, 2);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);

    ctx.shadowBlur = 0;
    if (opts?.subtitle && this.phaseT < 1.1) {
      const subA = clamp(1 - (this.phaseT - 0.35) / 0.75, 0, 1) * alpha;
      ctx.globalAlpha = subA;
      ctx.font = 'bold 18px Segoe UI, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(opts.subtitle, 0, 32);
    }

    ctx.restore();
  }
}
