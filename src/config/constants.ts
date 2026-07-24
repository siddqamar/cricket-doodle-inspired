/** Logical design resolution (UI letterbox reference). */
export const LOGICAL_W = 960;
export const LOGICAL_H = 540;

export const STORAGE_KEYS = {
  highScore: 'pitchbugs.highScore',
  muted: 'pitchbugs.muted',
} as const;

export const COLORS = {
  accent: '#f4d35e',
  danger: '#e76f51',
  hud: '#f6fff8',
} as const;

/** 3D cricket ground (Y-up, pitch along Z). */
export const FIELD3D = {
  pitchHalf: 10.5,
  pitchWidth: 3.05,
  stumpStrikerZ: 10.2,
  stumpBowlerZ: -10.2,
  strikerX: 0.35,
  strikerZ: 9.4,
  partnerX: -0.9,
  partnerZ: -9.4,
  bowlerX: 0,
  bowlerStartZ: -16,
  bowlerReleaseZ: -11.2,
  boundaryR: 22,
  sixClearY: 3.2,
  groundY: 0,
} as const;

export const TIMING = {
  perfectWindow: 0.055,
  goodWindow: 0.11,
  edgeWindow: 0.16,
  swingDuration: 0.28,
  /** Quiet non-scoring contact — short beat only. */
  deadBallHold: 0.55,
  /** Hold after completing 1/2/3 runs. */
  resultHoldRun: 1.15,
  resultHoldFour: 1.7,
  resultHoldSix: 2.4,
  outHold: 1.7,
} as const;

export const PHYSICS = {
  gravity: 18,
  ballRadius: 0.1,
  baseDeliverySpeed: 22,
  maxDeliverySpeed: 36,
  bounceRestitution: 0.45,
  groundFriction: 0.88,
} as const;

/**
 * Progressive difficulty: easy era until ~2 min or ~30 runs (first trigger),
 * then blend bowling pace + fielding pressure. Keep batting windows generous.
 */
export const DIFFICULTY = {
  /** Soft “easy era” ends when either threshold is reached first. */
  easyUntilSeconds: 120,
  easyUntilScore: 30,
  /** How quickly difficultyT ramps after easy era (score / time blend). */
  rampScoreSpan: 50,
  rampTimeSpan: 120,
  /** Delivery speed growth (applied after easy era via difficultyT). */
  speedPerScore: 0.12,
  speedPerDelivery: 0.18,
  /** Timing window floor — never shrink past this (arcade-friendly). */
  minWindowScale: 0.55,
  windowScoreFactor: 120,
  maxVariance: 0.38,
  varianceScoreFactor: 90,
} as const;

/** Running between wickets (auto-run resolution; animation sells it). */
export const RUNNING = {
  /** Seconds to complete one end-to-end run at base pace. */
  runDuration: 1.12,
  /** Slightly slower turn for the second/third run. */
  turnExtra: 0.12,
  maxRuns: 3,
  /**
   * Horizontal speed of the ball (approx) needed before batters attempt a run.
   * Soft edges / defended balls stay dots.
   */
  minRunFlatSpeed: 4.5,
  /** Chance (0–1) a deep misfield allows a rare triple when otherwise 2. */
  tripleChanceEasy: 0.14,
  tripleChanceHard: 0.04,
} as const;

/** Active fielding: chase, catch on the full, save runs on the ground. */
export const FIELDING = {
  /** Reaction delay before fielders start chasing (seconds). */
  reactionDelayEasy: 0.38,
  reactionDelayHard: 0.1,
  /** Chase speeds (world units / s). */
  baseSpeed: 4.2,
  maxSpeed: 7.6,
  /** How hard fielders lead the ball (prediction strength 0–1). */
  leadEasy: 0.25,
  leadHard: 0.7,
  pickupRadius: 1.05,
  catchRadius: 1.15,
  catchHeightMin: 0.55,
  catchHeightMax: 3.1,
  /** Seconds to secure the ball after reaching it on the ground. */
  gatherTime: 0.22,
  /** Idle return speed when ball is dead. */
  returnSpeed: 3.2,
} as const;

/** Cinematic camera presets (world space). */
export const CAM3D = {
  rest: { pos: [9.5, 5.2, 16.5] as const, look: [0, 0.6, 0] as const },
  bowl: { pos: [4.2, 3.2, -6] as const, look: [0, 1, -8] as const },
  flight: { pos: [5.5, 3.4, 12] as const, look: [0.2, 1.1, 8] as const },
  punch: { pos: [3.2, 2.6, 11.5] as const, look: [0.3, 1.2, 9] as const },
  /** Zoom in on the pitch corridor for singles / twos. */
  running: { pos: [5.5, 3.4, 4] as const, look: [0, 0.9, 0] as const },
  four: { pos: [8, 4.5, 6] as const, look: [-8, 0.8, 2] as const },
  six: { pos: [14, 9, 10] as const, look: [-6, 4, -2] as const },
  out: { pos: [3, 2.4, 12] as const, look: [0.3, 1, 10] as const },
  lerp: 4.5,
  hitLerp: 8,
  /** Extra FOV pull for deep loft (degrees added). */
  deepZoomFov: 6,
  runningFov: 42,
  defaultFov: 48,
} as const;
