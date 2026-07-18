/** Logical design resolution (letterboxed to any screen). */
export const LOGICAL_W = 960;
export const LOGICAL_H = 540;

export const STORAGE_KEYS = {
  highScore: 'pitchbugs.highScore',
  muted: 'pitchbugs.muted',
} as const;

export const COLORS = {
  skyTop: '#7ec8e3',
  skyBottom: '#c8e7f5',
  grassDark: '#2d6a4f',
  grassLight: '#40916c',
  pitch: '#c4a574',
  pitchLine: '#e9d5b0',
  boundary: '#f4d35e',
  stump: '#8b5a2b',
  ball: '#d62828',
  ballSeam: '#f8f9fa',
  hud: '#f6fff8',
  accent: '#f4d35e',
  danger: '#e76f51',
  batterBody: '#52b788',
  batterBelly: '#95d5b2',
  batterWing: '#74c69d',
  bowlerShell: '#e9c46a',
  bowlerBody: '#6d6875',
  crowd: '#1b4332',
} as const;

/** World-space layout (logical pixels). */
export const FIELD = {
  groundY: 420,
  pitchLeft: 280,
  pitchRight: 780,
  pitchTop: 360,
  pitchBottom: 430,
  batterX: 720,
  batterY: 390,
  bowlerX: 320,
  bowlerY: 390,
  stumpX: 760,
  stumpY: 400,
  boundaryX: 120,
  /** Rough outfield left edge for 4/6 detection. */
  sixClearHeight: 70,
} as const;

export const TIMING = {
  /** Seconds: perfect contact half-width at base difficulty. */
  perfectWindow: 0.055,
  goodWindow: 0.11,
  edgeWindow: 0.16,
  swingDuration: 0.28,
  resultHold: 1.15,
  /** Longer holds so boundary celebrations and camera can land. */
  resultHoldFour: 1.55,
  resultHoldSix: 2.15,
  outHold: 1.6,
  betweenBalls: 0.55,
} as const;

/** Phase-driven broadcast camera (logical world space). */
export const CAMERA = {
  restZoom: 1,
  bowlZoomStart: 1.1,
  bowlZoomEnd: 1.2,
  flightZoom: 1.24,
  hitPunchZoom: 1.3,
  hitFollowZoom: 1.08,
  fourZoom: 0.94,
  sixZoom: 0.86,
  outZoom: 1.22,
  /** Higher = snappier tracking. */
  lerpPos: 9,
  lerpZoom: 7,
  hitLerpPos: 14,
  hitLerpZoom: 11,
  zoomMin: 0.82,
  zoomMax: 1.35,
  lookMinX: 80,
  lookMaxX: 880,
  lookMinY: 120,
  lookMaxY: 460,
} as const;

export const PHYSICS = {
  gravity: 980,
  ballRadius: 8,
  baseDeliverySpeed: 300,
  maxDeliverySpeed: 520,
  bounceRestitution: 0.55,
  groundFriction: 0.82,
} as const;

export const DIFFICULTY = {
  /** Score contribution to speed. */
  speedPerScore: 0.4,
  speedPerDelivery: 2.2,
  /** Timing window shrinks toward this scale. */
  minWindowScale: 0.55,
  windowScoreFactor: 700,
  maxVariance: 0.38,
  varianceScoreFactor: 450,
} as const;
