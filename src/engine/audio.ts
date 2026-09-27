import type { VideoPlan } from "./types";

/** A minor: i – VI – III – VII, one chord per bar (MIDI notes). */
const PROGRESSION = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];
const BASS = [45, 41, 36, 43];
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
    this.out.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    this.out.connect(comp);
    comp.connect(c.destination);
    this.stream = c instanceof AudioContext ? c.createMediaStreamDestination() : null;
    if (this.stream) comp.connect(this.stream);

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
  }

  setMuted(muted: boolean) {
    this.out.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
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

  private pad(t: number, dur: number, chord: number[], fadeOut: number) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045, t + Math.min(0.4, dur * 0.3));
    g.gain.setValueAtTime(0.045, t + dur);
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
}
