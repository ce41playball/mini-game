const MUTE_STORAGE_KEY = 'patisserie_stack_muted_v1';

// Pentatonic frequencies starting at C5 for ascending music-box feedback
const PENTATONIC_SCALE = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
  1174.66, // D6
  1318.51, // E6
  1567.98, // G6
  1760.0, // A6
  2093.0, // C7
];

class PatisserieAudio {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
    } catch {
      this.muted = false;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, String(this.muted));
    } catch {
      // Ignore storage failures in restricted contexts
    }
    if (!this.muted) {
      this.ensureContext();
      this.playButton();
    }
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public playButton(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.055);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playHookRelease(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.065);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playPerfect(combo: number, recoveredWidth: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const idx = Math.min(Math.max(0, combo - 1), PENTATONIC_SCALE.length - 1);
    const freq = PENTATONIC_SCALE[idx];

    // Warm celesta chime
    const osc = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(freq * 2, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.035, now);
    harmonicGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    harmonic.start(now);
    osc.stop(now + 0.36);
    harmonic.stop(now + 0.24);

    if (recoveredWidth) {
      // Shimmering 3-note harp arpeggio for width recovery reward
      const chord = [freq, freq * 1.25, freq * 1.5];
      chord.forEach((noteFreq, i) => {
        const start = now + i * 0.055;
        const cOsc = ctx.createOscillator();
        const cGain = ctx.createGain();
        cOsc.type = 'sine';
        cOsc.frequency.setValueAtTime(noteFreq, start);
        cGain.gain.setValueAtTime(0.001, start);
        cGain.gain.linearRampToValueAtTime(0.09, start + 0.015);
        cGain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        cOsc.connect(cGain);
        cGain.connect(ctx.destination);
        cOsc.start(start);
        cOsc.stop(start + 0.36);
      });
    }
  }

  public playSlice(overlapRatio: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Soft sponge cake landing thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(195 + overlapRatio * 45, now);
    thud.frequency.exponentialRampToValueAtTime(75, now + 0.11);

    thudGain.gain.setValueAtTime(0.16, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.14);

    // Crisp pastry knife slice transient
    const sliceOsc = ctx.createOscillator();
    const sliceGain = ctx.createGain();
    sliceOsc.type = 'triangle';
    sliceOsc.frequency.setValueAtTime(920, now);
    sliceOsc.frequency.exponentialRampToValueAtTime(340, now + 0.07);

    sliceGain.gain.setValueAtTime(0.075, now);
    sliceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    sliceOsc.connect(sliceGain);
    sliceGain.connect(ctx.destination);
    sliceOsc.start(now);
    sliceOsc.stop(now + 0.085);
  }

  public playMiss(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [392.0, 329.63, 261.63]; // G4 -> E4 -> C4 gentle descend
    notes.forEach((freq, i) => {
      const start = now + i * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.94, start + 0.16);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.19);
    });
  }
}

export const patisserieAudio = new PatisserieAudio();
