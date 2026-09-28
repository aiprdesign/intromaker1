/**
 * Production sheets for the SaaS score: harmony, instrument choices, groove and mix per music
 * flavour. Pure data, shared by the synthesiser (audio.ts) and the picture (the camera punches
 * on the kicks the pattern actually plays).
 *
 * The references are the cues that sit under the best launch films:
 * - tech:    modern deep house (Linear, Vercel, Raycast): Rhodes chords, off-beat bass, open hats.
 * - soft:    lo-fi / chill keys (Notion, Apple): warm maj9 voicings, half-time kick, swing.
 * - pop:     future bass (Stripe, Figma, Framer): chopped supersaw chords, big sidechain pump.
 * - minimal: sleek tech-house: short stabs, rolling 16th bass, tight hats.
 * - neon:    synthwave: saw pads, 16th arpeggio, gated snare.
 */
import type { VideoPlan } from "./types";

export type Flavor = NonNullable<VideoPlan["flavor"]>;

export interface SaasStyle {
  /** Chord voicings (MIDI), one per bar. */
  prog: number[][];
  /** Bass roots (MIDI), one per bar. */
  roots: number[];
  /** Chord instrument. */
  keys: "epiano" | "supersaw" | "stab";
  /** Chord hits in 16ths within the bar; each rings until the next. */
  keysHits: number[];
  keysLevel: number;
  /** Sustained supersaw pad under the keys (0 = none). */
  pad: number;
  arp: { wave: OscillatorType; level: number; decay: number; per16: number; pattern: number[] } | null;
  /** 16-step bass line: semitone offset from the root, or null for a rest. */
  bass: (number | null)[];
  bassWave: "sine" | "sawtooth";
  bassLevel: number;
  kick: number[];
  kickLevel: number;
  snare: number[];
  snareKind: "clap" | "snare" | "snap";
  /** Closed hats on these 16ths; open hats on `openHats`. */
  hats: number[];
  openHats: number[];
  shaker: number;
  /** Delay applied to odd 16ths, as a fraction of a 16th (0 = straight). */
  swing: number;
  /** Sidechain depth: how far the kick ducks keys and bass (lower = more pump). */
  duck: number;
}

const ALL16 = Array.from({ length: 16 }, (_, i) => i);
const OFF8 = [2, 6, 10, 14];

export const SAAS_STYLES: Record<Flavor, SaasStyle> = {
  tech: {
    // F major: Fmaj9 – Am7 – Dm9 – B♭maj9 (I – iii – vi – IV).
    prog: [
      [53, 57, 60, 64, 67],
      [52, 57, 60, 64, 67],
      [50, 53, 57, 60, 64],
      [50, 53, 57, 58, 62],
    ],
    roots: [41, 45, 38, 46],
    keys: "epiano",
    keysHits: [0, 6, 10],
    keysLevel: 0.075,
    pad: 0.012,
    arp: { wave: "triangle", level: 0.05, decay: 0.18, per16: 2, pattern: [4, 2, 3, 1, 4, 3, 2, 0] },
    bass: [null, null, 0, null, null, null, 0, 12, null, null, 0, null, null, null, 0, 7],
    bassWave: "sine",
    bassLevel: 0.26,
    kick: [0, 4, 8, 12],
    kickLevel: 0.95,
    snare: [4, 12],
    snareKind: "clap",
    hats: ALL16,
    openHats: OFF8,
    shaker: 0.035,
    swing: 0.12,
    duck: 0.4,
  },
  soft: {
    // C major lo-fi: Cmaj9 – Am9 – Dm9 – G13.
    prog: [
      [52, 55, 59, 62],
      [52, 55, 59, 60],
      [53, 57, 60, 64],
      [53, 57, 59, 64],
    ],
    roots: [36, 45, 38, 43],
    keys: "epiano",
    keysHits: [0, 7],
    keysLevel: 0.085,
    pad: 0,
    arp: { wave: "sine", level: 0.045, decay: 0.45, per16: 4, pattern: [3, 1, 2, 0] },
    bass: [0, null, null, null, null, null, null, 0, null, null, 7, null, null, null, null, null],
    bassWave: "sine",
    bassLevel: 0.24,
    kick: [0, 10],
    kickLevel: 0.7,
    snare: [4, 12],
    snareKind: "snap",
    hats: [0, 2, 4, 6, 8, 10, 12, 14],
    openHats: [],
    shaker: 0.025,
    swing: 0.28,
    duck: 0.7,
  },
  pop: {
    // G major future bass: Em7 – Cmaj7 – G – D/F♯ (vi – IV – I – V).
    prog: [
      [52, 55, 59, 62, 64],
      [52, 55, 59, 60, 64],
      [50, 55, 59, 62, 67],
      [50, 54, 57, 62, 66],
    ],
    roots: [40, 36, 43, 42],
    keys: "supersaw",
    keysHits: [0, 3, 6, 10, 12],
    keysLevel: 0.05,
    pad: 0,
    arp: { wave: "square", level: 0.03, decay: 0.12, per16: 2, pattern: [4, 3, 2, 3, 4, 2, 1, 2] },
    bass: [0, null, 0, null, null, null, 0, null, 0, null, 0, null, null, null, 12, null],
    bassWave: "sawtooth",
    bassLevel: 0.2,
    kick: [0, 4, 8, 12],
    kickLevel: 1,
    snare: [4, 12],
    snareKind: "snare",
    hats: ALL16,
    openHats: [],
    shaker: 0,
    swing: 0.05,
    duck: 0.22,
  },
  minimal: {
    // A minor tech-house: Am7 – Fmaj7 – Cmaj7 – G.
    prog: [
      [55, 57, 60, 64],
      [57, 60, 64, 65],
      [55, 59, 60, 64],
      [55, 59, 62, 67],
    ],
    roots: [45, 41, 36, 43],
    keys: "stab",
    keysHits: [2, 6, 10, 14],
    keysLevel: 0.05,
    pad: 0.008,
    arp: null,
    bass: [0, null, 0, 0, null, 0, null, 0, 0, null, 0, 0, null, 0, 12, 0],
    bassWave: "sawtooth",
    bassLevel: 0.22,
    kick: [0, 4, 8, 12],
    kickLevel: 1,
    snare: [4, 12],
    snareKind: "clap",
    hats: ALL16,
    openHats: OFF8,
    shaker: 0,
    swing: 0.06,
    duck: 0.35,
  },
  neon: {
    // A minor synthwave: Am – F – C – G.
    prog: [
      [57, 60, 64, 69],
      [57, 60, 65, 69],
      [55, 60, 64, 67],
      [55, 59, 62, 67],
    ],
    roots: [45, 41, 36, 43],
    keys: "supersaw",
    keysHits: [0],
    keysLevel: 0.035,
    pad: 0.018,
    arp: { wave: "sawtooth", level: 0.03, decay: 0.12, per16: 1, pattern: [0, 1, 2, 3, 2, 1, 2, 3] },
    bass: [0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 12, null],
    bassWave: "sawtooth",
    bassLevel: 0.24,
    kick: [0, 4, 8, 12],
    kickLevel: 0.95,
    snare: [4, 12],
    snareKind: "snare",
    hats: [2, 6, 10, 14],
    openHats: [],
    shaker: 0.02,
    swing: 0,
    duck: 0.4,
  },
};

export const styleOf = (flavor?: VideoPlan["flavor"]) => SAAS_STYLES[flavor ?? "tech"] ?? SAAS_STYLES.tech;
