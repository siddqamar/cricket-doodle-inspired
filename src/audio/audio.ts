import { loadMuted, saveMuted } from '../utils/storage';

/**
 * Original procedural SFX via Web Audio API.
 * No external samples — keeps the bundle tiny and IP-clean.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceRunning = false;
  muted = loadMuted();

  async ensure(): Promise<void> {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMuted(muted);
    if (this.master) {
      this.master.gain.value = muted ? 0 : 0.55;
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private out(): GainNode | null {
    return this.master;
  }

  click(): void {
    void this.beep(880, 0.04, 'sine', 0.08);
  }

  batHit(power = 1): void {
    void this.ensure().then(() => {
      if (!this.ctx || !this.out()) return;
      const t = this.now();
      // Body thump
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 + power * 40, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.45 * power, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(g);
      g.connect(this.out()!);
      osc.start(t);
      osc.stop(t + 0.15);
      // Crack noise
      this.noiseBurst(0.05, 0.2 * power, 1200);
    });
  }

  cheer(intensity = 1): void {
    void this.ensure().then(() => {
      if (!this.ctx || !this.out()) return;
      this.noiseBurst(0.35 * intensity, 0.18 * intensity, 900, true);
      const t = this.now();
      for (let i = 0; i < 4; i++) {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = 'sine';
        const f = 400 + Math.random() * 500;
        osc.frequency.setValueAtTime(f, t + i * 0.03);
        g.gain.setValueAtTime(0.0001, t + i * 0.03);
        g.gain.exponentialRampToValueAtTime(0.08 * intensity, t + i * 0.03 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.03 + 0.2);
        osc.connect(g);
        g.connect(this.out()!);
        osc.start(t + i * 0.03);
        osc.stop(t + i * 0.03 + 0.22);
      }
    });
  }

  /** Longer crowd swell for sixes. */
  cheerBig(): void {
    void this.ensure().then(() => {
      if (!this.ctx || !this.out()) return;
      this.noiseBurst(0.55, 0.28, 850, true);
      this.noiseBurst(0.7, 0.14, 1400, true);
      const t = this.now();
      for (let i = 0; i < 8; i++) {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        const f = 320 + Math.random() * 680;
        const start = t + i * 0.04;
        osc.frequency.setValueAtTime(f, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.1, start + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.connect(g);
        g.connect(this.out()!);
        osc.start(start);
        osc.stop(start + 0.38);
      }
    });
  }

  wicket(): void {
    void this.ensure().then(() => {
      if (!this.ctx || !this.out()) return;
      const t = this.now();
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.35);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(g);
      g.connect(this.out()!);
      osc.start(t);
      osc.stop(t + 0.42);
      this.noiseBurst(0.12, 0.22, 600);
    });
  }

  startAmbience(): void {
    void this.ensure().then(() => {
      if (!this.ctx || !this.out() || this.ambienceRunning) return;
      this.ambienceRunning = true;
      const bufferSize = 2 * this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.15;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const g = this.ctx.createGain();
      g.gain.value = 0.04;
      src.connect(filter);
      filter.connect(g);
      g.connect(this.out()!);
      src.start();
    });
  }

  private async beep(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
  ): Promise<void> {
    await this.ensure();
    if (!this.ctx || !this.out()) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.out()!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(
    duration: number,
    volume: number,
    cutoff: number,
    swell = false,
  ): void {
    if (!this.ctx || !this.out()) return;
    const t = this.now();
    const len = Math.max(1, Math.floor(duration * this.ctx.sampleRate));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    const g = this.ctx.createGain();
    if (swell) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(volume, t + duration * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    } else {
      g.gain.setValueAtTime(volume, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    }
    src.connect(filter);
    filter.connect(g);
    g.connect(this.out()!);
    src.start(t);
    src.stop(t + duration + 0.02);
  }
}

export const audio = new AudioEngine();
