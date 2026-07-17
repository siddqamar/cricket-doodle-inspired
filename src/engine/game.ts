import { LOGICAL_H, LOGICAL_W } from '../config/constants';
import { Camera, fitCanvasToParent } from './camera';
import { Input } from './input';
import { PlayScene } from '../scenes/play';
import { Overlay } from '../ui/overlay';
import { audio } from '../audio/audio';
import { drawTitleBackdrop } from '../assets/draw';
import { loadHighScore } from '../utils/storage';

type Mode = 'title' | 'instructions' | 'playing' | 'paused' | 'gameover';

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly shell: HTMLElement;
  private readonly camera = new Camera();
  private readonly input: Input;
  private readonly overlay: Overlay;
  private play: PlayScene | null = null;
  private mode: Mode = 'title';
  private running = false;
  private last = 0;
  private time = 0;
  private gameOverScore = 0;
  private gameOverHigh = 0;
  private raf = 0;

  constructor(canvas: HTMLCanvasElement, shell: HTMLElement, uiRoot: HTMLElement) {
    this.canvas = canvas;
    this.shell = shell;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;

    this.input = new Input(canvas, () => this.mode === 'playing');

    this.overlay = new Overlay(uiRoot, {
      onPlay: () => this.startGame(),
      onResume: () => this.resume(),
      onRestart: () => this.startGame(),
      onShowInstructions: () => this.setMode('instructions'),
      onHideInstructions: () => {
        this.play = null;
        this.setMode('title');
      },
      onToggleSound: () => {
        void audio.ensure();
        audio.toggleMute();
      },
      onPause: () => this.pause(),
    });

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));

    this.resize();
    this.setMode('title');
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
  }

  private resize(): void {
    fitCanvasToParent(this.canvas, this.shell);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'KeyM') {
      void audio.ensure();
      audio.toggleMute();
      // refresh overlay icons if visible
      if (this.mode === 'playing' || this.mode === 'paused') {
        this.overlay.setMode(this.mode === 'paused' ? 'paused' : 'hidden');
      }
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (this.mode === 'playing') this.pause();
      else if (this.mode === 'paused') this.resume();
      else if (this.mode === 'instructions') this.setMode('title');
    }
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    if (mode === 'title') {
      this.overlay.setMode('title', 0, loadHighScore());
    } else if (mode === 'instructions') {
      this.overlay.setMode('instructions');
    } else if (mode === 'playing') {
      this.overlay.setMode('hidden');
    } else if (mode === 'paused') {
      this.overlay.setMode('paused');
    } else if (mode === 'gameover') {
      this.overlay.setMode('gameover', this.gameOverScore, this.gameOverHigh);
    }
  }

  private startGame(): void {
    void audio.ensure();
    audio.startAmbience();
    this.play = new PlayScene(this.camera, {
      onGameOver: (score, high) => {
        this.gameOverScore = score;
        this.gameOverHigh = high;
        this.setMode('gameover');
      },
    });
    this.setMode('playing');
  }

  private pause(): void {
    if (this.mode !== 'playing') return;
    this.setMode('paused');
  }

  private resume(): void {
    if (this.mode !== 'paused') return;
    this.setMode('playing');
  }

  private tick(dt: number): void {
    this.time += dt;
    this.input.beginFrame();
    this.camera.update(dt);

    if (this.mode === 'playing' && this.play) {
      this.play.update(dt, this.input.swingPressed);
    }

    this.render();
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    this.camera.apply(ctx);

    if (this.mode === 'title' || this.mode === 'instructions') {
      drawTitleBackdrop(ctx, this.time);
      // Dim for UI readability
      ctx.fillStyle = 'rgba(8, 32, 21, 0.28)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    } else if (this.play) {
      this.play.draw(ctx);
      if (this.mode === 'paused' || this.mode === 'gameover') {
        ctx.fillStyle = 'rgba(8, 32, 21, 0.4)';
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      }
    }

    ctx.restore();
  }
}
