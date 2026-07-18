import { describe, expect, it } from 'vitest';
import {
  CAM3D,
  DIFFICULTY,
  FIELD3D,
  PHYSICS,
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

  it('uses longer celebration holds for six than four', () => {
    expect(TIMING.resultHoldSix).toBeGreaterThan(TIMING.resultHoldFour);
    expect(TIMING.resultHoldFour).toBeGreaterThan(TIMING.deadBallHold);
  });

  it('caps delivery speed above base speed', () => {
    expect(PHYSICS.maxDeliverySpeed).toBeGreaterThan(PHYSICS.baseDeliverySpeed);
  });

  it('keeps difficulty window scale between 0 and 1', () => {
    expect(DIFFICULTY.minWindowScale).toBeGreaterThan(0);
    expect(DIFFICULTY.minWindowScale).toBeLessThanOrEqual(1);
  });

  it('defines camera presets with 3-component vectors', () => {
    for (const key of ['rest', 'bowl', 'flight', 'punch', 'four', 'six', 'out'] as const) {
      const pose = CAM3D[key];
      expect(pose.pos).toHaveLength(3);
      expect(pose.look).toHaveLength(3);
    }
  });
});
