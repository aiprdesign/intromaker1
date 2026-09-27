import { SKILL_MAP } from "./skills";
import type { SfxKind, VideoPlan } from "./types";

/** A minor: i – VI – III – VII, one chord per bar (MIDI notes). */
const PROGRESSION = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];
const BASS = [45, 41, 36, 43];
/** C major: I – V – vi – IV, bright and optimistic for product launches. */
const PROGRESSION_MAJOR = [
  [60, 64, 67],
  [55, 59, 62],
  [57, 60, 64],
  [53, 57, 60],
];
const BASS_MAJOR = [36, 43, 45, 41];
/** Cmaj7 – Am7 – Fmaj7 – G7: warm, soft-keys feel. */
const PROGRESSION_MAJ7 = [
  [60, 64, 67, 71],
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [55, 59, 62, 65],
];
const BASS_MAJ7 = [36, 45, 41, 43];

interface Flavor {
  prog: number[][];
  bass: number[];
  pad: number;
  arp: { wave: OscillatorType; div: number; level: number; decay: number; pattern: number[] } | null;
  stabs: boolean;
  kick: { vel: number; every: number };
  clap: boolean;
  hats: { div: number; vel: [number, number] };
  bassDiv: number;
}

/** Score flavours for SaaS templates. */
const FLAVORS: Record<NonNullable<VideoPlan["flavor"]>, Flavor> = {
  tech: {
    prog: PROGRESSION_MAJOR, bass: BASS_MAJOR, pad: 0.03,
    arp: { wave: "square", div: 2, level: 0.055, decay: 0.22, pattern: [0, 1, 2, 1, 0, 2, 1, 2] },
    stabs: false, kick: { vel: 0.6, every: 1 }, clap: true, hats: { div: 4, vel: [0.06, 0.035] }, bassDiv: 2,
  },
  soft: {
    prog: PROGRESSION_MAJ7, bass: BASS_MAJ7, pad: 0.045,
    arp: { wave: "triangle", div: 2, level: 0.06, decay: 0.5, pattern: [0, 2, 1, 3, 2, 1, 3, 2] },
    stabs: false, kick: { vel: 0.35, every: 2 }, clap: false, hats: { div: 2, vel: [0.025, 0.015] }, bassDiv: 4,
  },
  pop: {
    prog: PROGRESSION_MAJOR, bass: BASS_MAJOR, pad: 0.03,
    arp: { wave: "square", div: 2, level: 0.06, decay: 0.16, pattern: [0, 2, 1, 2, 0, 2, 1, 2] },
    stabs: false, kick: { vel: 0.72, every: 1 }, clap: true, hats: { div: 4, vel: [0.07, 0.04] }, bassDiv: 0.5,
  },
  minimal: {
    prog: PROGRESSION, bass: BASS, pad: 0.018,
    arp: null,
    stabs: true, kick: { vel: 0.8, every: 1 }, clap: false, hats: { div: 4, vel: [0.08, 0.04] }, bassDiv: 1,
  },
  neon: {
    prog: PROGRESSION, bass: BASS, pad: 0.035,
    arp: { wave: "sawtooth", div: 4, level: 0.035, decay: 0.14, pattern: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2] },
    stabs: false, kick: { vel: 0.7, every: 1 }, clap: true, hats: { div: 2, vel: [0.06, 0.06] }, bassDiv: 0.5,
  },
};
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * Procedural trailer score synthesised with WebAudio and arranged to the storyboard:
 * - hook: sparse kick + pad, building tension
 * - body: full groove (kick, hats, bass) with sidechain-pumped pads
 * - title/outro: trailer "braam" hits
 * - every cut: reverse swell into a sub impact
 * - final scene: groove drops out, pad and reverb tail ring out
 */
export class Soundtrack {
  readonly ctx: AudioContext | OfflineAudioContext;
  readonly out: GainNode;
  /** Live stream of the mix (realtime contexts only). */
  readonly stream: MediaStreamAudioDestinationNode | null;
  private nodes: AudioScheduledSourceNode[] = [];
  private noise: AudioBuffer;
  private reverb: ConvolverNode;
  private reverbSend: GainNode;
  /** Pads and bass route through here so kicks can duck them. */
  private duck: GainNode;
  /** Tempo-synced echo for plucks. */
  private delay: DelayNode;
  private delayIn: GainNode;

  /** Render the full score for `plan` offline, faster than realtime. */
  static async renderOffline(plan: VideoPlan, sampleRate = 48000): Promise<AudioBuffer> {
    const total = plan.scenes.reduce((a, s) => a + s.duration, 0);
    const off = new OfflineAudioContext(2, Math.ceil(total * sampleRate), sampleRate);
    new Soundtrack(off).play(plan, 0, 0);
    return off.startRendering();
  }

  constructor(ctx?: AudioContext | OfflineAudioContext) {
    this.ctx = ctx ?? new AudioContext();
    const c = this.ctx;
    this.out = c.createGain();
    this.out.gain.value = 1;
    // Mastering chain: glue compressor → makeup gain → brick-wall-ish limiter (≈ -14 dB RMS, web loudness).
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.attack.value = 0.008;
    comp.release.value = 0.2;
    const makeup = c.createGain();
    makeup.gain.value = 2.4;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    this.out.connect(comp).connect(makeup).connect(limiter);
    limiter.connect(c.destination);
    this.stream = c instanceof AudioContext ? c.createMediaStreamDestination() : null;
    if (this.stream) limiter.connect(this.stream);

    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Generated hall impulse response.
    this.reverb = c.createConvolver();
    const irLen = Math.floor(c.sampleRate * 2.8);
    const ir = c.createBuffer(2, irLen, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
    }
    this.reverb.buffer = ir;
    this.reverbSend = c.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.out);

    this.duck = c.createGain();
    this.duck.connect(this.out);
    this.duck.connect(this.reverbSend);

    this.delayIn = c.createGain();
    this.delay = c.createDelay(2);
    const fb = c.createGain();
    fb.gain.value = 0.32;
    const damp = c.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 3500;
    this.delayIn.connect(this.delay);
    this.delay.connect(damp).connect(fb).connect(this.delay);
    damp.connect(this.duck);
  }

  setMuted(muted: boolean) {
    this.out.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  stop() {
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.nodes = [];
    this.duck.gain.cancelScheduledValues(0);
    this.duck.gain.value = 1;
  }

  async close() {
    this.stop();
    if (this.ctx instanceof AudioContext) await this.ctx.close();
  }

  /** Schedule the score for `plan`, starting playback at video time `from`. */
  play(plan: VideoPlan, from: number, lead = 0.05) {
    this.stop();
    const now = this.ctx.currentTime + lead;
    const at = (videoT: number) => now + (videoT - from);
    this.scheduleSfx(plan, from, at);
    if ((plan.music ?? plan.style) === "saas") {
      this.playSaas(plan, from, at);
      return;
    }
    const total = plan.scenes.reduce((a, s) => a + s.duration, 0);
    const beat = 60 / plan.bpm;
    const bar = beat * 4;

    const starts: number[] = [];
    let acc = 0;
    for (const s of plan.scenes) {
      starts.push(acc);
      acc += s.duration;
    }
    const hookEnd = plan.scenes.length > 2 ? starts[1] : 0;
    const outroStart = plan.scenes.length > 1 ? starts[starts.length - 1] : total;

    // Harmony: pad + bass per bar.
    for (let b = Math.floor(from / bar); b * bar < total; b++) {
      const t0 = b * bar;
      const dur = Math.min(bar, total - t0);
      const chord = PROGRESSION[b % PROGRESSION.length];
      const start = Math.max(t0, from);
      const len = t0 + dur - start;
      if (len <= 0.05) continue;
      const fadeOut = t0 + dur >= total - 0.01 ? 2.2 : 0.15;
      this.pad(at(start), len, chord, fadeOut);
      if (t0 >= hookEnd) {
        for (let k = 0; k < 4; k += 2) {
          const bt = t0 + k * beat;
          if (bt >= from && bt < outroStart + beat && bt < total) this.bass(at(bt), beat * 1.8, BASS[b % BASS.length]);
        }
      }
    }

    // Drums with sidechain ducking.
    for (let bt = Math.ceil(from / beat - 1e-6) * beat; bt < total - 0.05; bt += beat) {
      const n = Math.round(bt / beat);
      const inHook = bt < hookEnd;
      const inOutro = bt >= outroStart + beat;
      if (inOutro) continue;
      if (inHook && n % 2 === 1) continue; // half-time build in the hook
      this.kick(at(bt), n % 4 === 0 ? 1 : 0.75);
      this.duckAt(at(bt), beat);
      if (!inHook) {
        this.hat(at(bt + beat / 2), 0.16);
        if (n % 4 === 3) this.hat(at(bt + beat * 0.75), 0.1);
      }
    }

    // Impacts, braams and swells around cuts.
    plan.scenes.forEach((s, i) => {
      const st = starts[i];
      if (st >= from - 0.01) {
        this.impact(at(st), i === 0 ? 0.7 : 1);
        if (i === 1 || i === plan.scenes.length - 1) this.braam(at(st), Math.min(3.5, s.duration + 1.5));
      }
      const swell = Math.min(1.1, s.duration * 0.45);
      const swellStart = st + s.duration - swell;
      if (i < plan.scenes.length - 1 && swellStart >= from) {
        this.riser(at(swellStart), swell);
        this.reverseSwell(at(swellStart + swell * 0.3), swell * 0.7);
      }
    });
    // Final tail hit.
    if (total - 0.02 >= from) this.impact(at(total - 0.02), 0.6);
  }

  private track<T extends AudioScheduledSourceNode>(n: T) {
    this.nodes.push(n);
    return n;
  }

  private noiseSource() {
    const src = this.track(this.ctx.createBufferSource());
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  private duckAt(t: number, beat: number) {
    const g = this.duck.gain;
    g.setValueAtTime(1, t);
    g.linearRampToValueAtTime(0.35, t + 0.01);
    g.setTargetAtTime(1, t + 0.02, beat * 0.25);
  }

  private pad(t: number, dur: number, chord: number[], fadeOut: number, level = 0.045) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + Math.min(0.4, dur * 0.3));
    g.gain.setValueAtTime(level, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + fadeOut);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(1400, t + dur);
    lp.Q.value = 2;
    lp.connect(g).connect(this.duck);
    for (const note of chord) {
      for (const det of [-7, 7]) {
        const o = this.track(c.createOscillator());
        o.type = "sawtooth";
        o.frequency.value = hz(note);
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + fadeOut + 0.05);
      }
    }
  }

  private bass(t: number, dur: number, note: number) {
    const c = this.ctx;
    const o = this.track(c.createOscillator());
    o.type = "sawtooth";
    o.frequency.value = hz(note);
    const sub = this.track(c.createOscillator());
    sub.type = "sine";
    sub.frequency.value = hz(note - 12);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp);
    sub.connect(lp);
    lp.connect(g).connect(this.duck);
    o.start(t);
    sub.start(t);
    o.stop(t + dur + 0.05);
    sub.stop(t + dur + 0.05);
  }

  private kick(t: number, vel: number) {
    const c = this.ctx;
    const o = this.track(c.createOscillator());
    const g = c.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.13);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.95 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.45);
    // Click transient.
    const n = this.noiseSource();
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3000;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.25 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
    n.connect(hp).connect(ng).connect(this.out);
    n.start(t, Math.random());
    n.stop(t + 0.03);
  }

  private hat(t: number, vel: number) {
    const c = this.ctx;
    const src = this.noiseSource();
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7500;
    const g = c.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp).connect(g).connect(this.out);
    src.start(t, Math.random());
    src.stop(t + 0.07);
  }

  private impact(t: number, vel: number) {
    const c = this.ctx;
    const o = this.track(c.createOscillator());
    const g = c.createGain();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(26, t + 1.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.0 * vel, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 1.9);
    const n = this.noiseSource();
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(7000, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.9);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.45 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    n.connect(lp).connect(ng);
    ng.connect(this.out);
    ng.connect(this.reverbSend);
    n.start(t, Math.random());
    n.stop(t + 1.1);
  }

  /** Trailer brass "BRAAAM": detuned low saws with a filter that blasts open. */
  private braam(t: number, dur: number) {
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 4;
    lp.frequency.setValueAtTime(120, t);
    lp.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
    lp.frequency.exponentialRampToValueAtTime(300, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g);
    g.connect(this.out);
    g.connect(this.reverbSend);
    for (const [note, det] of [
      [33, -12],
      [33, 12],
      [45, -8],
      [45, 8],
      [52, 0],
    ]) {
      const o = this.track(c.createOscillator());
      o.type = "sawtooth";
      o.frequency.value = hz(note);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  private riser(t: number, dur: number) {
    if (dur <= 0.05) return;
    const c = this.ctx;
    const n = this.noiseSource();
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(8000, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    n.connect(bp).connect(g).connect(this.out);
    n.start(t, Math.random());
    n.stop(t + dur + 0.05);
  }

  /** Reverse-cymbal style swell that sucks into the cut. */
  private reverseSwell(t: number, dur: number) {
    if (dur <= 0.05) return;
    const c = this.ctx;
    const n = this.noiseSource();
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 4000;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + dur);
    g.gain.setValueAtTime(0.0001, t + dur + 0.005);
    n.connect(hp).connect(g);
    g.connect(this.out);
    g.connect(this.reverbSend);
    n.start(t, Math.random());
    n.stop(t + dur + 0.02);
  }

  /* ───────── SaaS score ───────── */

  /**
   * Upbeat product-launch track: a filtered pad + pluck build through the hook, then
   * four-on-the-floor kick, claps, shakers, bass and delayed plucks; drops out for the ending.
   */
  private playSaas(plan: VideoPlan, from: number, at: (t: number) => number) {
    const total = plan.scenes.reduce((a, s) => a + s.duration, 0);
    const beat = 60 / plan.bpm;
    const bar = beat * 4;
    this.delay.delayTime.value = beat * 0.75;
    const starts: number[] = [];
    let acc = 0;
    for (const sc of plan.scenes) {
      starts.push(acc);
      acc += sc.duration;
    }
    const dropIn = plan.scenes.length > 2 ? starts[1] : 0;
    const ending = Math.max(dropIn, total - beat * 2);

    const F = FLAVORS[plan.flavor ?? "tech"];
    for (let b = Math.floor(from / bar); b * bar < total; b++) {
      const t0 = b * bar;
      const chord = F.prog[b % 4];
      const start = Math.max(t0, from);
      const len = Math.min(bar, total - t0) - (start - t0);
      if (len > 0.05) this.pad(at(start), len, chord, t0 + bar >= total - 0.01 ? 2.4 : 0.15, F.pad);
      // Arpeggio (filtered during the hook build).
      if (F.arp) {
        const steps = 4 * F.arp.div;
        for (let k = 0; k < steps; k++) {
          const nt = t0 + k * (beat / F.arp.div);
          if (nt < from || nt >= Math.min(total, ending + beat)) continue;
          const idx = F.arp.pattern[k % F.arp.pattern.length] % chord.length;
          const note = chord[idx] + 12 + (k === steps - 1 ? 12 : 0);
          const build = nt < dropIn ? 0.25 + 0.75 * (nt / Math.max(0.01, dropIn)) : 1;
          this.pluck(at(nt), note, build, F.arp.wave, F.arp.level, F.arp.decay);
        }
      }
      // Off-beat chord stabs (minimal techno).
      if (F.stabs && t0 >= dropIn) {
        for (let k = 0; k < 4; k++) {
          const nt = t0 + k * beat + beat / 2;
          if (nt >= from && nt < ending) chord.forEach((n) => this.pluck(at(nt), n, 0.6, "sawtooth", 0.03, 0.12));
        }
      }
      if (t0 >= dropIn) {
        const bars = F.bass[b % 4];
        for (let bt = t0; bt < t0 + bar - 1e-6; bt += beat * F.bassDiv) {
          const off = F.bassDiv <= 0.5 ? (Math.round((bt - t0) / (beat * F.bassDiv)) % 2 ? 12 : 0) : 0;
          if (bt >= from && bt < ending && bt < total) this.bass(at(bt), beat * Math.max(0.45, F.bassDiv * 0.8), bars + 12 + off);
        }
      }
    }
    const step = beat / F.hats.div;
    for (let bt = Math.ceil(from / step - 1e-6) * step; bt < total - 0.05; bt += step) {
      const idx = Math.round(bt / step);
      const onBeat = idx % F.hats.div === 0;
      const n = Math.round(bt / beat);
      if (bt < dropIn || bt >= ending) continue;
      if (onBeat && n % F.kick.every === 0) {
        this.kick(at(bt), F.kick.vel);
        this.duckAt(at(bt), beat);
      }
      if (onBeat && F.clap && n % 2 === 1) this.clap(at(bt));
      this.hat(at(bt), idx % 2 ? F.hats.vel[1] : F.hats.vel[0]);
    }
    // Build into the drop and a soft hit on each cut.
    plan.scenes.forEach((sc, i) => {
      const st = starts[i];
      if (i > 0 && st >= from - 0.01) this.impact(at(st), i === 1 ? 0.55 : 0.3);
      if (i === 0 && dropIn - 1.2 >= from) this.riser(at(Math.max(0, dropIn - 1.4)), Math.min(1.4, dropIn));
    });
    if (total - 0.02 >= from) this.impact(at(total - beat * 2), 0.45);
  }

  private pluck(t: number, note: number, bright: number, wave: OscillatorType = "square", level = 0.055, decay = 0.22) {
    const c = this.ctx;
    const o = this.track(c.createOscillator());
    o.type = wave;
    o.frequency.value = hz(note);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(600 + 3600 * bright, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(lp).connect(g);
    g.connect(this.duck);
    g.connect(this.delayIn);
    o.start(t);
    o.stop(t + decay + 0.03);
  }

  private clap(t: number) {
    const c = this.ctx;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1500;
    bp.Q.value = 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    // Three quick bursts, then a short tail — the classic clap shape.
    [0, 0.011, 0.022].forEach((o) => {
      g.gain.setValueAtTime(0.32, t + o);
      g.gain.exponentialRampToValueAtTime(0.05, t + o + 0.009);
    });
    g.gain.setValueAtTime(0.25, t + 0.033);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    const n = this.noiseSource();
    n.connect(bp).connect(g);
    g.connect(this.out);
    g.connect(this.reverbSend);
    n.start(t, Math.random());
    n.stop(t + 0.2);
  }

  /* ───────── Sound effects ───────── */

  private scheduleSfx(plan: VideoPlan, from: number, at: (t: number) => number) {
    const beat = 60 / plan.bpm;
    let start = 0;
    for (const sc of plan.scenes) {
      if (sc.transition !== "cut" && start > 0 && start >= from) {
        const kind: SfxKind = sc.transition === "whip" || sc.transition === "wipe" ? "whoosh" : "swoosh";
        this.sfx(at(Math.max(from, start - 0.12)), kind);
      }
      const cues = SKILL_MAP[sc.skill]?.sfx?.(sc, beat) ?? [];
      for (const cue of cues) {
        const t = start + cue.t;
        if (cue.t >= 0 && cue.t < sc.duration && t >= from) this.sfx(at(t), cue.kind);
      }
      start += sc.duration;
    }
  }

  private sfx(t: number, kind: SfxKind) {
    const c = this.ctx;
    switch (kind) {
      case "whoosh":
      case "swoosh": {
        const dur = kind === "whoosh" ? 0.55 : 0.32;
        const n = this.noiseSource();
        const bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(kind === "whoosh" ? 350 : 900, t);
        bp.frequency.exponentialRampToValueAtTime(kind === "whoosh" ? 2600 : 5000, t + dur * 0.55);
        bp.frequency.exponentialRampToValueAtTime(500, t + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(kind === "whoosh" ? 0.32 : 0.2, t + dur * 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const pan = c.createStereoPanner();
        pan.pan.setValueAtTime(-0.7, t);
        pan.pan.linearRampToValueAtTime(0.7, t + dur);
        n.connect(bp).connect(g).connect(pan);
        pan.connect(this.out);
        pan.connect(this.reverbSend);
        n.start(t, Math.random());
        n.stop(t + dur + 0.02);
        break;
      }
      case "click": {
        const o = this.track(c.createOscillator());
        o.type = "sine";
        o.frequency.setValueAtTime(2400, t);
        o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        o.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + 0.06);
        const n = this.noiseSource();
        const hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 5000;
        const ng = c.createGain();
        ng.gain.setValueAtTime(0.18, t);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
        n.connect(hp).connect(ng).connect(this.out);
        n.start(t, Math.random());
        n.stop(t + 0.02);
        break;
      }
      case "pop":
      case "tick": {
        const o = this.track(c.createOscillator());
        o.type = "sine";
        const f0 = kind === "pop" ? 520 : 1500;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * (kind === "pop" ? 2.1 : 1.2), t + 0.05);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(kind === "pop" ? 0.16 : 0.08, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "pop" ? 0.13 : 0.05));
        o.connect(g);
        g.connect(this.out);
        g.connect(this.reverbSend);
        o.start(t);
        o.stop(t + 0.15);
        break;
      }
      case "shimmer": {
        [84, 88, 91, 96].forEach((note, i) => {
          const tt = t + i * 0.045;
          const o = this.track(c.createOscillator());
          o.type = "sine";
          o.frequency.value = hz(note);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, tt);
          g.gain.exponentialRampToValueAtTime(0.05, tt + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.9);
          o.connect(g);
          g.connect(this.out);
          g.connect(this.reverbSend);
          o.start(tt);
          o.stop(tt + 0.95);
        });
        break;
      }
      case "strike": {
        const n = this.noiseSource();
        const bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 2;
        bp.frequency.setValueAtTime(900, t);
        bp.frequency.exponentialRampToValueAtTime(2800, t + 0.16);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        n.connect(bp).connect(g).connect(this.out);
        n.start(t, Math.random());
        n.stop(t + 0.2);
        break;
      }
    }
  }
}
