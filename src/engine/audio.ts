import { arrange, sectionAt, type Arrangement } from "./arrange";
import { styleOf, type SaasStyle } from "./music";
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
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Output ceiling: identity up to 0.89 (-1 dBFS), then a soft knee that never reaches 1. */
function ceilingCurve() {
  const n = 4096;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    const a = Math.abs(x);
    curve[i] = Math.sign(x) * (a < 0.89 ? a : 0.89 + 0.09 * Math.tanh((a - 0.89) / 0.09));
  }
  return curve;
}

/** tanh soft-clip transfer curve (warmth and glue on the drum bus). */
function softClip(k: number) {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

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
  /** Tempo-synced ping-pong echo for keys and plucks. */
  private pingIn: GainNode;
  private pingL: DelayNode;
  private pingR: DelayNode;
  /** Music-bus lowpass (intro/breakdown filtering, sweeps into drops). SFX bypass it. */
  private musicFilter: BiquadFilterNode;
  /** Drum bus with gentle tape-style saturation. */
  private drums: GainNode;
  private musicBus: GainNode;

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
    // Final safety stage: transparent below -1 dBFS, soft knee above, never clips.
    const safety = c.createWaveShaper();
    safety.curve = ceilingCurve();
    this.out.connect(comp).connect(makeup).connect(limiter).connect(safety);
    safety.connect(c.destination);
    this.stream = c instanceof AudioContext ? c.createMediaStreamDestination() : null;
    if (this.stream) safety.connect(this.stream);

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

    this.musicFilter = c.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 20000;
    this.musicFilter.Q.value = 0.9;
    // Music bus: a touch of "air" on top, and a trim so the score sits under the sound design.
    const air = c.createBiquadFilter();
    air.type = "highshelf";
    air.frequency.value = 7000;
    air.gain.value = 3;
    this.musicBus = c.createGain();
    this.musicFilter.connect(air).connect(this.musicBus).connect(this.out);

    this.duck = c.createGain();
    this.duck.connect(this.musicFilter);
    this.duck.connect(this.reverbSend);

    this.drums = c.createGain();
    const sat = c.createWaveShaper();
    sat.curve = softClip(1.8);
    sat.oversample = "2x";
    this.drums.connect(sat).connect(this.musicFilter);

    // Ping-pong delay: echoes bounce left → right, damped so they sit behind the dry sound.
    this.pingIn = c.createGain();
    this.pingIn.gain.value = 0.3;
    this.pingL = c.createDelay(2);
    this.pingR = c.createDelay(2);
    const damp = c.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 3200;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    const panL = c.createStereoPanner();
    panL.pan.value = -0.7;
    const panR = c.createStereoPanner();
    panR.pan.value = 0.7;
    this.pingIn.connect(damp).connect(this.pingL);
    this.pingL.connect(panL).connect(this.musicFilter);
    this.pingL.connect(this.pingR);
    this.pingR.connect(panR).connect(this.musicFilter);
    this.pingR.connect(fb).connect(this.pingL);
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
    this.musicFilter.frequency.cancelScheduledValues(0);
    this.musicFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);
    // The produced SaaS cue is denser than the trailer score: trim it to the same loudness.
    this.musicBus.gain.value = (plan.music ?? plan.style) === "saas" ? 0.36 : 1;
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

  private duckAt(t: number, beat: number, depth = 0.35) {
    const g = this.duck.gain;
    g.setValueAtTime(1, t);
    g.linearRampToValueAtTime(depth, t + 0.01);
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

  /** Punchy kick: fast pitch drop for the "knock", a round sub tail and a click transient. */
  private kick(t: number, vel: number) {
    const c = this.ctx;
    const o = this.track(c.createOscillator());
    const g = c.createGain();
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.06);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.95 * vel, t + 0.003);
    g.gain.setValueAtTime(0.9 * vel, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(this.drums);
    o.start(t);
    o.stop(t + 0.42);
    const n = this.noiseSource();
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2500;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.22 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    n.connect(hp).connect(ng).connect(this.drums);
    n.start(t, Math.random());
    n.stop(t + 0.03);
  }

  private hat(t: number, vel: number, open = false) {
    const c = this.ctx;
    const src = this.noiseSource();
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = open ? 6500 : 8000;
    const g = c.createGain();
    const d = open ? 0.24 : 0.04;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const pan = c.createStereoPanner();
    pan.pan.value = 0.22;
    src.connect(hp).connect(g).connect(pan).connect(this.drums);
    src.start(t, Math.random());
    src.stop(t + d + 0.02);
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
   * A produced launch cue, arranged to the storyboard (see arrange.ts): filtered keys under
   * the hook, a snare-roll + riser build that drops on the brand reveal with a crash and sub
   * hit, the groove through the product beats (sidechain-pumped keys and bass, swung hats),
   * one breakdown mid-film with a re-drop, and a resolving final chord on the call to action.
   */
  private playSaas(plan: VideoPlan, from: number, at: (t: number) => number) {
    const A = arrange(plan);
    const S = styleOf(plan.flavor);
    const { beat, bar, total } = A;
    const s16 = beat / 4;
    this.pingL.delayTime.value = beat * 0.75;
    this.pingR.delayTime.value = beat * 0.75;
    this.automateFilter(A, from, at);
    const kindAt = (t: number) => sectionAt(A, t)?.kind ?? "groove";
    const grooving = (t: number) => {
      const k = kindAt(t);
      return t < A.ending && (k === "drop" || k === "groove" || k === "outro");
    };
    const building = (t: number) => A.builds.some(([b0, b1]) => t >= b0 && t < b1);

    // Harmony, arpeggio and bass, bar by bar.
    for (let b = Math.floor(from / bar); b * bar < A.ending; b++) {
      const t0 = b * bar;
      const chord = S.prog[b % S.prog.length];
      const root = S.roots[b % S.roots.length];
      const kind0 = kindAt(t0 + 0.001);
      const hits = kind0 === "intro" ? [S.keysHits[0]] : S.keysHits;
      hits.forEach((h, hi) => {
        const ht = t0 + h * s16;
        const next = hi + 1 < hits.length ? t0 + hits[hi + 1] * s16 : t0 + bar;
        if (ht < from - 1e-6 || ht >= A.ending) return;
        const dur = Math.min(next, A.ending) - ht;
        if (dur > 0.04) this.keys(S, at(ht), chord, dur, S.keysLevel * (kind0 === "intro" ? 1.5 : kind0 === "break" ? 1.25 : 1));
      });
      if (S.pad > 0) {
        const st = Math.max(t0, from);
        const len = Math.min(t0 + bar, A.ending) - st;
        if (len > 0.05) this.pad(at(st), len, chord, 0.2, S.pad);
      }
      if (S.arp) {
        const step = s16 * S.arp.per16;
        for (let k = 0; k * step < bar - 1e-6; k++) {
          const nt = t0 + k * step + (k % 2 && S.arp.per16 === 1 ? S.swing * s16 : 0);
          if (nt < from || nt >= A.ending) continue;
          const kind = kindAt(nt);
          // The arp rises through the build and carries the breakdown.
          if (kind === "intro" && !building(nt)) continue;
          const note = chord[S.arp.pattern[k % S.arp.pattern.length] % chord.length] + 12;
          const bright = kind === "break" ? 0.45 : building(nt) ? 0.35 + 0.6 * this.buildProgress(A, nt) : 0.9;
          this.pluck(at(nt), note, bright, S.arp.wave, S.arp.level, S.arp.decay);
        }
      }
      for (let k = 0; k < 16; k++) {
        const bt = t0 + k * s16 + (k % 2 ? S.swing * s16 : 0);
        const off = S.bass[k];
        if (off === null || bt < from || bt >= A.ending) continue;
        const kind = kindAt(bt);
        if (kind === "break") {
          // Breakdown: one long root note per bar.
          if (k === 0) this.bassNote(at(bt), bar * 0.95, root + 12, "sine", S.bassLevel * 0.7);
          continue;
        }
        if (!grooving(bt)) continue;
        let len = s16;
        for (let j = k + 1; j < 16 && S.bass[j] === null; j++) len += s16;
        this.bassNote(at(bt), Math.min(len * 0.92, beat * 1.5), root + 12 + off, S.bassWave, S.bassLevel);
      }
    }

    // Drums, 16th by 16th, with swing on the off-16ths.
    for (let k = Math.ceil(from / s16 - 1e-6); k * s16 < A.ending; k++) {
      const t = k * s16;
      const st = k % 16;
      const tt = t + (st % 2 ? S.swing * s16 : 0);
      const kind = kindAt(t);
      if (grooving(t)) {
        if (S.kick.includes(st)) {
          this.kick(at(t), S.kickLevel * (st === 0 ? 1 : 0.92));
          this.duckAt(at(t), beat, S.duck);
        }
        if (S.snare.includes(st)) this.snare(at(t), S.snareKind, 0.9);
        if (S.openHats.includes(st)) this.hat(at(tt), 0.11, true);
        else if (S.hats.includes(st)) this.hat(at(tt), st % 4 === 2 ? 0.12 : st % 2 ? 0.055 : 0.08);
        if (S.shaker) this.shaker(at(tt), S.shaker * (st % 2 ? 1 : 0.6));
      } else if (kind === "break" && !building(t)) {
        if (st % 4 === 2) this.hat(at(tt), 0.035);
        if (S.shaker && st % 2 === 0) this.shaker(at(tt), S.shaker * 0.7);
      }
    }

    // Builds into each drop: snare roll that doubles up, riser, reverse crash.
    for (const [b0, b1] of A.builds) {
      const len = b1 - b0;
      if (b1 < from) continue;
      for (let t = b0; t < b1 - 1e-6; ) {
        const p = (t - b0) / Math.max(0.01, len);
        const step = b1 - t <= beat + 1e-6 ? s16 / 2 : p < 0.5 ? beat / 2 : s16;
        if (t >= from) this.snare(at(t), "snare", 0.18 + 0.55 * p * p, 1 + p * 0.5);
        t += step;
      }
      if (b0 >= from) this.riser(at(b0), len);
      if (b1 - Math.min(1.2, len) >= from) this.reverseSwell(at(b1 - Math.min(1.2, len)), Math.min(1.2, len));
    }
    // Drops land with a crash and a sub hit.
    for (const d of A.drops) {
      if (d < from - 0.01) continue;
      this.crash(at(d), 0.22);
      this.impact(at(d), 0.5);
    }
    // Other cuts get a light accent so the edit and the music feel like one thing.
    A.starts.forEach((st, i) => {
      if (i === 0 || st < from - 0.01 || A.drops.some((d) => Math.abs(d - st) < 0.05) || st >= A.ending) return;
      this.crash(at(st), 0.07);
    });
    // Resolve: the last chord rings out under the call to action.
    if (A.ending >= from && A.ending < total) {
      const b = Math.floor(A.ending / bar);
      const chord = S.prog[b % S.prog.length];
      this.keys(S, at(A.ending), chord, Math.max(beat * 2, total - A.ending) + 0.5, S.keysLevel * 1.1, true);
      this.bassNote(at(A.ending), beat * 2, S.roots[b % S.roots.length] + 12, "sine", S.bassLevel);
      this.kick(at(A.ending), S.kickLevel);
      this.crash(at(A.ending), 0.16);
      this.impact(at(A.ending), 0.35);
    }
  }

  private buildProgress(A: Arrangement, t: number) {
    const b = A.builds.find(([b0, b1]) => t >= b0 && t < b1);
    return b ? (t - b[0]) / Math.max(0.01, b[1] - b[0]) : 1;
  }

  /** Music-bus lowpass: closed under the hook, sweeping open into each drop, dipping in the break. */
  private automateFilter(A: Arrangement, from: number, at: (t: number) => number) {
    const OPEN = 18000;
    const INTRO = 1400;
    const BREAK = 2000;
    const lerpExp = (a: number, b: number, k: number) => a * Math.pow(b / a, Math.max(0, Math.min(1, k)));
    const valueAt = (t: number) => {
      for (const [b0, b1] of A.builds) {
        if (t >= b0 && t < b1) {
          const base = sectionAt(A, b0)?.kind === "intro" ? INTRO * 1.4 : BREAK;
          return lerpExp(base, OPEN, Math.pow((t - b0) / (b1 - b0), 2));
        }
      }
      const s = sectionAt(A, t);
      if (!s) return OPEN;
      if (s.kind === "intro") return lerpExp(INTRO, INTRO * 1.4, (t - s.start) / Math.max(0.01, s.end - s.start));
      if (s.kind === "break") return lerpExp(OPEN, BREAK, (t - s.start) / A.beat);
      return OPEN;
    };
    const f = this.musicFilter.frequency;
    f.cancelScheduledValues(0);
    f.setValueAtTime(valueAt(from), at(from));
    for (let t = from + 0.05; t < A.total; t += 0.05) f.linearRampToValueAtTime(valueAt(t), at(t));
  }

  private keys(S: SaasStyle, t: number, chord: number[], dur: number, level: number, ring = false) {
    if (S.keys === "epiano") this.epiano(t, chord, dur, level, ring);
    else if (S.keys === "supersaw") this.supersaw(t, chord, dur, level, ring);
    else this.stab(t, chord, dur, level);
  }

  /** FM electric piano (Rhodes-style tine): warm body, bell-like attack, gentle stereo spread. */
  private epiano(t: number, chord: number[], dur: number, level: number, ring = false) {
    const c = this.ctx;
    const release = ring ? 2.4 : 0.22;
    chord.forEach((note, i) => {
      const f = hz(note);
      const car = this.track(c.createOscillator());
      car.frequency.value = f;
      const mod = this.track(c.createOscillator());
      mod.frequency.value = f;
      const mg = c.createGain();
      mg.gain.setValueAtTime(f * 2.4, t);
      mg.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.7);
      mod.connect(mg).connect(car.frequency);
      const tine = this.track(c.createOscillator());
      tine.frequency.value = f * 4.02;
      const tg = c.createGain();
      tg.gain.setValueAtTime(level * 0.12, t);
      tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      const g = c.createGain();
      const v = level * (0.85 + ((i * 37) % 10) / 60);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(v * 0.4, t + Math.min(1.2, dur * 0.9 + 0.1));
      g.gain.setValueAtTime(v * 0.4, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
      const pan = c.createStereoPanner();
      pan.pan.value = chord.length > 1 ? (i / (chord.length - 1) - 0.5) * 0.5 : 0;
      car.connect(g);
      tine.connect(tg).connect(g);
      g.connect(pan);
      pan.connect(this.duck);
      pan.connect(this.pingIn);
      const end = t + dur + release + 0.05;
      for (const o of [car, mod, tine]) {
        o.start(t);
        o.stop(end);
      }
    });
  }

  /** Future-bass supersaw chord: three detuned saws per note spread across the stereo field. */
  private supersaw(t: number, chord: number[], dur: number, level: number, ring = false) {
    const c = this.ctx;
    const release = ring ? 2 : 0.06;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(6500, t);
    lp.frequency.exponentialRampToValueAtTime(2200, t + Math.max(0.1, dur));
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.008);
    g.gain.exponentialRampToValueAtTime(level * 0.7, t + Math.min(0.25, dur));
    g.gain.setValueAtTime(level * 0.7, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    lp.connect(g);
    g.connect(this.duck);
    g.connect(this.reverbSend);
    const pans = [-0.6, 0, 0.6].map((v) => {
      const p = c.createStereoPanner();
      p.pan.value = v;
      p.connect(lp);
      return p;
    });
    for (const note of chord) {
      [-14, 0, 14].forEach((det, j) => {
        const o = this.track(c.createOscillator());
        o.type = "sawtooth";
        o.frequency.value = hz(note);
        o.detune.value = det;
        o.connect(pans[j]);
        o.start(t);
        o.stop(t + dur + release + 0.03);
      });
    }
  }

  /** Short filtered chord stab that echoes across the stereo delay. */
  private stab(t: number, chord: number[], dur: number, level: number) {
    const c = this.ctx;
    const d = Math.min(0.22, dur);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + d);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    lp.connect(g);
    g.connect(this.duck);
    g.connect(this.pingIn);
    for (const note of chord) {
      const o = this.track(c.createOscillator());
      o.type = "sawtooth";
      o.frequency.value = hz(note);
      o.connect(lp);
      o.start(t);
      o.stop(t + d + 0.03);
    }
  }

  private bassNote(t: number, dur: number, note: number, wave: "sine" | "sawtooth", level: number) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.008);
    g.gain.setValueAtTime(level * 0.85, t + Math.max(0.02, dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);
    const sub = this.track(c.createOscillator());
    sub.type = "sine";
    sub.frequency.value = hz(note - 12);
    sub.connect(g);
    // Upper harmonic so the bass line reads on laptop and phone speakers.
    const top = this.track(c.createOscillator());
    top.type = wave === "sine" ? "triangle" : "sawtooth";
    top.frequency.value = hz(note);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(wave === "sine" ? 900 : 1600, t);
    lp.frequency.exponentialRampToValueAtTime(wave === "sine" ? 400 : 300, t + Math.max(0.05, dur));
    const tg = c.createGain();
    tg.gain.value = wave === "sine" ? 0.35 : 0.55;
    top.connect(lp).connect(tg).connect(g);
    g.connect(this.duck);
    for (const o of [sub, top]) {
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  private pluck(t: number, note: number, bright: number, wave: OscillatorType = "square", level = 0.055, decay = 0.22) {
    const c = this.ctx;
    const o = this.track(c.createOscillator());
    o.type = wave;
    o.frequency.value = hz(note);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(600 + 4200 * bright, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + Math.max(0.08, decay));
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(lp).connect(g);
    g.connect(this.duck);
    g.connect(this.pingIn);
    o.start(t);
    o.stop(t + decay + 0.03);
  }

  /** Clap (layered bursts), acoustic-style snare (noise + tone body) or a dry finger snap. */
  private snare(t: number, kind: "clap" | "snare" | "snap", vel: number, pitch = 1) {
    const c = this.ctx;
    if (kind === "clap") {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1500 * pitch;
      bp.Q.value = 0.9;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      [0, 0.011, 0.022].forEach((o) => {
        g.gain.setValueAtTime(0.34 * vel, t + o);
        g.gain.exponentialRampToValueAtTime(0.05 * vel, t + o + 0.009);
      });
      g.gain.setValueAtTime(0.26 * vel, t + 0.033);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      const n = this.noiseSource();
      n.connect(bp).connect(g);
      g.connect(this.drums);
      g.connect(this.reverbSend);
      n.start(t, Math.random());
      n.stop(t + 0.22);
      return;
    }
    const n = this.noiseSource();
    const bp = c.createBiquadFilter();
    bp.type = kind === "snap" ? "highpass" : "bandpass";
    bp.frequency.value = (kind === "snap" ? 2600 : 1900) * pitch;
    bp.Q.value = 0.8;
    const g = c.createGain();
    const d = kind === "snap" ? 0.07 : 0.17;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((kind === "snap" ? 0.3 : 0.32) * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    n.connect(bp).connect(g);
    g.connect(this.drums);
    g.connect(this.reverbSend);
    n.start(t, Math.random());
    n.stop(t + d + 0.02);
    if (kind === "snare") {
      const o = this.track(c.createOscillator());
      o.type = "triangle";
      o.frequency.setValueAtTime(210 * pitch, t);
      o.frequency.exponentialRampToValueAtTime(160 * pitch, t + 0.08);
      const og = c.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.22 * vel, t + 0.002);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(og).connect(this.drums);
      o.start(t);
      o.stop(t + 0.12);
    }
  }

  private shaker(t: number, vel: number) {
    const c = this.ctx;
    const n = this.noiseSource();
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 6500;
    bp.Q.value = 1.4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    const pan = c.createStereoPanner();
    pan.pan.value = -0.3;
    n.connect(bp).connect(g).connect(pan).connect(this.drums);
    n.start(t, Math.random());
    n.stop(t + 0.08);
  }

  /** Crash cymbal: bright noise with a long decay into the hall. */
  private crash(t: number, vel: number) {
    const c = this.ctx;
    const n = this.noiseSource();
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 4200;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    n.connect(hp).connect(g);
    g.connect(this.out);
    g.connect(this.reverbSend);
    n.start(t, Math.random());
    n.stop(t + 2);
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
      const cues = SKILL_MAP[sc.skill]?.sfx?.(sc, beat, plan.brand) ?? [];
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
      case "key": {
        // Soft mechanical keystroke: a short filtered tick plus a low thock.
        const n = this.noiseSource();
        const bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 1.4;
        bp.frequency.value = 3200;
        const ng = c.createGain();
        ng.gain.setValueAtTime(0.0001, t);
        ng.gain.exponentialRampToValueAtTime(0.12, t + 0.002);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        n.connect(bp).connect(ng).connect(this.out);
        n.start(t, Math.random());
        n.stop(t + 0.04);
        const o = this.track(c.createOscillator());
        o.type = "sine";
        o.frequency.setValueAtTime(190, t);
        o.frequency.exponentialRampToValueAtTime(120, t + 0.04);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(g).connect(this.out);
        o.start(t);
        o.stop(t + 0.07);
        break;
      }
      case "success": {
        // Two-note rising chime (a fifth), the universal "done" sound.
        [79, 86].forEach((note, i) => {
          const tt = t + i * 0.09;
          const o = this.track(c.createOscillator());
          o.type = "triangle";
          o.frequency.value = hz(note);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, tt);
          g.gain.exponentialRampToValueAtTime(0.1, tt + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.5);
          o.connect(g);
          g.connect(this.out);
          g.connect(this.reverbSend);
          o.start(tt);
          o.stop(tt + 0.55);
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
