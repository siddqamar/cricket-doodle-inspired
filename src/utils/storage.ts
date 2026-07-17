import { STORAGE_KEYS } from '../config/constants';

export function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.highScore);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): number {
  const prev = loadHighScore();
  const next = Math.max(prev, Math.floor(score));
  try {
    localStorage.setItem(STORAGE_KEYS.highScore, String(next));
  } catch {
    /* ignore quota / private mode */
  }
  return next;
}

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.muted) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.muted, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}
