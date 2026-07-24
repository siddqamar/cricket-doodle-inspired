import { audio } from '../audio/audio';

export type OverlayMode = 'title' | 'instructions' | 'paused' | 'gameover' | 'hidden';

export type OverlayHandlers = {
  onPlay: () => void;
  onResume: () => void;
  onRestart: () => void;
  onShowInstructions: () => void;
  onHideInstructions: () => void;
  onToggleSound: () => void;
  onPause: () => void;
};

export class Overlay {
  private root: HTMLElement;
  private mode: OverlayMode = 'title';
  private handlers: OverlayHandlers;
  private lastScore = 0;
  private lastHigh = 0;

  constructor(root: HTMLElement, handlers: OverlayHandlers) {
    this.root = root;
    this.handlers = handlers;
    this.render();
  }

  setMode(mode: OverlayMode, score = 0, high = 0): void {
    this.mode = mode;
    this.lastScore = score;
    this.lastHigh = high;
    this.render();
  }

  getMode(): OverlayMode {
    return this.mode;
  }

  private render(): void {
    this.root.innerHTML = '';

    // Always-available top controls during play/pause
    if (this.mode === 'hidden' || this.mode === 'paused') {
      const top = document.createElement('div');
      top.className = 'top-controls';
      top.append(
        this.iconBtn(audio.muted ? '🔇' : '🔊', 'Toggle sound', () => {
          this.handlers.onToggleSound();
          this.render();
        }),
        this.iconBtn(this.mode === 'paused' ? '▶️' : '⏸️', 'Pause', () => {
          if (this.mode === 'paused') this.handlers.onResume();
          else this.handlers.onPause();
        }),
      );
      this.root.appendChild(top);
    }

    if (this.mode === 'hidden') {
      const hint = document.createElement('div');
      hint.className = 'hud-hint';
      hint.textContent = 'Click / Tap / Space to swing · P pause · M mute';
      this.root.appendChild(hint);
      return;
    }

    if (this.mode === 'paused') {
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `<h1>Paused</h1><p class="tagline">Take a breath. The snails can wait.</p>`;
      const row = document.createElement('div');
      row.className = 'btn-row';
      row.append(
        this.btn('Resume', () => this.handlers.onResume()),
        this.btn('Restart', () => this.handlers.onRestart(), 'secondary'),
      );
      panel.appendChild(row);
      this.root.appendChild(panel);
      return;
    }

    if (this.mode === 'gameover') {
      const panel = document.createElement('div');
      panel.className = 'panel';
      const isNew = this.lastScore > 0 && this.lastScore >= this.lastHigh;
      panel.innerHTML = `
        <h1>Out!</h1>
        <div class="score-big">${this.lastScore}</div>
        <p class="meta">${isNew ? '🏆 New high score!' : `Best: ${this.lastHigh}`}</p>
        <p class="tagline">One more over?</p>
      `;
      const row = document.createElement('div');
      row.className = 'btn-row';
      row.append(
        this.btn('Play Again', () => this.handlers.onPlay()),
        this.btn('Title', () => this.handlers.onHideInstructions(), 'ghost'),
      );
      panel.appendChild(row);
      this.root.appendChild(panel);
      return;
    }

    if (this.mode === 'instructions') {
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `
        <h1>How to Play</h1>
        <ul class="instructions">
          <li><strong>Click, tap, or press Space</strong> to swing.</li>
          <li>Watch the bounce — time the ball under your bat.</li>
          <li><strong>Only boundaries score</strong> — fours &amp; sixes. No run chase, no 1s/2s count.</li>
          <li>Two batting bugs stand ready; they don&rsquo;t run between wickets.</li>
          <li>Miss = bowled. Hit to a fielder <strong>in the air</strong> (no bounce) = caught.</li>
          <li>Boundary on the full = six; bounce then over the rope = four. Celebrate only on 4 or 6!</li>
        </ul>
      `;
      const row = document.createElement('div');
      row.className = 'btn-row';
      row.append(
        this.btn('Got it', () => this.handlers.onHideInstructions()),
        this.btn('Play', () => this.handlers.onPlay(), 'secondary'),
      );
      panel.appendChild(row);
      this.root.appendChild(panel);
      return;
    }

    // title
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <h1>Pitch Bugs</h1>
      <p class="tagline">3D insect cricket. Smash boundaries. No boring singles.</p>
      <p class="meta">Best: ${this.lastHigh}</p>
    `;
    const row = document.createElement('div');
    row.className = 'btn-row';
    row.append(
      this.btn('Play', () => this.handlers.onPlay()),
      this.btn('Instructions', () => this.handlers.onShowInstructions(), 'secondary'),
      this.btn(audio.muted ? 'Sound Off' : 'Sound On', () => {
        this.handlers.onToggleSound();
        this.render();
      }, 'ghost'),
    );
    panel.appendChild(row);
    this.root.appendChild(panel);
  }

  private btn(
    label: string,
    onClick: () => void,
    variant: 'primary' | 'secondary' | 'ghost' = 'primary',
  ): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (variant === 'primary' ? '' : ` ${variant}`);
    b.textContent = label;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.click();
      onClick();
    });
    return b;
  }

  private iconBtn(label: string, aria: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn';
    b.textContent = label;
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.click();
      onClick();
    });
    return b;
  }
}
