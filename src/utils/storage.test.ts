import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
});

import {
  loadHighScore,
  loadMuted,
  saveHighScore,
  saveMuted,
} from './storage';

describe('storage high score', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults high score to 0', () => {
    expect(loadHighScore()).toBe(0);
  });

  it('saves and loads high score', () => {
    expect(saveHighScore(42)).toBe(42);
    expect(loadHighScore()).toBe(42);
  });

  it('does not lower an existing high score', () => {
    saveHighScore(50);
    expect(saveHighScore(10)).toBe(50);
    expect(loadHighScore()).toBe(50);
  });
});

describe('storage mute', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults muted to false', () => {
    expect(loadMuted()).toBe(false);
  });

  it('persists mute flag', () => {
    saveMuted(true);
    expect(loadMuted()).toBe(true);
    saveMuted(false);
    expect(loadMuted()).toBe(false);
  });
});
