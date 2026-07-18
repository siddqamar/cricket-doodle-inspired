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
  /** Quiet non-boundary contact — no run count, short beat only. */
  deadBallHold: 0.55,
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

export const DIFFICULTY = {
  speedPerScore: 0.12,
  speedPerDelivery: 0.18,
  minWindowScale: 0.55,
  windowScoreFactor: 120,
  maxVariance: 0.38,
  varianceScoreFactor: 90,
} as const;

/** Cinematic camera presets (world space). */
export const CAM3D = {
  rest: { pos: [9.5, 5.2, 16.5] as const, look: [0, 0.6, 0] as const },
  bowl: { pos: [4.2, 3.2, -6] as const, look: [0, 1, -8] as const },
  flight: { pos: [5.5, 3.4, 12] as const, look: [0.2, 1.1, 8] as const },
  punch: { pos: [3.2, 2.6, 11.5] as const, look: [0.3, 1.2, 9] as const },
  four: { pos: [8, 4.5, 6] as const, look: [-8, 0.8, 2] as const },
  six: { pos: [14, 9, 10] as const, look: [-6, 4, -2] as const },
  out: { pos: [3, 2.4, 12] as const, look: [0.3, 1, 10] as const },
  lerp: 4.5,
  hitLerp: 8,
} as const;
