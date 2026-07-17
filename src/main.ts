import './style.css';
import { Game } from './engine/game';

function boot(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  const shell = document.getElementById('game-shell');
  const uiRoot = document.getElementById('ui-root');

  if (!canvas || !shell || !uiRoot) {
    throw new Error('Missing required DOM nodes');
  }

  const game = new Game(canvas, shell, uiRoot);
  game.start();

  // Warm first-gesture unlock is handled on Play; keep focus for keyboard.
  window.focus();
}

boot();
