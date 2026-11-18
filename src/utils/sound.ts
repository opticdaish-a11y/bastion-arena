type SoundType =
  | 'hit'
  | 'skill'
  | 'heal'
  | 'move'
  | 'shield'
  | 'fire'
  | 'trap'
  | 'victory'
  | 'levelup'
  | 'click';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  public sfxMuted = false;
  public musicEnabled = true;
  private musicStarted = false;

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockAndStartMusic() {
    if (!this.musicEnabled || this.musicStarted) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    this.startMusicLoop();
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled) {
      this.ensureCtx();
      this.startMusicLoop();
    } else {
      this.stopMusicLoop();
    }
  }

  private startMusicLoop() {
    if (this.musicTimer !== null) return;
    this.musicStarted = true;

    // Gentle D-Dorian medieval lute/harp progression (frequencies in Hz)
    const chords = [
      [146.83, 220.0, 261.63, 329.63, 293.66], // Dm9
      [130.81, 196.0, 246.94, 293.66, 261.63], // Cmaj9
      [116.54, 174.61, 220.0, 261.63, 293.66], // Bbmaj7
      [130.81, 196.0, 220.0, 293.66, 329.63],  // Am/C -> resolve
    ];

    const playStep = () => {
      if (!this.musicEnabled) return;
      const ctx = this.ensureCtx();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const bar = Math.floor(this.musicStep / 8) % chords.length;
      const noteIdx = this.musicStep % 8;
      const chord = chords[bar];

      // Warm sustained pad at start of each bar
      if (noteIdx === 0) {
        this.padTone(ctx, chord[0] * 0.5, 3.6, 0.032, now);
        this.padTone(ctx, chord[1], 3.4, 0.018, now);
      }

      // Delicate plucked harp/lute arpeggio
      const pattern = [0, 1, 2, 3, 4, 3, 2, 1];
      const freq = chord[pattern[noteIdx]];
      this.harpPluck(ctx, freq, 0.65, 0.028, now);

      // Subtle occasional high harmonic chime
      if (noteIdx === 4 && bar % 2 === 0) {
        this.harpPluck(ctx, freq * 2, 0.8, 0.015, now + 0.04);
      }

      this.musicStep = (this.musicStep + 1) % 32;
    };

    playStep();
    this.musicTimer = window.setInterval(playStep, 460);
  }

  private stopMusicLoop() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicStarted = false;
  }

  public play(type: SoundType) {
    this.unlockAndStartMusic();
    if (this.sfxMuted) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'click') {
      // Crisp wooden game tile click
      this.tone(ctx, 560, 380, 0.045, 'triangle', 0.07, now);
    } else if (type === 'move') {
      // Soft boot thud on stone
      this.tone(ctx, 165, 85, 0.09, 'sine', 0.14, now);
      this.tone(ctx, 290, 180, 0.06, 'triangle', 0.06, now + 0.02);
    } else if (type === 'hit') {
      // Metallic slash + impact thump
      this.tone(ctx, 320, 75, 0.16, 'sawtooth', 0.16, now);
      this.tone(ctx, 140, 48, 0.15, 'square', 0.11, now + 0.015);
      this.tone(ctx, 880, 440, 0.08, 'triangle', 0.07, now);
    } else if (type === 'shield') {
      // Resonant bronze shield chime
      this.tone(ctx, 330, 495, 0.16, 'triangle', 0.14, now);
      this.tone(ctx, 495, 660, 0.2, 'sine', 0.11, now + 0.05);
    } else if (type === 'heal') {
      // Shimmering triad
      this.tone(ctx, 523.25, 523.25, 0.2, 'sine', 0.11, now);
      this.tone(ctx, 659.25, 659.25, 0.22, 'sine', 0.11, now + 0.07);
      this.tone(ctx, 783.99, 783.99, 0.28, 'sine', 0.12, now + 0.14);
    } else if (type === 'skill') {
      this.tone(ctx, 280, 640, 0.19, 'triangle', 0.14, now);
      this.tone(ctx, 420, 840, 0.16, 'sine', 0.09, now + 0.04);
    } else if (type === 'fire') {
      this.tone(ctx, 190, 55, 0.3, 'sawtooth', 0.18, now);
      this.tone(ctx, 310, 95, 0.24, 'triangle', 0.13, now + 0.04);
    } else if (type === 'trap') {
      this.tone(ctx, 460, 110, 0.2, 'sawtooth', 0.17, now);
    } else if (type === 'levelup') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this.tone(ctx, f, f, 0.22, 'triangle', 0.12, now + i * 0.08);
      });
    } else if (type === 'victory') {
      const notes = [392, 493.88, 587.33, 783.99];
      notes.forEach((f, i) => {
        this.tone(ctx, f, f, 0.34, 'triangle', 0.14, now + i * 0.12);
        this.tone(ctx, f * 0.5, f * 0.5, 0.36, 'sine', 0.1, now + i * 0.12);
      });
    }
  }

  private harpPluck(ctx: AudioContext, freq: number, dur: number, vol: number, start: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  private padTone(ctx: AudioContext, freq: number, dur: number, vol: number, start: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  private tone(
    ctx: AudioContext,
    fStart: number,
    fEnd: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    startTime: number
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), startTime + dur);

    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
  }
}

export const sound = new SoundEngine();
