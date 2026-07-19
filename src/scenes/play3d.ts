import * as THREE from 'three';
import {
  CAM3D,
  DIFFICULTY,
  FIELD3D,
  PHYSICS,
  TIMING,
} from '../config/constants';
import { audio } from '../audio/audio';
import { Camera3D } from '../world/camera3d';
import {
  breakStumps,
  createBug,
  createStumps,
  setBatSwing,
  setBowlerPhase,
  setCelebrate,
} from '../world/bugs';
import { buildStadium, createBall } from '../world/stadium';
import { Fx3D } from '../world/fx3d';
import { clamp, lerp, randRange } from '../utils/math';
import { loadHighScore, saveHighScore } from '../utils/storage';

export type PlayEvents = {
  onGameOver: (score: number, high: number) => void;
  onHud?: (score: number, high: number, balls: number, banner: string | null) => void;
};

type Phase =
  | 'intro'
  | 'bowling'
  | 'flight'
  | 'hit_flight'
  | 'result'
  | 'out';

type ShotKind = 'dead' | 'four' | 'six' | 'bowled' | 'caught';

/**
 * 3D match: two batting bugs (no run chase UI), score only on boundaries.
 */
export class PlayScene3D {
  readonly scene = new THREE.Scene();
  score = 0;
  highScore = loadHighScore();
  deliveries = 0;

  private phase: Phase = 'intro';
  private phaseT = 0;
  private time = 0;
  private celebrate = 0;
  private cheer = 0;
  private resultHold: number = TIMING.deadBallHold;
  private lastShot: ShotKind | null = null;
  private banner: string | null = null;
  private windowScale = 1;
  private swungThisBall = false;
  private swinging = false;
  private batterSwingT = 0;
  private bowlerPhase = 0;
  private confettiDelay = -1;
  private reducedMotion: boolean;

  private readonly cam: Camera3D;
  private readonly events: PlayEvents;
  private readonly fx = new Fx3D();

  private readonly striker: THREE.Group;
  private readonly partner: THREE.Group;
  private readonly bowler: THREE.Group;
  private readonly fielders: THREE.Group[] = [];
  private readonly stumpStriker: THREE.Group;
  private readonly stumpBowler: THREE.Group;
  private readonly ball: THREE.Mesh;
  private readonly shadow: THREE.Mesh;

  private ballPos = new THREE.Vector3();
  private ballVel = new THREE.Vector3();
  private ballActive = false;

  private delivery: {
    speed: number;
    releaseT: number;
    idealContactT: number;
    bounceAtZ: number;
    start: THREE.Vector3;
    elapsed: number;
  } = {
    speed: PHYSICS.baseDeliverySpeed,
    releaseT: 0.5,
    idealContactT: 0,
    bounceAtZ: 0,
    start: new THREE.Vector3(),
    elapsed: 0,
  };

  constructor(cam: Camera3D, events: PlayEvents) {
    this.cam = cam;
    this.events = events;
    this.reducedMotion = cam.reducedMotion;

    // Lights
    const hemi = new THREE.HemisphereLight(0xbfe9ff, 0x2d6a4f, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.15);
    sun.position.set(12, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.22));

    this.scene.add(buildStadium());
    this.scene.add(this.fx.group);

    this.striker = createBug('striker', 1.05);
    this.striker.position.set(FIELD3D.strikerX, 0, FIELD3D.strikerZ);
    this.striker.rotation.y = Math.PI; // face bowler (-Z)
    this.scene.add(this.striker);

    // Second batting-side player — stays at non-striker end (no run animation / no run count)
    this.partner = createBug('partner', 1);
    this.partner.position.set(FIELD3D.partnerX, 0, FIELD3D.partnerZ);
    this.partner.rotation.y = 0;
    this.scene.add(this.partner);

    this.bowler = createBug('bowler', 1.05);
    this.bowler.position.set(FIELD3D.bowlerX, 0, FIELD3D.bowlerStartZ);
    this.bowler.rotation.y = 0; // faces +Z toward striker
    this.scene.add(this.bowler);

    this.stumpStriker = createStumps(false);
    this.stumpStriker.position.set(0, 0, FIELD3D.stumpStrikerZ);
    this.scene.add(this.stumpStriker);

    this.stumpBowler = createStumps(true);
    this.stumpBowler.position.set(0, 0, FIELD3D.stumpBowlerZ);
    this.scene.add(this.stumpBowler);

    const spots = [
      [-8, 4],
      [-12, -2],
      [7, 3],
      [-6, -8],
      [10, -5],
      [-14, 6],
    ];
    for (const [x, z] of spots) {
      const f = createBug('fielder', 0.85 + Math.random() * 0.15);
      f.position.set(x!, 0, z!);
      f.lookAt(0, 0, 0);
      this.fielders.push(f);
      this.scene.add(f);
    }

    this.ball = createBall();
    this.ball.visible = false;
    this.scene.add(this.ball);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 16),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.03;
    this.shadow.visible = false;
    this.scene.add(this.shadow);

    this.resetMatch();
  }

  resetMatch(): void {
    this.score = 0;
    this.highScore = loadHighScore();
    this.deliveries = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.celebrate = 0;
    this.cheer = 0;
    this.lastShot = null;
    this.banner = null;
    this.ballActive = false;
    this.ball.visible = false;
    this.shadow.visible = false;
    this.fx.clear();
    this.cam.reset(true);
    this.pushHud();
  }

  private pushHud(): void {
    this.events.onHud?.(this.score, this.highScore, this.deliveries, this.banner);
  }

  private difficultySpeed(): number {
    const s =
      PHYSICS.baseDeliverySpeed +
      Math.min(this.score * DIFFICULTY.speedPerScore, 12) +
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
    this.swungThisBall = false;
    this.swinging = false;
    this.batterSwingT = 0;
    this.bowlerPhase = 0;
    this.lastShot = null;
    this.banner = null;
    this.resultHold = TIMING.deadBallHold;
    this.windowScale = this.difficultyWindowScale();
    breakStumps(this.stumpStriker, 0);

    const speed = this.difficultySpeed();
    const variance = clamp(
      this.score / DIFFICULTY.varianceScoreFactor,
      0,
      DIFFICULTY.maxVariance,
    );
    // Bounce length along pitch (z)
    let bounceZ: number;
    const roll = Math.random();
    if (roll < 0.25 + variance * 0.1) bounceZ = randRange(2, 5); // short
    else if (roll > 0.78 - variance * 0.1) bounceZ = randRange(7.5, 9); // full
    else bounceZ = randRange(5, 7.5);

    this.delivery = {
      speed,
      releaseT: 0.48 + randRange(-0.04, 0.04),
      idealContactT: 0,
      bounceAtZ: bounceZ,
      start: new THREE.Vector3(0.05, 1.15, FIELD3D.bowlerReleaseZ),
      elapsed: 0,
    };

    this.bowler.position.set(FIELD3D.bowlerX, 0, FIELD3D.bowlerStartZ);
    this.ballActive = false;
    this.ball.visible = false;
    this.shadow.visible = false;

    this.cam.setPose({
      pos: CAM3D.bowl.pos,
      look: CAM3D.bowl.look,
      lerp: CAM3D.lerp,
    });
    this.pushHud();
  }

  trySwing(): void {
    if (this.phase !== 'flight' && this.phase !== 'bowling') return;
    if (this.swungThisBall) return;
    if (this.phase === 'bowling' && this.phaseT < this.delivery.releaseT) return;

    this.swungThisBall = true;
    this.swinging = true;
    this.batterSwingT = 0.001;

    if (this.phase === 'flight' && this.ballActive) {
      this.resolveSwing();
    }
  }

  private resolveSwing(): void {
    const err = this.delivery.elapsed - this.delivery.idealContactT;
    const abs = Math.abs(err);
    const pw = TIMING.perfectWindow * this.windowScale;
    const gw = TIMING.goodWindow * this.windowScale;
    const ew = TIMING.edgeWindow * this.windowScale;

    const bat = new THREE.Vector3(FIELD3D.strikerX, 1.0, FIELD3D.strikerZ);
    const d = this.ballPos.distanceTo(bat);
    const inReach = d < 1.8 || this.ballPos.z > FIELD3D.strikerZ - 1.6;

    if (!inReach || abs > ew) {
      return; // miss — may be bowled
    }

    let quality: 'perfect' | 'good' | 'edge';
    if (abs <= pw) quality = 'perfect';
    else if (abs <= gw) quality = 'good';
    else quality = 'edge';

    const loftBias = clamp(err / ew, -1, 1);
    let power: number;
    if (quality === 'perfect') power = randRange(22, 28);
    else if (quality === 'good') power = randRange(16, 22);
    else power = randRange(8, 12);

    // Shoot into -X / -Z outfield (toward camera-left boundary)
    const yaw = Math.PI + randRange(-0.55, 0.35); // mostly -X with some -Z
    const loft =
      quality === 'edge'
        ? 0.12
        : clamp(0.38 + loftBias * 0.32 + (quality === 'perfect' ? 0.1 : 0), 0.18, 0.92);

    this.ballVel.set(
      Math.sin(yaw) * power,
      Math.sin(loft * Math.PI * 0.5) * power * 0.95,
      Math.cos(yaw) * power * 0.35,
    );
    if (quality === 'edge') {
      this.ballVel.multiplyScalar(0.45);
      this.ballVel.y = randRange(-1, 2);
    }

    this.ballActive = true;
    this.ball.visible = true;
    this.phase = 'hit_flight';
    this.phaseT = 0;
    audio.batHit(quality === 'perfect' ? 1 : quality === 'good' ? 0.8 : 0.45);
    this.cam.addShake(quality === 'perfect' ? 1.1 : 0.55);
    this.fx.burst(this.ballPos.clone(), 0xffffff, quality === 'edge' ? 8 : 16, this.reducedMotion);
    this.cam.setPose({
      pos: CAM3D.punch.pos,
      look: [this.ballPos.x, this.ballPos.y, this.ballPos.z],
      lerp: CAM3D.hitLerp,
    });
  }

  update(dt: number, swingPressed: boolean): void {
    this.time += dt;
    this.celebrate = Math.max(0, this.celebrate - dt);
    this.cheer = Math.max(0, this.cheer - dt * 0.5);
    this.fx.update(dt);

    if (this.confettiDelay >= 0) {
      this.confettiDelay -= dt;
      if (this.confettiDelay <= 0) {
        this.confettiDelay = -1;
        this.fx.confetti(this.ballPos.clone(), 30, this.reducedMotion);
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
    setBatSwing(this.striker, this.swinging ? this.batterSwingT : 0);
    setCelebrate(this.striker, this.celebrate, this.time);
    // Partner only does a light hop on big celebrations — never runs
    setCelebrate(this.partner, this.celebrate * 0.55, this.time + 0.4);

    // Subtle idle on fielders
    for (let i = 0; i < this.fielders.length; i++) {
      const f = this.fielders[i]!;
      f.position.y = Math.sin(this.time * 2 + i) * 0.03;
    }

    switch (this.phase) {
      case 'intro':
        this.phaseT += dt;
        this.cam.setPose({ pos: CAM3D.rest.pos, look: CAM3D.rest.look });
        if (this.phaseT > 0.45) this.prepareDelivery();
        break;
      case 'bowling':
        this.updateBowling(dt);
        break;
      case 'flight':
        this.updatePreHit(dt);
        break;
      case 'hit_flight':
        this.updateHitFlight(dt);
        break;
      case 'result':
        this.phaseT += dt;
        this.updateResultCam();
        if (this.phaseT >= this.resultHold) {
          this.banner = null;
          this.prepareDelivery();
        }
        break;
      case 'out':
        this.phaseT += dt;
        if (this.lastShot === 'bowled') {
          breakStumps(this.stumpStriker, clamp(this.phaseT * 1.5, 0, 1));
        }
        if (this.phaseT >= TIMING.outHold) {
          const high = saveHighScore(this.score);
          this.highScore = high;
          this.events.onGameOver(this.score, high);
        }
        break;
    }

    this.syncBallVisual();
    this.pushHud();
  }

  private syncBallVisual(): void {
    if (!this.ballActive && this.phase !== 'flight' && this.phase !== 'hit_flight') {
      this.ball.visible = false;
      this.shadow.visible = false;
      return;
    }
    this.ball.visible = this.ballActive || this.phase === 'flight';
    this.ball.position.copy(this.ballPos);
    this.ball.rotation.x += 0.2;
    this.shadow.visible = this.ball.visible;
    this.shadow.position.set(this.ballPos.x, 0.03, this.ballPos.z);
    const h = Math.max(0, this.ballPos.y);
    const s = clamp(0.35 + h * 0.08, 0.25, 1.2);
    this.shadow.scale.setScalar(s);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = clamp(0.35 - h * 0.03, 0.08, 0.35);
  }

  private updateBowling(dt: number): void {
    this.phaseT += dt;
    const p = clamp(this.phaseT / this.delivery.releaseT, 0, 1);
    this.bowlerPhase = p;
    this.bowler.position.z = lerp(FIELD3D.bowlerStartZ, FIELD3D.bowlerReleaseZ, p);
    setBowlerPhase(this.bowler, p);

    this.cam.setPose({
      pos: [
        lerp(CAM3D.bowl.pos[0], CAM3D.flight.pos[0], p * 0.35),
        lerp(CAM3D.bowl.pos[1], CAM3D.flight.pos[1], p * 0.35),
        lerp(CAM3D.bowl.pos[2], -2, p),
      ],
      look: [
        0,
        lerp(1, 1.1, p),
        lerp(FIELD3D.bowlerReleaseZ, FIELD3D.strikerZ * 0.4, p),
      ],
      lerp: CAM3D.lerp,
    });

    if (this.phaseT >= this.delivery.releaseT) {
      this.ballActive = true;
      this.ballPos.copy(this.delivery.start);
      this.ballVel.set(0, 0, this.delivery.speed);
      this.delivery.elapsed = 0;
      const contactZ = FIELD3D.strikerZ - 0.3;
      this.delivery.idealContactT =
        (contactZ - this.delivery.start.z) / this.delivery.speed;
      this.phase = 'flight';
      this.phaseT = 0;
    }
  }

  private updatePreHit(dt: number): void {
    this.delivery.elapsed += dt;
    this.bowlerPhase = clamp(0.5 + this.delivery.elapsed * 0.25, 0, 1);
    setBowlerPhase(this.bowler, this.bowlerPhase);

    this.ballPos.z += this.delivery.speed * dt;

    const bounceZ = this.delivery.bounceAtZ;
    const ground = 0.12;
    if (this.ballPos.z < bounceZ) {
      const t = clamp(
        (this.ballPos.z - this.delivery.start.z) / (bounceZ - this.delivery.start.z),
        0,
        1,
      );
      this.ballPos.y = lerp(this.delivery.start.y, ground, t * t);
    } else {
      const t = clamp(
        (this.ballPos.z - bounceZ) / (FIELD3D.strikerZ - bounceZ),
        0,
        1,
      );
      const bounceH = 0.9 + (1 - this.windowScale) * 0.25;
      this.ballPos.y = ground + Math.sin(t * Math.PI) * bounceH * (1 - t * 0.3);
    }
    this.ballPos.x = Math.sin(this.delivery.elapsed * 2) * 0.04;

    this.cam.setPose({
      pos: CAM3D.flight.pos,
      look: [this.ballPos.x, this.ballPos.y + 0.3, this.ballPos.z],
      lerp: CAM3D.lerp + 1,
    });

    if (this.swungThisBall && this.swinging) {
      if (
        this.ballPos.z >= FIELD3D.strikerZ - 1.4 &&
        this.ballPos.z <= FIELD3D.strikerZ + 0.5
      ) {
        this.resolveSwing();
        return;
      }
    }

    if (this.ballPos.z >= FIELD3D.stumpStrikerZ - 0.1) {
      this.triggerOut('bowled');
    }
  }

  private updateHitFlight(dt: number): void {
    this.phaseT += dt;
    this.ballVel.y -= PHYSICS.gravity * dt;
    this.ballPos.addScaledVector(this.ballVel, dt);

    // Ground bounce
    if (this.ballPos.y < 0.12) {
      this.ballPos.y = 0.12;
      if (Math.abs(this.ballVel.y) > 1.5) {
        this.ballVel.y *= -PHYSICS.bounceRestitution;
        this.ballVel.x *= PHYSICS.groundFriction;
        this.ballVel.z *= PHYSICS.groundFriction;
      } else {
        this.ballVel.y = 0;
        this.ballVel.x *= 0.9;
        this.ballVel.z *= 0.9;
      }
    }

    // Catches
    if (this.ballPos.y > 0.6 && this.ballPos.y < 3.2 && this.ballVel.y < 2) {
      for (const f of this.fielders) {
        const d = Math.hypot(
          this.ballPos.x - f.position.x,
          this.ballPos.z - f.position.z,
        );
        if (d < 1.1 && Math.abs(this.ballPos.y - 1.0) < 1.2) {
          this.triggerOut('caught');
          return;
        }
      }
    }

    // Camera follow
    const flatSpeed = Math.hypot(this.ballVel.x, this.ballVel.z);
    const lofted = this.ballPos.y > 2.2 || this.ballVel.y > 6;
    this.cam.follow(this.ballPos, lofted ? 0.75 : 0.25, lofted ? 7 : 4);

    // Boundary
    const r = Math.hypot(this.ballPos.x, this.ballPos.z);
    if (r >= FIELD3D.boundaryR) {
      if (this.ballPos.y > FIELD3D.sixClearY * 0.55 || (lofted && this.ballPos.y > 1.5)) {
        this.finishBoundary('six');
      } else {
        this.finishBoundary('four');
      }
      return;
    }

    // Dead ball — in-field stop: NO run count, no celebration
    if (
      this.phaseT > 0.4 &&
      flatSpeed < 1.2 &&
      this.ballPos.y <= 0.15
    ) {
      this.finishDead();
      return;
    }

    if (this.phaseT > 2.6) {
      this.finishDead();
    }
  }

  private finishDead(): void {
    // Contact that is not a boundary: batters stay put, no +1/+2, no run flash
    this.lastShot = 'dead';
    this.phase = 'result';
    this.phaseT = 0;
    this.resultHold = TIMING.deadBallHold;
    this.ballActive = false;
    this.banner = null;
    this.cam.setPose({ pos: CAM3D.rest.pos, look: CAM3D.rest.look, lerp: CAM3D.lerp });
  }

  private finishBoundary(kind: 'four' | 'six'): void {
    this.lastShot = kind;
    const runs = kind === 'six' ? 6 : 4;
    this.score += runs;
    this.phase = 'result';
    this.phaseT = 0;
    this.ballActive = true; // keep ball visible briefly
    this.resultHold = kind === 'six' ? TIMING.resultHoldSix : TIMING.resultHoldFour;
    this.celebrate = kind === 'six' ? 2.2 : 1.4;
    this.cheer = kind === 'six' ? 1.4 : 1;

    if (kind === 'six') {
      this.banner = 'SIX!';
      audio.cheerBig();
      this.cam.addShake(1.9);
      this.cam.setPose({
        pos: CAM3D.six.pos,
        look: [this.ballPos.x, Math.max(2, this.ballPos.y), this.ballPos.z],
        lerp: CAM3D.hitLerp,
      });
      this.fx.burst(this.ballPos.clone(), 0xf4d35e, 36, this.reducedMotion);
      this.fx.confetti(this.ballPos.clone(), 52, this.reducedMotion);
      this.confettiDelay = 0.3;
    } else {
      this.banner = 'FOUR!';
      audio.cheer(0.9);
      this.cam.addShake(1.15);
      this.cam.setPose({
        pos: CAM3D.four.pos,
        look: [this.ballPos.x, 0.6, this.ballPos.z],
        lerp: CAM3D.hitLerp,
      });
      this.fx.burst(this.ballPos.clone(), 0xffffff, 22, this.reducedMotion);
      this.fx.confetti(this.ballPos.clone(), 20, this.reducedMotion);
    }
  }

  private updateResultCam(): void {
    if (this.lastShot === 'six') {
      this.cam.setPose({
        pos: CAM3D.six.pos,
        look: [
          clamp(this.ballPos.x, -16, 4),
          Math.max(2, this.ballPos.y),
          clamp(this.ballPos.z, -10, 10),
        ],
        lerp: 3.5,
      });
      // Keep ball drifting for drama
      if (this.ballActive) {
        this.ballPos.addScaledVector(this.ballVel, 0.016);
        this.ballVel.y -= 0.15;
      }
    } else if (this.lastShot === 'four') {
      this.cam.setPose({
        pos: CAM3D.four.pos,
        look: [this.ballPos.x, 0.5, this.ballPos.z],
        lerp: 4,
      });
    }
  }

  private triggerOut(kind: 'bowled' | 'caught'): void {
    this.lastShot = kind;
    this.phase = 'out';
    this.phaseT = 0;
    this.ballActive = false;
    this.banner = kind === 'bowled' ? 'BOWLED!' : 'CAUGHT!';
    audio.wicket();
    this.cam.addShake(1.4);
    this.cam.setPose({
      pos: CAM3D.out.pos,
      look:
        kind === 'bowled'
          ? [0, 0.8, FIELD3D.stumpStrikerZ]
          : [this.ballPos.x, this.ballPos.y, this.ballPos.z],
      lerp: CAM3D.hitLerp,
    });
    if (kind === 'caught') {
      this.fx.burst(this.ballPos.clone(), 0xe76f51, 14, this.reducedMotion);
    }
  }

  dispose(): void {
    this.fx.clear();
    // Scene graphs disposed with renderer on game teardown if needed
  }
}
