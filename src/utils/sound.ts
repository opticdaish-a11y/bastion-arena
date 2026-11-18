type SoundType = 'hit' | 'skill' | 'heal' | 'move' | 'shield' | 'fire' | 'trap' | 'victory' | 'click';

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private getCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public play(type: SoundType) {
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'click') {
      this.tone(ctx, 520, 680, 0.05, 'triangle', 0.08, now);
    } else if (type === 'move') {
      this.tone(ctx, 180, 110, 0.09, 'sine', 0.12, now);
    } else if (type === 'hit') {
      this.tone(ctx, 220, 70, 0.14, 'sawtooth', 0.18, now);
      this.tone(ctx, 130, 50, 0.12, 'square', 0.1, now + 0.02);
    } else if (type === 'shield') {
      this.tone(ctx, 320, 480, 0.16, 'triangle', 0.15, now);
      this.tone(ctx, 480, 640, 0.18, 'sine', 0.1, now + 0.06);
    } else if (type === 'heal') {
      this.tone(ctx, 440, 554, 0.18, 'sine', 0.14, now);
      this.tone(ctx, 554, 659, 0.22, 'sine', 0.12, now + 0.08);
    } else if (type === 'skill') {
      this.tone(ctx, 300, 620, 0.18, 'triangle', 0.15, now);
    } else if (type === 'fire') {
      this.tone(ctx, 160, 65, 0.28, 'sawtooth', 0.2, now);
      this.tone(ctx, 260, 90, 0.24, 'triangle', 0.14, now + 0.04);
    } else if (type === 'trap') {
      this.tone(ctx, 420, 120, 0.18, 'sawtooth', 0.18, now);
    } else if (type === 'victory') {
      const notes = [392, 493.88, 587.33, 783.99];
      notes.forEach((f, i) => {
        this.tone(ctx, f, f, 0.25, 'triangle', 0.15, now + i * 0.11);
      });
    }
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
