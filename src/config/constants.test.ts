import { describe, expect, it } from 'vitest';
import {
  CAM3D,
  DIFFICULTY,
  FIELD3D,
  FIELDING,
  PHYSICS,
  RUNNING,
  TIMING,
} from './constants';

describe('gameplay constants integrity', () => {
  it('keeps boundary larger than pitch half', () => {
    expect(FIELD3D.boundaryR).toBeGreaterThan(FIELD3D.pitchHalf);
  });

  it('places striker and partner on opposite pitch ends', () => {
    expect(FIELD3D.strikerZ).toBeGreaterThan(0);
    expect(FIELD3D.partnerZ).toBeLessThan(0);
  });

  it('uses longer celebration holds for six than four and runs', () => {
    expect(TIMING.resultHoldSix).toBeGreaterThan(TIMING.resultHoldFour);
    expect(TIMING.resultHoldFour).toBeGreaterThan(TIMING.resultHoldRun);
    expect(TIMING.resultHoldRun).toBeGreaterThan(TIMING.deadBallHold);
  });

  it('caps delivery speed above base speed', () => {
    expect(PHYSICS.maxDeliverySpeed).toBeGreaterThan(PHYSICS.baseDeliverySpeed);
  });

  it('keeps difficulty window scale between 0 and 1', () => {
    expect(DIFFICULTY.minWindowScale).toBeGreaterThan(0);
    expect(DIFFICULTY.minWindowScale).toBeLessThanOrEqual(1);
  });

  it('defines easy-era thresholds for progressive difficulty', () => {
    expect(DIFFICULTY.easyUntilSeconds).toBeGreaterThan(0);
    expect(DIFFICULTY.easyUntilScore).toBeGreaterThan(0);
    expect(DIFFICULTY.rampScoreSpan).toBeGreaterThan(0);
    expect(DIFFICULTY.rampTimeSpan).toBeGreaterThan(0);
  });

  it('keeps running params arcade-friendly', () => {
    expect(RUNNING.runDuration).toBeGreaterThan(0.5);
    expect(RUNNING.maxRuns).toBe(3);
    expect(RUNNING.tripleChanceEasy).toBeGreaterThan(RUNNING.tripleChanceHard);
    expect(RUNNING.tripleChanceHard).toBeGreaterThanOrEqual(0);
  });

  it('makes hard fielding faster and more reactive than easy', () => {
    expect(FIELDING.maxSpeed).toBeGreaterThan(FIELDING.baseSpeed);
    expect(FIELDING.reactionDelayEasy).toBeGreaterThan(FIELDING.reactionDelayHard);
    expect(FIELDING.leadHard).toBeGreaterThan(FIELDING.leadEasy);
    expect(FIELDING.pickupRadius).toBeGreaterThan(0);
    expect(FIELDING.catchRadius).toBeGreaterThan(0);
  });

  it('defines camera presets with 3-component vectors', () => {
    for (const key of [
      'rest',
      'bowl',
      'flight',
      'punch',
      'running',
      'four',
      'six',
      'out',
    ] as const) {
      const pose = CAM3D[key];
      expect(pose.pos).toHaveLength(3);
      expect(pose.look).toHaveLength(3);
    }
  });
});
