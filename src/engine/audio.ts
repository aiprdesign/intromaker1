import type { VideoPlan } from "./types";

/**
 * Procedural trailer soundtrack synthesised with WebAudio:
 * sub drone, kick/hat groove at the plan's BPM, risers into each cut
 * and a cinematic impact on every scene change.
 */
export class Soundtrack {
  readonly ctx: AudioContext;
  readonly out: GainNode;
  readonly stream: MediaStreamAudioDestinationNode;
  private nodes: AudioScheduledSourceNode[] = [];
  private noise: AudioBuffer;

  constructor() {
    this.ctx = new AudioContext();
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.out.connect(comp);
    comp.connect(this.ctx.destination);
    this.stream = this.ctx.createMediaStreamDestination();
    comp.connect(this.stream);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
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
  }

  async close() {
    this.stop();
    await this.ctx.close();
  }

  /** Schedule the soundtrack for `plan`, starting playback at video time `from`. */
  play(plan: VideoPlan, from: number) {
    this.stop();
    const now = this.ctx.currentTime + 0.05;
    const at = (videoT: number) => now + (videoT - from);
    const total = plan.scenes.reduce((a, s) => a + s.duration, 0);
    const beat = 60 / plan.bpm;

    // Drone for the remaining length.
    this.drone(now, total - from);

    // Groove.
    for (let bt = Math.ceil(from / beat) * beat; bt < total - 0.1; bt += beat) {
      const n = Math.round(bt / beat);
      this.kick(at(bt), n % 4 === 0 ? 1 : 0.7);
      this.hat(at(bt + beat / 2), 0.18);
    }

    // Impacts and risers around cuts.
    let start = 0;
    plan.scenes.forEach((s, i) => {
      if (start >= from - 0.01) this.impact(at(start), i === 0 ? 0.8 : 1);
      const riserStart = start + s.duration - Math.min(1.2, s.duration * 0.5);
      if (i < plan.scenes.length - 1 && riserStart >= from) this.riser(at(riserStart), start + s.duration - riserStart);
      start += s.duration;
    });
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

  private drone(t: number, dur: number) {
    if (dur <= 0) return;
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 1.5);
    g.gain.setValueAtTime(0.12, t + Math.max(1.5, dur - 1));
    g.gain.linearRampToValueAtTime(0, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    lp.Q.value = 6;
    const lfo = this.track(c.createOscillator());
    lfo.frequency.value = 0.15;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);
    for (const f of [55, 55.4, 82.4]) {
      const o = this.track(c.createOscillator());
      o.type = "sawtooth";
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur);
    }
    lp.connect(g).connect(this.out);
    lfo.start(t);
    lfo.stop(t + dur);
  }

  private kick(t: number, vel: number) {
    const c = this.ctx;
    const o = this.track(c.createOscillator());
    const g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.45);
  }

  private hat(t: number, vel: number) {
    const c = this.ctx;
    const src = this.noiseSource();
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(hp).connect(g).connect(this.out);
    src.start(t, Math.random());
    src.stop(t + 0.08);
  }

  private impact(t: number, vel: number) {
    const c = this.ctx;
    // Sub boom.
    const o = this.track(c.createOscillator());
    const g = c.createGain();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.0 * vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 1.7);
    // Crack.
    const n = this.noiseSource();
    const bp = c.createBiquadFilter();
    bp.type = "lowpass";
    bp.frequency.setValueAtTime(6000, t);
    bp.frequency.exponentialRampToValueAtTime(200, t + 0.8);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.5 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    n.connect(bp).connect(ng).connect(this.out);
    n.start(t, Math.random());
    n.stop(t + 1);
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
    g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    n.connect(bp).connect(g).connect(this.out);
    n.start(t, Math.random());
    n.stop(t + dur + 0.05);
  }
}
