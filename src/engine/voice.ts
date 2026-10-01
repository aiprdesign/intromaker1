/**
 * Voice-over: settings, the catalogue of voices, the clip store, speech-friendly text, word
 * timings for captions, and where each line sits on the film's timeline.
 *
 * Each scene can carry a narrator line (`scene.vo`). Generated audio lives in an in-memory clip
 * store keyed by (source, voice, text), never in the plan (plans travel in share links), so the
 * score, the captions and the export all read the same clips.
 */
import { revealHit } from "./arrange";
import type { Scene, VideoPlan, VoiceSettings, VoiceSource } from "./types";

export type { VoiceSettings, VoiceSource };

export interface VoiceOption {
  id: string;
  name: string;
}

/**
 * The in-browser Kokoro voice downloads kokoro-js, whose phonemizer is eSpeak NG (GPL-3.0-or-later).
 * A deployment that wants only permissively licensed code can remove it at build time with
 * NEXT_PUBLIC_INTROMAKER_LOCAL_VOICE=off (see THIRD_PARTY_NOTICES.md).
 */
export const LOCAL_VOICE = process.env.NEXT_PUBLIC_INTROMAKER_LOCAL_VOICE !== "off";

const ALL_SOURCES: { id: VoiceSource; name: string; note: string }[] = [
  { id: "local", name: "Free voice on this computer (Kokoro)", note: "Open-source Kokoro voice model running in your browser: free, private, no key. One-time download (~90 MB). Uses eSpeak NG (GPL-3.0) for pronunciation." },
  { id: "openai", name: "OpenAI voices", note: "Natural, expressive voices (gpt-4o-mini-tts). Uses your OpenAI key." },
  { id: "elevenlabs", name: "ElevenLabs voices", note: "Studio-quality voices, or any voice ID from your ElevenLabs library." },
  { id: "custom", name: "Any OpenAI-compatible voice server", note: "E.g. Kokoro-FastAPI or openedai-speech on your own machine (…/v1/audio/speech)." },
  { id: "upload", name: "Upload my own recording", note: "Your narration (MP3/WAV/M4A) laid over the film." },
];
export const VOICE_SOURCES = ALL_SOURCES.filter((s) => LOCAL_VOICE || s.id !== "local");

export const VOICES: Record<Exclude<VoiceSource, "upload">, VoiceOption[]> = {
  local: [
    { id: "af_heart", name: "Heart — warm, US (female)" },
    { id: "af_bella", name: "Bella — bright, US (female)" },
    { id: "af_nicole", name: "Nicole — soft, US (female)" },
    { id: "am_michael", name: "Michael — confident, US (male)" },
    { id: "am_fenrir", name: "Fenrir — deep, US (male)" },
    { id: "am_puck", name: "Puck — upbeat, US (male)" },
    { id: "bf_emma", name: "Emma — British (female)" },
    { id: "bm_george", name: "George — British (male)" },
  ],
  openai: [
    { id: "coral", name: "Coral — warm, upbeat" },
    { id: "ash", name: "Ash — clear, confident" },
    { id: "sage", name: "Sage — calm, assured" },
    { id: "nova", name: "Nova — bright" },
    { id: "onyx", name: "Onyx — deep" },
    { id: "alloy", name: "Alloy — neutral" },
    { id: "echo", name: "Echo — smooth" },
    { id: "fable", name: "Fable — British" },
    { id: "shimmer", name: "Shimmer — gentle" },
    { id: "verse", name: "Verse — expressive" },
    { id: "ballad", name: "Ballad — soft" },
  ],
  elevenlabs: [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel — calm narration" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam — deep narration" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah — soft, warm" },
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni — well-rounded" },
    { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh — deep, young" },
    { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli — emotional" },
  ],
  custom: [
    { id: "af_heart", name: "af_heart (Kokoro-FastAPI)" },
    { id: "alloy", name: "alloy" },
  ],
};

export const DEFAULT_VOICE: VoiceSettings = LOCAL_VOICE
  ? { enabled: false, source: "local", voice: "af_heart", captions: true }
  : { enabled: false, source: "openai", voice: "coral", captions: true };

/* ───────── speech-friendly text ───────── */

const UNITS: Record<string, string> = { k: "thousand", K: "thousand", m: "million", M: "million", b: "billion", B: "billion" };

/**
 * Units a narrator reads out in full after a number ([singular, plural]): "6 ft" → "6 feet",
 * "1 lb" → "1 pound", "500 mAh" → "500 milliamp hours". Case matters where it disambiguates
 * (mW vs MW, ms vs MS); words that are also ordinary words ("in", "m", "A", "g") have their own
 * rules in sayUnits.
 */
const UNIT_WORDS: [RegExp, string, string][] = [
  [/fl\.?\s?oz\.?/, "fluid ounce", "fluid ounces"],
  [/(?:ft|feet|foot)\.?/i, "foot", "feet"],
  [/(?:inch|inches)/i, "inch", "inches"],
  [/(?:yd|yds)\.?/, "yard", "yards"],
  [/mi\.?(?=\s|$|[,;:!?)])/, "mile", "miles"],
  [/km/i, "kilometre", "kilometres"],
  [/cm/, "centimetre", "centimetres"],
  [/mm/, "millimetre", "millimetres"],
  [/(?:lbs?|LBS?)\.?/, "pound", "pounds"],
  [/oz\.?/i, "ounce", "ounces"],
  [/kg/i, "kilogram", "kilograms"],
  [/mg/, "milligram", "milligrams"],
  [/(?:ml|mL|ML)/, "millilitre", "millilitres"],
  [/(?:gal|gals)\.?/i, "gallon", "gallons"],
  [/qt\.?/i, "quart", "quarts"],
  [/mAh/i, "milliamp hour", "milliamp hours"],
  [/kWh/i, "kilowatt hour", "kilowatt hours"],
  [/Wh/, "watt hour", "watt hours"],
  [/kW/, "kilowatt", "kilowatts"],
  [/W(?=\s|$|[,;:!?)/])/, "watt", "watts"],
  [/V(?=\s|$|[,;:!?)/])/, "volt", "volts"],
  [/GHz/i, "gigahertz", "gigahertz"],
  [/MHz/i, "megahertz", "megahertz"],
  [/kHz/i, "kilohertz", "kilohertz"],
  [/Hz/i, "hertz", "hertz"],
  [/dB/i, "decibel", "decibels"],
  [/TB/, "terabyte", "terabytes"],
  [/GB/, "gigabyte", "gigabytes"],
  [/MB/, "megabyte", "megabytes"],
  [/Gbps/i, "gigabit per second", "gigabits per second"],
  [/Mbps/i, "megabit per second", "megabits per second"],
  [/mph/i, "mile per hour", "miles per hour"],
  [/(?:km\/h|kph)/i, "kilometre per hour", "kilometres per hour"],
  [/rpm/i, "R P M", "R P M"],
  [/(?:hrs?|hours?)\.?/i, "hour", "hours"],
  [/(?:mins?|minutes?)\.?/i, "minute", "minutes"],
  [/(?:secs?|seconds?)\.?/i, "second", "seconds"],
  [/ms/, "millisecond", "milliseconds"],
  [/(?:pcs?|pieces?)\.?/i, "piece", "pieces"],
  [/(?:pk|packs?)\.?/i, "pack", "packs"],
  [/(?:ct)\.?/, "count", "count"],
];

/** Letters a narrator spells out (and reads as one word otherwise wrongly, like "led" for LED). */
const SPELL = /\b(USB|LED|LCD|OLED|HDMI|HDR|UHD|QLED|SSD|HDD|RAM|GPS|NFC|UV|IPX|IP|BPA|PVC|ABS|RGB|AC|DC|PC|TV|DIY|SPF)(?=-?[A-Z0-9]*\b)/g;

/** Words after a unit that keep it plural ("6 feet long", "2 pounds of coffee"). */
const KEEPS_PLURAL = /^(of|per|in|on|at|and|or|to|for|with|from|by|each|long|wide|tall|high|deep|thick|away|across|diagonal|apart|total|max|maximum|minimum|more|less|faster|slower|ago|later|left|or)$/i;

/** Say a number and its unit the way a person would ("6 ft" → "6 feet", "1 in." → "1 inch"). */
function sayUnits(text: string) {
  const num = "(\\d+(?:[.,]\\d+)?(?:\\s?\\/\\s?\\d+)?)";
  // One unit, read out: singular for 1, and singular before the noun it describes, like people
  // say it ("a 12 inch skillet", "16 ounce cups", "40 hour playtime"); a full stop that ended the
  // sentence stays, one that only marked the abbreviation goes ("12 in. skillet").
  const unit = (one: string, many: string) => (m: string, n: string, ...rest: unknown[]) => {
    const str = rest[rest.length - 1] as string;
    const offset = rest[rest.length - 2] as number;
    const after = str.slice(offset + m.length);
    const next = after.match(/^\s+([a-z][a-z-]*)/)?.[1];
    const single = /^1(?:\.0+)?$/.test(n.trim()) || (!!next && !KEEPS_PLURAL.test(next));
    const stop = /\.$/.test(m) && (after === "" || /^\s+[A-Z]/.test(after)) ? "." : "";
    return `${n} ${single ? one : many}${stop}`;
  };
  let t = text;
  // Feet and inches written with marks: 5'11" → 5 feet 11 inches; 12" → 12 inches; 6' → 6 feet.
  t = t.replace(/\b(\d+)\s?['′’]\s?(\d+(?:\.\d+)?)\s?(?:["″”]|'')/g, (_, f: string, i: string) => `${f} ${f === "1" ? "foot" : "feet"} ${i} ${i === "1" ? "inch" : "inches"}`);
  t = t.replace(/\b(\d+(?:\.\d+)?)\s?(?:["″”]|'')(?=[\s,.;:!?)x×]|$)/g, unit("inch", "inches"));
  t = t.replace(/\b(\d+(?:\.\d+)?)\s?['′](?=[\s,.;:!?)x×]|$)/g, unit("foot", "feet"));
  // Dimensions: 10 x 12 x 3 → 10 by 12 by 3 (then the unit after it is read as usual).
  t = t.replace(/(\d(?:[.,]\d+)?)\s?[x×X]\s?(?=\d)/g, "$1 by ");
  // "in" means inches only when it's clearly a size: "12 in.", "5 in wide", "10 by 12 in", or at
  // the end of a phrase. "#1 in sales" and "fits in your bag" stay as they are.
  const inches = unit("inch", "inches");
  t = t.replace(/\b(\d+(?:\.\d+)?)\s?(in\.|IN\b|in\b)/g, (m: string, n: string, word: string, offset: number, str: string) => {
    const after = str.slice(offset + m.length);
    const next = after.match(/^\s+([A-Za-z]+)/)?.[1] ?? "";
    const size =
      word !== "in" ||
      after === "" ||
      /^\s*[,;:!?)]/.test(after) ||
      /^\.(\s|$)/.test(after) ||
      /^(by|wide|long|tall|high|deep|thick|across|diagonal|screen|display|monitor|laptop|tablet|tv|skillet|pan|handle|blade|wheel|wheels|frame|bag|box|cube|ring|lens)$/i.test(next);
    return size ? inches(m, n, offset, str) : m;
  });
  // "m" is metres with a length word; otherwise it's millions, below.
  t = t.replace(/\b(\d+(?:\.\d+)?)\s?m\b(?=\s*(?:cable|cord|lead|hose|long|wide|tall|high|deep|length|range|reach|rope|tape|roll|away))/gi, unit("metre", "metres"));
  // Grams (lowercase g): "100g", but never "5G" (the network).
  t = t.replace(/\b(\d+(?:\.\d+)?)\s?g\b(?!\s*(?:network|lte|phone|signal))/g, unit("gram", "grams"));
  // Litres (L), amps (A), frames per second, when right after a number and on their own.
  t = t.replace(/\b(\d+(?:\.\d+)?)\s?L\b/g, unit("litre", "litres"));
  t = t.replace(/\b(\d+(?:\.\d+)?)\s?A\b(?=\s|$|[,;:!?)/])/g, unit("amp", "amps"));
  t = t.replace(/\b(\d+)\s?fps\b/gi, "$1 frames per second");
  // Temperatures.
  t = t.replace(/(-?\d+(?:\.\d+)?)\s?°\s?F\b/g, (_, n: string) => `${n} degrees Fahrenheit`);
  t = t.replace(/(-?\d+(?:\.\d+)?)\s?°\s?C\b/g, (_, n: string) => `${n} degrees Celsius`);
  t = t.replace(/(\d)\s?°/g, "$1 degrees");
  // Every other unit in the table.
  for (const [re, one, many] of UNIT_WORDS) {
    const pattern = new RegExp(`${num}\\s?(?:${re.source})(?![A-Za-z])`, re.flags.includes("i") ? "gi" : "g");
    t = t.replace(pattern, unit(one, many));
  }
  // "5 volts/2 amps" → "5 volts, 2 amps".
  t = t.replace(/([a-z])\s?\/\s?(?=\d)/g, "$1, ");
  // Screen and video resolutions: 4K, 8K (not "4 thousand").
  t = t.replace(/\b([2-8])K\b(?=\s*(?:$|[,.;:!?)]|uhd|hdr|video|display|tv|monitor|camera|resolution|screen|ultra|streaming|gaming))/gi, "$1 K");
  // Percent, "x" as times ("10x faster"), number signs, ranges, round-the-clock.
  t = t.replace(/(\d)\s?%/g, "$1 percent");
  t = t.replace(/\b(\d+(?:\.\d+)?)\s?[x×](?=\s|$|[,.;:!?)])/gi, "$1 times");
  t = t.replace(/#\s?(\d+)/g, "number $1");
  t = t.replace(/\b24\/7\b/g, "twenty-four seven");
  t = t.replace(/\b(\d+)\s?[-–]\s?(\d+)\b(?!\s?[-–]\s?\d)/g, "$1 to $2");
  // Common shorthand.
  t = t
    .replace(/\bw\/o\b/gi, "without")
    .replace(/\bw\/(?=\s|[A-Za-z])/gi, "with ")
    .replace(/\bapprox\.?(?=\s)/gi, "approximately")
    .replace(/\bincl\.?(?=\s)/gi, "including")
    .replace(/\be\.g\.,?/gi, "for example")
    .replace(/\bi\.e\.,?/gi, "that is")
    .replace(/\betc\./gi, "et cetera")
    .replace(/\bvs\.?(?=\s)/gi, "versus")
    .replace(/\bNo\.\s?(?=\d)/g, "number ");
  // Spec codes spelled out: USB-C → U S B C, IPX5 → I P X 5, LED → L E D.
  t = t.replace(/\b(USB|IPX|IP)-?([A-Z0-9]+)\b/g, (_, a: string, b: string) => `${a.split("").join(" ")} ${/^\d+$/.test(b) ? b : b.split("").join(" ")}`);
  t = t.replace(SPELL, (m: string) => m.split("").join(" "));
  return t;
}

/** Rewrite on-screen copy the way a narrator says it ("10,000+ teams" → "more than 10,000 teams"). */
export function speakable(text: string) {
  return sayUnits(
    text
      .replace(/\*/g, "")
      .replace(/\s*\|\s*/g, ". ")
      .replace(/[★✓✕→↗▲▼•]+/g, " "),
  )
    .replace(/(\$|€|£)?(\d[\d,.]*)\s?([kKmMbB])?\+(?=\s|$|[,.])/g, (_, cur: string | undefined, n: string, u: string | undefined) => `more than ${cur ?? ""}${n}${u ? ` ${UNITS[u]}` : ""}`)
    .replace(/(\$|€|£)(\d[\d,.]*)\s?([kKmMbB])\b/g, (_, cur: string, n: string, u: string) => `${cur}${n} ${UNITS[u]}`)
    .replace(/\b(\d[\d,.]*)([kKmMbB])\b/g, (_, n: string, u: string) => `${n} ${UNITS[u]}`)
    .replace(/\bwww\./gi, "")
    .replace(/\b([a-z0-9-]+)\.(com|io|ai|dev|app|co|so|xyz|net|org|tech|cloud)\b/gi, (_, a: string, b: string) => `${a} dot ${b}`)
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Comfortable narration pace (words per second) and the budget for a scene. */
export const WORDS_PER_SECOND = 2.6;
export const wordBudget = (seconds: number) => Math.max(2, Math.floor((seconds - 0.45) * WORDS_PER_SECOND));

/* ───────── clips ───────── */

export interface Word {
  w: string;
  t0: number;
  t1: number;
}

export interface Clip {
  /** Mono samples. */
  samples: Float32Array;
  rate: number;
  duration: number;
  /** Word timings (seconds from the clip start), for captions. */
  words: Word[];
}

const clips = new Map<string, Clip>();
const listeners = new Set<() => void>();

export const clipKey = (v: Pick<VoiceSettings, "source" | "voice" | "model">, text: string) => `${v.source}|${v.voice}|${v.model ?? ""}|${speakable(text)}`;
export const UPLOAD_KEY = "upload|narration";

export function putClip(key: string, clip: Clip) {
  clips.set(key, clip);
  for (const l of listeners) l();
}
export const getClip = (key: string) => clips.get(key);
export const hasClip = (key: string) => clips.has(key);
export function onClips(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Where speech actually starts and ends in a clip (trims TTS padding). */
function speechBounds(samples: Float32Array, rate: number) {
  const win = Math.max(1, Math.floor(rate * 0.02));
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const thr = peak * 0.06;
  let a = 0;
  let b = samples.length;
  for (let i = 0; i < samples.length; i += win) {
    if (Math.abs(samples[i]) > thr || Math.abs(samples[Math.min(samples.length - 1, i + (win >> 1))]) > thr) {
      a = i;
      break;
    }
  }
  for (let i = samples.length - 1; i > a; i -= win) {
    if (Math.abs(samples[i]) > thr || Math.abs(samples[Math.max(0, i - (win >> 1))]) > thr) {
      b = i;
      break;
    }
  }
  return { start: a / rate, end: b / rate };
}

/**
 * Estimated word timings: words share the spoken span in proportion to their length (vowel
 * groups ≈ syllables), with a little extra time at commas and full stops. Good enough for
 * word-by-word captions within one short line; exact timings replace this when a voice
 * provider returns them.
 */
export function estimateWords(text: string, samples: Float32Array, rate: number): Word[] {
  const words = speakable(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const { start, end } = speechBounds(samples, rate);
  const weight = (w: string) => Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) ?? []).length) + (/[,;:]$/.test(w) ? 0.8 : /[.!?]$/.test(w) ? 1.2 : 0);
  const total = words.reduce((a, w) => a + weight(w), 0);
  const span = Math.max(0.1, end - start);
  let t = start;
  return words.map((w) => {
    const d = (weight(w) / total) * span;
    const out = { w, t0: t, t1: t + d * 0.92 };
    t += d;
    return out;
  });
}

/** Word timings from per-character alignment (ElevenLabs "with-timestamps"). */
export function wordsFromAlignment(chars: string[], starts: number[], ends: number[]): Word[] {
  const out: Word[] = [];
  let cur = "";
  let t0 = 0;
  let t1 = 0;
  chars.forEach((c, i) => {
    if (/\s/.test(c)) {
      if (cur) out.push({ w: cur, t0, t1 });
      cur = "";
      return;
    }
    if (!cur) t0 = starts[i];
    cur += c;
    t1 = ends[i];
  });
  if (cur) out.push({ w: cur, t0, t1 });
  return out;
}

/* ───────── timeline ───────── */

export interface VoiceCue {
  scene: number;
  /** Film time the clip starts. */
  start: number;
  clip: Clip;
}

/** When a scene's line starts: just after the cut, or right after the logo hits on the reveal. */
export function voiceLead(scene: Pick<Scene, "role" | "duration">, beat: number) {
  return scene.role === "reveal" ? revealHit(scene.duration, beat) + 0.1 : 0.18;
}

/** Every clip the film plays, in order (only clips that exist in the store). */
export function voiceTimeline(plan: Pick<VideoPlan, "scenes" | "bpm" | "voiceover">): VoiceCue[] {
  const v = plan.voiceover;
  if (!v?.enabled) return [];
  if (v.source === "upload") {
    const clip = getClip(UPLOAD_KEY);
    return clip ? [{ scene: 0, start: Math.max(0, v.offset ?? 0), clip }] : [];
  }
  const beat = 60 / (plan.bpm || 120);
  const out: VoiceCue[] = [];
  let acc = 0;
  plan.scenes.forEach((s, i) => {
    const clip = s.vo ? getClip(clipKey(v, s.vo)) : undefined;
    if (clip) out.push({ scene: i, start: acc + voiceLead(s, beat), clip });
    acc += s.duration;
  });
  return out;
}

/**
 * Lengthen any scene whose line doesn't fit (never shorten), snapping to whole beats so every
 * cut stays on the music (up to the 8s scene maximum; longer lines should be shortened).
 */
export function fitScenesToVoice(plan: VideoPlan): VideoPlan {
  const v = plan.voiceover;
  if (!v?.enabled || v.source === "upload") return plan;
  const beat = 60 / (plan.bpm || 120);
  let changed = false;
  const scenes = plan.scenes.map((s) => {
    const clip = s.vo ? getClip(clipKey(v, s.vo)) : undefined;
    if (!clip) return s;
    const need = voiceLead(s, beat) + clip.duration + 0.35;
    if (need <= s.duration) return s;
    changed = true;
    return { ...s, duration: Math.min(8, Math.ceil(need / beat) * beat) };
  });
  return changed ? { ...plan, scenes } : plan;
}

/** The caption phrase on screen at film time `t`: up to ~6 words, with the word being spoken. */
export function captionAt(plan: Pick<VideoPlan, "scenes" | "bpm" | "voiceover">, t: number) {
  if (!plan.voiceover?.enabled || !plan.voiceover.captions) return null;
  for (const cue of voiceTimeline(plan)) {
    const lt = t - cue.start;
    const words = cue.clip.words;
    if (!words.length || lt < words[0].t0 - 0.05 || lt > words[words.length - 1].t1 + 0.35) continue;
    // Phrases break at punctuation or every 6 words.
    const phrases: Word[][] = [[]];
    for (const w of words) {
      const cur = phrases[phrases.length - 1];
      cur.push(w);
      if ((/[,.!?;:]$/.test(w.w) && cur.length >= 2) || cur.length >= 6) phrases.push([]);
    }
    const list = phrases.filter((p) => p.length);
    const phrase = list.find((p, i) => lt <= p[p.length - 1].t1 + (i === list.length - 1 ? 0.35 : 0.08)) ?? list[list.length - 1];
    const active = phrase.findIndex((w) => lt >= w.t0 && lt < w.t1 + 0.04);
    const first = phrase[0].t0;
    return { words: phrase.map((w) => w.w), active, since: lt - first, lt, times: phrase.map((w) => ({ t0: w.t0, t1: w.t1 })) };
  }
  return null;
}
