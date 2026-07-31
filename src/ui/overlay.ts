import { audio } from '../audio/audio';
import { SKINS, type SkinId, loadSkin, saveSkin } from '../config/skins';
import { icon } from './icons';

export type OverlayMode = 'title' | 'instructions' | 'paused' | 'gameover' | 'hidden';

export type OverlayHandlers = {
  onPlay: () => void;
  onResume: () => void;
  onRestart: () => void;
  onShowInstructions: () => void;
  onHideInstructions: () => void;
  onToggleSound: () => void;
  onPause: () => void;
  onSelectSkin: (id: SkinId) => void;
};

export class Overlay {
  private root: HTMLElement;
  private mode: OverlayMode = 'title';
  private handlers: OverlayHandlers;
  private lastScore = 0;
  private lastHigh = 0;
  private selectedSkin: SkinId = loadSkin();

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
        this.iconBtn(
          audio.muted ? icon('sound_off', 20) : icon('sound_on', 20),
          'Toggle sound',
          () => {
            this.handlers.onToggleSound();
            this.render();
          },
        ),
        this.iconBtn(
          this.mode === 'paused' ? icon('play', 20) : icon('pause', 20),
          'Pause',
          () => {
            if (this.mode === 'paused') this.handlers.onResume();
            else this.handlers.onPause();
          },
        ),
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
        this.btn(`${icon('play', 18)} Resume`, () => this.handlers.onResume()),
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
        <p class="meta">${isNew ? `${icon('trophy', 18)} New high score!` : `Best: ${this.lastHigh}`}</p>
        <p class="tagline">One more over?</p>
      `;
      const row = document.createElement('div');
      row.className = 'btn-row';
      row.append(
        this.btn(`${icon('play', 18)} Play Again`, () => this.handlers.onPlay()),
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
          <li><strong>Great timing</strong> = boundaries; soft placement = batters run hard for 1s and 2s (3 is rare).</li>
          <li>Fielders <strong>chase and cut off</strong> runs — gaps matter. Catches only on the full.</li>
          <li>Boundary on the full = six; bounce then over the rope = four.</li>
          <li>Early overs stay friendlier; pace and fielding heat up as the innings goes on.</li>
        </ul>
      `;
      const row = document.createElement('div');
      row.className = 'btn-row';
      row.append(
        this.btn('Got it', () => this.handlers.onHideInstructions()),
        this.btn(`${icon('play', 18)} Play`, () => this.handlers.onPlay(), 'secondary'),
      );
      panel.appendChild(row);
      this.root.appendChild(panel);
      return;
    }

    // title
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <h1>${icon('sparkle', 32)} Pitch Bugs</h1>
      <p class="tagline">3D insect cricket. Smash boundaries, run the gaps, watch fielders scramble.</p>
      <p class="meta">${icon('trophy', 18)} Best: ${this.lastHigh}</p>
    `;

    const skinsSection = document.createElement('div');
    skinsSection.className = 'skin-selector';
    const skinsLabel = document.createElement('div');
    skinsLabel.className = 'skin-selector-label';
    skinsLabel.innerHTML = `${icon('palette', 16)} Choose Arena & Species`;
    skinsSection.appendChild(skinsLabel);

    const cards = document.createElement('div');
    cards.className = 'skin-grid';
    for (const skin of Object.values(SKINS)) {
      const card = document.createElement('div');
      card.className = 'skin-card' + (skin.id === this.selectedSkin ? ' active' : '');
      const hexShell = '#' + skin.palettes.striker.shell.toString(16).padStart(6, '0');
      const hexBelly = '#' + skin.palettes.striker.belly.toString(16).padStart(6, '0');
      const hexAccent = '#' + skin.palettes.striker.accent.toString(16).padStart(6, '0');
      card.innerHTML = `
        <div class="skin-icon">${icon(skin.icon as any, 28)}</div>
        <div class="skin-info">
          <div class="skin-name">${skin.name}</div>
          <div class="skin-desc">${skin.description}</div>
        </div>
        <div class="skin-swatches">
          <div class="skin-swatch" style="background:${hexShell}"></div>
          <div class="skin-swatch" style="background:${hexBelly}"></div>
          <div class="skin-swatch" style="background:${hexAccent}"></div>
        </div>
      `;
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        audio.click();
        saveSkin(skin.id);
        this.selectedSkin = skin.id;
        this.handlers.onSelectSkin(skin.id);
        this.render();
      });
      cards.appendChild(card);
    }
    skinsSection.appendChild(cards);
    panel.appendChild(skinsSection);

    const row = document.createElement('div');
    row.className = 'btn-row';
    row.append(
      this.btn(`${icon('play', 18)} Play`, () => this.handlers.onPlay()),
      this.btn(`${icon('settings', 18)} Instructions`, () => this.handlers.onShowInstructions(), 'secondary'),
      this.btn(
        audio.muted ? `${icon('sound_off', 18)} Sound Off` : `${icon('sound_on', 18)} Sound On`,
        () => {
          this.handlers.onToggleSound();
          this.render();
        },
        'ghost',
      ),
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
    b.innerHTML = label;
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
    b.innerHTML = label;
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.click();
      onClick();
    });
    return b;
  }
}
