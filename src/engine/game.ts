import * as THREE from 'three';
import { Input } from './input';
import { PlayScene3D } from '../scenes/play3d';
import { Camera3D } from '../world/camera3d';
import { Overlay } from '../ui/overlay';
import { audio } from '../audio/audio';
import { loadHighScore } from '../utils/storage';
import { buildStadium } from '../world/stadium';
import { createBug } from '../world/bugs';
import { CAM3D } from '../config/constants';

type Mode = 'title' | 'instructions' | 'playing' | 'paused' | 'gameover';

/**
 * WebGL / Three.js game shell — 3D pitch, boundary-only scoring.
 */
export class Game {
  private readonly shell: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly cam: Camera3D;
  private readonly input: Input;
  private readonly overlay: Overlay;

  private play: PlayScene3D | null = null;
  private titleScene: THREE.Scene | null = null;
  private mode: Mode = 'title';
  private running = false;
  private last = 0;
  private time = 0;
  private gameOverScore = 0;
  private gameOverHigh = 0;
  private raf = 0;

  private hudEl: HTMLDivElement | null = null;
  private bannerEl: HTMLDivElement | null = null;

  constructor(canvas: HTMLCanvasElement, shell: HTMLElement, uiRoot: HTMLElement) {
    this.shell = shell;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const rect = shell.getBoundingClientRect();
    this.cam = new Camera3D(Math.max(0.1, rect.width / Math.max(1, rect.height)));
    this.resize();

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

    this.ensureHud(shell);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));

    this.buildTitleScene();
    this.setMode('title');
  }

  private ensureHud(shell: HTMLElement): void {
    this.hudEl = document.createElement('div');
    this.hudEl.className = 'hud-3d';
    this.hudEl.innerHTML = `
      <div class="hud-score"><span data-score>0</span></div>
      <div class="hud-meta">Best <span data-best>0</span> · Balls <span data-balls>0</span></div>
      <div class="hud-note">Boundaries only · no run chase</div>
    `;
    shell.appendChild(this.hudEl);

    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'banner-3d hidden';
    shell.appendChild(this.bannerEl);
  }

  private buildTitleScene(): void {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x2d6a4f, 0.9));
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
    sun.position.set(10, 18, 6);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(buildStadium());

    const s = createBug('striker', 1.2);
    s.position.set(0.4, 0, 6);
    s.rotation.y = Math.PI + 0.4;
    scene.add(s);
    const p = createBug('partner', 1.1);
    p.position.set(-1.2, 0, 5.2);
    p.rotation.y = Math.PI - 0.3;
    scene.add(p);
    const b = createBug('bowler', 1.15);
    b.position.set(0, 0, -4);
    scene.add(b);

    this.titleScene = scene;
    this.cam.setPose({ pos: CAM3D.rest.pos, look: [0, 0.8, 2], snap: true });
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
    this.renderer.dispose();
  }

  private resize(): void {
    const rect = this.shell.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(w, h, false);
    this.cam.setAspect(w / h);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'KeyM') {
      void audio.ensure();
      audio.toggleMute();
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
    if (this.hudEl) {
      this.hudEl.classList.toggle('hidden', mode !== 'playing' && mode !== 'paused');
    }
    if (mode === 'title') {
      this.cam.reset(true);
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
    this.play?.dispose();
    this.cam.reset(true);
    this.play = new PlayScene3D(this.cam, {
      onGameOver: (score, high) => {
        this.gameOverScore = score;
        this.gameOverHigh = high;
        this.setMode('gameover');
      },
      onHud: (score, high, balls, banner) => this.updateHud(score, high, balls, banner),
    });
    this.setMode('playing');
  }

  private updateHud(
    score: number,
    high: number,
    balls: number,
    banner: string | null,
  ): void {
    if (!this.hudEl || !this.bannerEl) return;
    const s = this.hudEl.querySelector('[data-score]');
    const b = this.hudEl.querySelector('[data-best]');
    const d = this.hudEl.querySelector('[data-balls]');
    if (s) s.textContent = String(score);
    if (b) b.textContent = String(high);
    if (d) d.textContent = String(balls);

    if (banner) {
      this.bannerEl.textContent = banner;
      this.bannerEl.classList.remove('hidden');
      this.bannerEl.classList.toggle('six', banner === 'SIX!');
      this.bannerEl.classList.toggle('four', banner === 'FOUR!');
      this.bannerEl.classList.toggle('out', banner === 'BOWLED!' || banner === 'CAUGHT!');
    } else {
      this.bannerEl.classList.add('hidden');
    }
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

    if (this.mode === 'playing' && this.play) {
      this.play.update(dt, this.input.swingPressed);
    } else if (this.mode === 'title' || this.mode === 'instructions') {
      // Slow orbit on title
      const a = this.time * 0.15;
      this.cam.setPose({
        pos: [Math.cos(a) * 12, 5.5, Math.sin(a) * 12 + 4],
        look: [0, 0.8, 2],
        lerp: 2,
      });
    }

    this.cam.update(dt);
    this.render();
  }

  private render(): void {
    if (this.mode === 'playing' || this.mode === 'paused' || this.mode === 'gameover') {
      if (this.play) {
        this.renderer.render(this.play.scene, this.cam.camera);
      }
    } else if (this.titleScene) {
      this.renderer.render(this.titleScene, this.cam.camera);
    }
  }
}
