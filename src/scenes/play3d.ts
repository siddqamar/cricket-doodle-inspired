import * as THREE from 'three';
import {
  CAM3D,
  DIFFICULTY,
  FIELD3D,
  FIELDING,
  PHYSICS,
  RUNNING,
  TIMING,
} from '../config/constants';
import { audio } from '../audio/audio';
import { Camera3D } from '../world/camera3d';
import {
  breakStumps,
  createBug,
  createStumps,
  type FielderPose,
  resetBugBody,
  setBatSwing,
  setBowlerPhase,
  setCelebrate,
  setFielderPose,
  setRunCycle,
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

type ShotKind =
  | 'dead'
  | 'one'
  | 'two'
  | 'three'
  | 'four'
  | 'six'
  | 'bowled'
  | 'caught';

type FielderAI = {
  group: THREE.Group;
  home: THREE.Vector3;
  pose: FielderPose;
  reactionLeft: number;
  gatherLeft: number;
  diveT: number;
};

/**
 * 3D match: running between wickets, active fielding, progressive difficulty.
 * Boundaries still auto-score; singles/doubles resolve from chase vs crease time.
 */
export class PlayScene3D {
  readonly scene = new THREE.Scene();
  score = 0;
  highScore = loadHighScore();
  deliveries = 0;

  private phase: Phase = 'intro';
  private phaseT = 0;
  private time = 0;
  private matchTime = 0;
  private difficultyT = 0;
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
  private readonly fielderAIs: FielderAI[] = [];
  private readonly stumpStriker: THREE.Group;
  private readonly stumpBowler: THREE.Group;
  private readonly ball: THREE.Mesh;
  private readonly shadow: THREE.Mesh;

  private ballPos = new THREE.Vector3();
  private ballVel = new THREE.Vector3();
  private ballActive = false;
  /** True once the ball has touched the ground after bat contact (kills catch & six). */
  private hasBouncedSinceHit = false;

  /** Striker starts at +Z home crease; flips after odd completed runs. */
  private strikerAtHome = true;
  private running = false;
  private runFrac = 0;
  private completedRuns = 0;
  private maxAttemptRuns = 0;
  private allowTriple = false;
  private runStartStrikerZ = FIELD3D.strikerZ as number;
  private runStartPartnerZ = FIELD3D.partnerZ as number;
  private runTargetStrikerZ = FIELD3D.partnerZ as number;
  private runTargetPartnerZ = FIELD3D.strikerZ as number;

  private readonly _chaseTarget = new THREE.Vector3();
  private readonly _tmp = new THREE.Vector3();

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
    this.scene.add(this.striker);

    this.partner = createBug('partner', 1);
    this.scene.add(this.partner);

    this.bowler = createBug('bowler', 1.05);
    this.bowler.position.set(FIELD3D.bowlerX, 0, FIELD3D.bowlerStartZ);
    this.bowler.rotation.y = 0;
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
      this.fielderAIs.push({
        group: f,
        home: new THREE.Vector3(x!, 0, z!),
        pose: 'idle',
        reactionLeft: 0,
        gatherLeft: 0,
        diveT: 0,
      });
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

    this.placeBattersAtCreases(true);
    this.resetMatch();
  }

  resetMatch(): void {
    this.score = 0;
    this.highScore = loadHighScore();
    this.deliveries = 0;
    this.matchTime = 0;
    this.difficultyT = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.celebrate = 0;
    this.cheer = 0;
    this.lastShot = null;
    this.banner = null;
    this.ballActive = false;
    this.ball.visible = false;
    this.shadow.visible = false;
    this.strikerAtHome = true;
    this.resetRunState();
    this.resetFieldersHome();
    this.placeBattersAtCreases(true);
    this.fx.clear();
    this.cam.reset(true);
    this.pushHud();
  }

  private pushHud(): void {
    this.events.onHud?.(this.score, this.highScore, this.deliveries, this.banner);
  }

  /** 0 during easy era; ramps after first of ~2 min or ~30 runs. */
  private updateDifficultyBlend(): void {
    const easyOver =
      this.matchTime >= DIFFICULTY.easyUntilSeconds ||
      this.score >= DIFFICULTY.easyUntilScore;
    if (!easyOver) {
      this.difficultyT = 0;
      return;
    }
    const pastTime = Math.max(0, this.matchTime - DIFFICULTY.easyUntilSeconds);
    const pastScore = Math.max(0, this.score - DIFFICULTY.easyUntilScore);
    this.difficultyT = clamp(
      Math.max(pastTime / DIFFICULTY.rampTimeSpan, pastScore / DIFFICULTY.rampScoreSpan),
      0,
      1,
    );
  }

  private difficultySpeed(): number {
    const full =
      PHYSICS.baseDeliverySpeed +
      Math.min(this.score * DIFFICULTY.speedPerScore, 12) +
      this.deliveries * DIFFICULTY.speedPerDelivery;
    const capped = clamp(full, PHYSICS.baseDeliverySpeed, PHYSICS.maxDeliverySpeed);
    // Easy era stays near base; ramp blends toward full challenge.
    const blend = 0.18 + this.difficultyT * 0.82;
    return lerp(PHYSICS.baseDeliverySpeed, capped, blend);
  }

  private difficultyWindowScale(): number {
    const raw = 1 - this.score / DIFFICULTY.windowScoreFactor;
    const blended = lerp(1, raw, 0.22 + this.difficultyT * 0.78);
    return clamp(blended, DIFFICULTY.minWindowScale, 1);
  }

  private fielderSpeed(): number {
    return lerp(FIELDING.baseSpeed, FIELDING.maxSpeed, this.difficultyT);
  }

  private fielderReaction(): number {
    return lerp(FIELDING.reactionDelayEasy, FIELDING.reactionDelayHard, this.difficultyT);
  }

  private fielderLead(): number {
    return lerp(FIELDING.leadEasy, FIELDING.leadHard, this.difficultyT);
  }

  private placeBattersAtCreases(snapFacing = false): void {
    const homeX = FIELD3D.strikerX;
    const awayX = FIELD3D.partnerX;
    if (this.strikerAtHome) {
      this.striker.position.set(homeX, 0, FIELD3D.strikerZ);
      this.partner.position.set(awayX, 0, FIELD3D.partnerZ);
      if (snapFacing) {
        this.striker.rotation.y = Math.PI;
        this.partner.rotation.y = 0;
      }
    } else {
      this.striker.position.set(awayX, 0, FIELD3D.partnerZ);
      this.partner.position.set(homeX, 0, FIELD3D.strikerZ);
      if (snapFacing) {
        this.striker.rotation.y = 0;
        this.partner.rotation.y = Math.PI;
      }
    }
    resetBugBody(this.striker);
    resetBugBody(this.partner);
  }

  private resetRunState(): void {
    this.running = false;
    this.runFrac = 0;
    this.completedRuns = 0;
    this.maxAttemptRuns = 0;
    this.allowTriple = false;
  }

  private resetFieldersHome(): void {
    for (const ai of this.fielderAIs) {
      ai.group.position.copy(ai.home);
      ai.group.position.y = 0;
      ai.group.lookAt(0, 0, 0);
      ai.pose = 'idle';
      ai.reactionLeft = 0;
      ai.gatherLeft = 0;
      ai.diveT = 0;
      resetBugBody(ai.group);
    }
  }

  private beginFieldingAlert(): void {
    const reaction = this.fielderReaction();
    for (const ai of this.fielderAIs) {
      ai.reactionLeft = reaction * randRange(0.75, 1.2);
      ai.gatherLeft = 0;
      ai.diveT = 0;
      ai.pose = 'alert';
    }
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
    this.updateDifficultyBlend();
    this.windowScale = this.difficultyWindowScale();
    breakStumps(this.stumpStriker, 0);
    this.resetRunState();
    this.resetFieldersHome();
    // Arcade: bat mesh always faces the next ball at the +Z crease.
    // End-swaps from the previous scramble are shown during that play only.
    this.strikerAtHome = true;
    this.placeBattersAtCreases(true);

    const speed = this.difficultySpeed();
    const variance = clamp(
      (this.score / DIFFICULTY.varianceScoreFactor) * (0.35 + this.difficultyT * 0.65),
      0,
      DIFFICULTY.maxVariance,
    );
    let bounceZ: number;
    const roll = Math.random();
    if (roll < 0.25 + variance * 0.1) bounceZ = randRange(2, 5);
    else if (roll > 0.78 - variance * 0.1) bounceZ = randRange(7.5, 9);
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
    this.cam.setFov(CAM3D.defaultFov);
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

    const bat = this._tmp.set(FIELD3D.strikerX, 1.0, FIELD3D.strikerZ);
    const d = this.ballPos.distanceTo(bat);
    const inReach = d < 1.8 || this.ballPos.z > FIELD3D.strikerZ - 1.6;

    if (!inReach || abs > ew) {
      return;
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

    const yaw = Math.PI + randRange(-0.55, 0.35);
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
    this.hasBouncedSinceHit = false;
    this.phase = 'hit_flight';
    this.phaseT = 0;
    this.beginFieldingAlert();
    this.beginRunningAfterHit(quality);

    audio.batHit(quality === 'perfect' ? 1 : quality === 'good' ? 0.8 : 0.45);
    this.cam.addShake(quality === 'perfect' ? 1.1 : 0.55);
    this.fx.burst(this.ballPos.clone(), 0xffffff, quality === 'edge' ? 8 : 16, this.reducedMotion);
    this.cam.setPose({
      pos: CAM3D.punch.pos,
      look: [this.ballPos.x, this.ballPos.y, this.ballPos.z],
      lerp: CAM3D.hitLerp,
    });
  }

  private beginRunningAfterHit(quality: 'perfect' | 'good' | 'edge'): void {
    const flat = Math.hypot(this.ballVel.x, this.ballVel.z);
    if (
      flat < RUNNING.minRunFlatSpeed ||
      (quality === 'edge' && flat < RUNNING.minRunFlatSpeed * 1.15)
    ) {
      this.resetRunState();
      return;
    }

    // 1 common, 2 occasional; 3 only as rare highlight when ball stays in.
    if (quality === 'perfect') this.maxAttemptRuns = 2;
    else if (quality === 'good') this.maxAttemptRuns = flat > 12 ? 2 : 1;
    else this.maxAttemptRuns = 1;

    const tripleChance = lerp(
      RUNNING.tripleChanceEasy,
      RUNNING.tripleChanceHard,
      this.difficultyT,
    );
    this.allowTriple =
      quality !== 'edge' && flat > 13 && Math.random() < tripleChance;

    this.running = true;
    this.runFrac = 0;
    this.completedRuns = 0;
    this.armNextRunLegs();
  }

  private armNextRunLegs(): void {
    this.runStartStrikerZ = this.striker.position.z;
    this.runStartPartnerZ = this.partner.position.z;
    // Cross the pitch: swap ends for this leg.
    this.runTargetStrikerZ = this.strikerAtHome ? FIELD3D.partnerZ : FIELD3D.strikerZ;
    this.runTargetPartnerZ = this.strikerAtHome ? FIELD3D.strikerZ : FIELD3D.partnerZ;
    this.striker.rotation.y =
      this.runTargetStrikerZ < this.runStartStrikerZ ? Math.PI : 0;
    this.partner.rotation.y =
      this.runTargetPartnerZ < this.runStartPartnerZ ? Math.PI : 0;
  }

  update(dt: number, swingPressed: boolean): void {
    this.time += dt;
    if (this.phase !== 'intro' && this.phase !== 'out') {
      this.matchTime += dt;
      this.updateDifficultyBlend();
    }
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

    if (this.running && this.phase === 'hit_flight') {
      setRunCycle(this.striker, this.time, 1);
      setRunCycle(this.partner, this.time + 0.15, 1);
    } else if (this.celebrate > 0) {
      setCelebrate(this.striker, this.celebrate, this.time);
      setCelebrate(this.partner, this.celebrate * 0.55, this.time + 0.4);
    } else if (this.phase !== 'hit_flight') {
      resetBugBody(this.striker);
      resetBugBody(this.partner);
    }

    if (this.phase !== 'hit_flight') {
      for (let i = 0; i < this.fielderAIs.length; i++) {
        const ai = this.fielderAIs[i]!;
        if (ai.pose === 'idle' || ai.pose === 'alert') {
          setFielderPose(ai.group, 'idle', this.time + i, 1);
        }
      }
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

    if (this.ballPos.y < 0.12) {
      this.ballPos.y = 0.12;
      this.hasBouncedSinceHit = true;
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

    this.updateRunning(dt);
    if (this.updateFielders(dt)) return;

    // Catches — only on the full; bounce makes the ball safe
    if (
      !this.hasBouncedSinceHit &&
      this.ballPos.y > FIELDING.catchHeightMin &&
      this.ballPos.y < FIELDING.catchHeightMax &&
      this.ballVel.y < 2
    ) {
      for (const ai of this.fielderAIs) {
        if (ai.reactionLeft > 0) continue;
        const d = Math.hypot(
          this.ballPos.x - ai.group.position.x,
          this.ballPos.z - ai.group.position.z,
        );
        if (d < FIELDING.catchRadius && Math.abs(this.ballPos.y - 1.0) < 1.25) {
          this.triggerOut('caught');
          return;
        }
      }
    }

    const flatSpeed = Math.hypot(this.ballVel.x, this.ballVel.z);
    const lofted = this.ballPos.y > 2.2 || this.ballVel.y > 6;
    const deep = Math.hypot(this.ballPos.x, this.ballPos.z) > FIELD3D.boundaryR * 0.55;

    // Camera: zoom in for running corridor, out for deep loft / boundary threat
    if (this.running && !lofted && !deep) {
      this.cam.frameRunning(
        this._tmp.set(
          (this.striker.position.x + this.partner.position.x) * 0.5,
          0.9,
          (this.striker.position.z + this.partner.position.z) * 0.5,
        ),
      );
    } else {
      this.cam.follow(this.ballPos, lofted || deep ? 0.75 : 0.25, lofted ? 7 : 4);
    }

    const r = Math.hypot(this.ballPos.x, this.ballPos.z);
    if (r >= FIELD3D.boundaryR) {
      const clearsOnFull =
        !this.hasBouncedSinceHit &&
        (this.ballPos.y > FIELD3D.sixClearY * 0.55 ||
          (lofted && this.ballPos.y > 1.5));
      this.finishBoundary(clearsOnFull ? 'six' : 'four');
      return;
    }

    // Ball dies in-field without a clean gather — award completed runs
    if (this.phaseT > 0.45 && flatSpeed < 1.15 && this.ballPos.y <= 0.15) {
      this.finishRuns(this.completedRuns);
      return;
    }

    if (this.phaseT > 3.2) {
      this.finishRuns(this.completedRuns);
    }
  }

  private updateRunning(dt: number): void {
    if (!this.running) return;

    const cap = this.allowTriple
      ? RUNNING.maxRuns
      : Math.min(this.maxAttemptRuns, 2);
    if (this.completedRuns >= cap) {
      this.running = false;
      resetBugBody(this.striker);
      resetBugBody(this.partner);
      return;
    }

    const dur =
      RUNNING.runDuration + (this.completedRuns > 0 ? RUNNING.turnExtra : 0);
    this.runFrac += dt / dur;
    const u = clamp(this.runFrac, 0, 1);
    // Smoothstep for readable footwork
    const e = u * u * (3 - 2 * u);

    this.striker.position.z = lerp(this.runStartStrikerZ, this.runTargetStrikerZ, e);
    this.partner.position.z = lerp(this.runStartPartnerZ, this.runTargetPartnerZ, e);
    this.striker.position.x = lerp(
      this.strikerAtHome ? FIELD3D.strikerX : FIELD3D.partnerX,
      this.strikerAtHome ? FIELD3D.partnerX : FIELD3D.strikerX,
      e,
    );
    this.partner.position.x = lerp(
      this.strikerAtHome ? FIELD3D.partnerX : FIELD3D.strikerX,
      this.strikerAtHome ? FIELD3D.strikerX : FIELD3D.partnerX,
      e,
    );

    if (this.runFrac >= 1) {
      this.completedRuns += 1;
      this.strikerAtHome = !this.strikerAtHome;
      this.runFrac = 0;
      this.placeBattersAtCreases(true);

      // Prefer 4 over inventing a 3: stop at 2 unless rare triple allowed
      const nextCap = this.allowTriple ? RUNNING.maxRuns : Math.min(this.maxAttemptRuns, 2);
      if (this.completedRuns >= nextCap) {
        this.running = false;
        resetBugBody(this.striker);
        resetBugBody(this.partner);
      } else {
        this.armNextRunLegs();
      }
    }
  }

  /** @returns true if the play ended (fielded). */
  private updateFielders(dt: number): boolean {
    const speed = this.fielderSpeed();
    const lead = this.fielderLead();
    let nearestDist = Infinity;
    let nearest: FielderAI | null = null;

    for (const ai of this.fielderAIs) {
      if (ai.diveT > 0) {
        ai.diveT = Math.max(0, ai.diveT - dt);
        setFielderPose(ai.group, 'dive', this.time, 1);
        continue;
      }

      if (ai.reactionLeft > 0) {
        ai.reactionLeft -= dt;
        ai.pose = 'alert';
        setFielderPose(ai.group, 'alert', this.time, 1);
        // Face the ball while waiting
        ai.group.lookAt(this.ballPos.x, 0, this.ballPos.z);
        continue;
      }

      // Lead the bounce / roll path slightly
      this._chaseTarget.set(
        this.ballPos.x + this.ballVel.x * lead * 0.22,
        0,
        this.ballPos.z + this.ballVel.z * lead * 0.22,
      );

      const dx = this._chaseTarget.x - ai.group.position.x;
      const dz = this._chaseTarget.z - ai.group.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.05) {
        const step = Math.min(dist, speed * dt);
        ai.group.position.x += (dx / dist) * step;
        ai.group.position.z += (dz / dist) * step;
        ai.group.lookAt(this._chaseTarget.x, 0, this._chaseTarget.z);
        ai.pose = 'chase';
        setFielderPose(ai.group, 'chase', this.time, 1);
      }

      const ballDist = Math.hypot(
        this.ballPos.x - ai.group.position.x,
        this.ballPos.z - ai.group.position.z,
      );
      if (ballDist < nearestDist) {
        nearestDist = ballDist;
        nearest = ai;
      }

      // Ground save / gather
      const canGather =
        this.hasBouncedSinceHit ||
        (this.ballPos.y <= 0.35 && Math.hypot(this.ballVel.x, this.ballVel.z) < 8);

      if (canGather && ballDist < FIELDING.pickupRadius && this.ballPos.y < 1.2) {
        if (ai.gatherLeft <= 0) {
          ai.gatherLeft = FIELDING.gatherTime;
          // Dive flourish on close saves
          if (ballDist < FIELDING.pickupRadius * 0.65 && Math.hypot(this.ballVel.x, this.ballVel.z) > 3) {
            ai.diveT = 0.35;
            ai.pose = 'dive';
          } else {
            ai.pose = 'throw';
            setFielderPose(ai.group, 'throw', this.time, 1);
          }
        } else {
          ai.gatherLeft -= dt;
          if (ai.gatherLeft <= 0) {
            // Secure the ball — stop it and award runs taken so far
            this.ballVel.set(0, 0, 0);
            this.ballPos.y = 0.12;
            ai.pose = 'throw';
            setFielderPose(ai.group, 'throw', this.time, 1);
            this.fx.burst(this.ballPos.clone(), 0xb8b0c0, 10, this.reducedMotion);
            this.finishRuns(this.completedRuns);
            return true;
          }
        }
      }
    }

    // Nearest fielder slightly more aggressive cut-off
    if (nearest && nearest.reactionLeft <= 0 && nearestDist < 4) {
      nearest.pose = nearest.diveT > 0 ? 'dive' : 'chase';
    }

    return false;
  }

  private finishRuns(runs: number): void {
    this.running = false;
    resetBugBody(this.striker);
    resetBugBody(this.partner);
    this.placeBattersAtCreases(true);

    const n = clamp(Math.floor(runs), 0, RUNNING.maxRuns);
    if (n <= 0) {
      this.lastShot = 'dead';
      this.phase = 'result';
      this.phaseT = 0;
      this.resultHold = TIMING.deadBallHold;
      this.ballActive = false;
      this.banner = null;
      this.cam.setPose({ pos: CAM3D.rest.pos, look: CAM3D.rest.look, lerp: CAM3D.lerp });
      this.cam.setFov(CAM3D.defaultFov);
      return;
    }

    this.score += n;
    this.lastShot = n === 1 ? 'one' : n === 2 ? 'two' : 'three';
    this.phase = 'result';
    this.phaseT = 0;
    this.resultHold = TIMING.resultHoldRun;
    this.ballActive = false;
    this.banner = n === 1 ? '1' : n === 2 ? '2' : '3';
    this.celebrate = n >= 2 ? 0.7 : 0.35;
    audio.cheer(n >= 2 ? 0.55 : 0.35);
    this.cam.frameRunning(this._tmp.set(0, 0.9, 0));
    this.fx.burst(
      new THREE.Vector3(0, 1, (this.striker.position.z + this.partner.position.z) * 0.5),
      0xf4d35e,
      n >= 2 ? 14 : 8,
      this.reducedMotion,
    );
  }

  private finishBoundary(kind: 'four' | 'six'): void {
    this.running = false;
    resetBugBody(this.striker);
    resetBugBody(this.partner);
    // Boundaries don't change ends mid-scramble — reset to pre-shot ends? 
    // Cricket: runs not taken on 4/6, batters return. Snap to creases without swap from partial runs.
    // Undo any mid-run incomplete progress by using completedRuns only... actually on 4/6
    // completed run crossings that finished should count for strike rotation only if laws-strict;
    // arcade: return batters home without counting incomplete, keep completed swaps.
    this.placeBattersAtCreases(true);

    this.lastShot = kind;
    const runs = kind === 'six' ? 6 : 4;
    this.score += runs;
    this.phase = 'result';
    this.phaseT = 0;
    this.ballActive = true;
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
    } else if (
      this.lastShot === 'one' ||
      this.lastShot === 'two' ||
      this.lastShot === 'three'
    ) {
      this.cam.frameRunning(this._tmp.set(0, 0.9, 0));
    }
  }

  private triggerOut(kind: 'bowled' | 'caught'): void {
    this.running = false;
    resetBugBody(this.striker);
    resetBugBody(this.partner);
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
  }
}
