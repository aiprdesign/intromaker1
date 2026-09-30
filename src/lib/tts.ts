/**
 * Voice-over generation in the browser.
 *
 * - local:  the open-source Kokoro voice model (kokoro-js, Apache-2.0; its phonemizer is eSpeak NG,
 *           GPL-3.0-or-later, so NEXT_PUBLIC_INTROMAKER_LOCAL_VOICE=off removes it) running on this computer,
 *           loaded on first use (WebGPU when available, else WebAssembly). Free and private.
 * - openai / elevenlabs / custom: through /api/tts (keys stay out of the page's code paths).
 * - upload: your own recording.
 *
 * Every clip is decoded to mono samples and stored in the engine's clip store, where the score,
 * the captions and the export pick it up.
 */
import { clipKey, estimateWords, fitScenesToVoice, getClip, LOCAL_VOICE, putClip, speakable, UPLOAD_KEY, wordsFromAlignment, type Clip } from "@/engine/voice";
import type { VideoPlan, VoiceSettings } from "@/engine/types";

export interface VoiceKeys {
  openai?: string;
  elevenlabs?: string;
  customBase?: string;
  customKey?: string;
}

const KEYS = "intromaker.voice-keys";
export function loadVoiceKeys(): VoiceKeys {
  try {
    return JSON.parse(localStorage.getItem(KEYS) ?? "{}") as VoiceKeys;
  } catch {
    return {};
  }
}
export function saveVoiceKeys(k: VoiceKeys) {
  try {
    localStorage.setItem(KEYS, JSON.stringify(k));
  } catch {
    /* private mode */
  }
}

async function decodeMono(data: ArrayBuffer): Promise<{ samples: Float32Array; rate: number }> {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const buf = await ctx.decodeAudioData(data);
  const samples = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < ch.length; i++) samples[i] += ch[i] / buf.numberOfChannels;
  }
  return { samples, rate: buf.sampleRate };
}

const b64 = (s: string) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

/* ───────── Kokoro, on this computer ───────── */

type KokoroModel = { generate: (text: string, opts: { voice: string; speed?: number }) => Promise<{ audio: Float32Array; sampling_rate: number }> };
let kokoro: Promise<KokoroModel> | null = null;
// Loaded at runtime (not bundled): the model runtime is large and only needed when chosen.
const importUrl = new Function("u", "return import(u)") as (u: string) => Promise<{ KokoroTTS: { from_pretrained: (id: string, o: object) => Promise<KokoroModel> } }>;
// The library's own browser bundle (transformers.js included). jsDelivr's auto-converted "+esm"
// build breaks the model runtime's WebAssembly loading, so the voice never loaded.
const KOKORO_URL = process.env.NEXT_PUBLIC_KOKORO_URL || "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js";
const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

function loadKokoro(onProgress?: (msg: string) => void) {
  kokoro ??= (async () => {
    onProgress?.("Loading the voice model (first time only)…");
    const { KokoroTTS } = await importUrl(KOKORO_URL).catch(() => {
      throw new Error("Couldn't download the voice model. Check your internet connection (it loads from cdn.jsdelivr.net and huggingface.co), or pick another voice source.");
    });
    const progress_callback = (p: { status?: string; progress?: number; file?: string }) => {
      if (p.status === "progress" && typeof p.progress === "number" && /onnx/.test(p.file ?? "")) onProgress?.(`Downloading the voice model… ${Math.round(p.progress)}%`);
    };
    const gpu = typeof navigator !== "undefined" && "gpu" in navigator;
    if (gpu) {
      try {
        return await KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "fp32", device: "webgpu", progress_callback });
      } catch {
        /* no usable GPU adapter: fall back to WebAssembly */
      }
    }
    return KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "q8", device: "wasm", progress_callback });
  })().catch((e) => {
    kokoro = null;
    throw new Error(`Couldn't load the free voice model (${e instanceof Error ? e.message : "network"}). It downloads once from the internet; check your connection or pick another voice.`);
  });
  return kokoro;
}

/* ───────── synthesis ───────── */

export async function synthesize(text: string, v: VoiceSettings, keys: VoiceKeys, onProgress?: (msg: string) => void): Promise<Clip> {
  const say = speakable(text);
  if (v.source === "local") {
    if (!LOCAL_VOICE) throw new Error("The on-device voice is turned off on this deployment. Pick another voice source.");
    const tts = await loadKokoro(onProgress);
    const out = await tts.generate(say, { voice: v.voice });
    const samples = out.audio instanceof Float32Array ? out.audio : new Float32Array(out.audio);
    return { samples, rate: out.sampling_rate, duration: samples.length / out.sampling_rate, words: estimateWords(say, samples, out.sampling_rate) };
  }
  if (v.source === "upload") throw new Error("Upload a recording instead.");
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: v.source,
      text: say,
      voice: v.voice,
      model: v.model,
      apiKey: v.source === "openai" ? keys.openai : v.source === "elevenlabs" ? keys.elevenlabs : keys.customKey,
      baseUrl: v.source === "custom" ? keys.customBase : undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    audio?: string;
    error?: string;
    alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } | null;
  };
  if (!res.ok || !data.audio) throw new Error(data.error ?? "Voice generation failed.");
  const { samples, rate } = await decodeMono(b64(data.audio));
  const words = data.alignment?.characters?.length
    ? wordsFromAlignment(data.alignment.characters, data.alignment.character_start_times_seconds, data.alignment.character_end_times_seconds)
    : estimateWords(say, samples, rate);
  return { samples, rate, duration: samples.length / rate, words };
}

/**
 * Voice every scene that has a line (reusing clips already made), then lengthen any scene whose
 * line doesn't fit. Returns the (possibly re-timed) plan.
 */
export async function generateVoiceover(plan: VideoPlan, keys: VoiceKeys, onProgress?: (msg: string) => void): Promise<VideoPlan> {
  const v = plan.voiceover;
  if (!v?.enabled || v.source === "upload") return plan;
  const todo = plan.scenes.filter((s) => s.vo && !getClip(clipKey(v, s.vo)));
  let done = 0;
  for (const s of todo) {
    onProgress?.(`Recording line ${done + 1} of ${todo.length}…`);
    const clip = await synthesize(s.vo!, v, keys, onProgress);
    putClip(clipKey(v, s.vo!), clip);
    done++;
  }
  return fitScenesToVoice(plan);
}

/** Your own narration: decoded and placed on the timeline (no captions: its words are unknown). */
export async function loadRecording(file: File) {
  if (file.size > 60 * 1024 * 1024) throw new Error("That file is over 60 MB.");
  const { samples, rate } = await decodeMono(await file.arrayBuffer());
  putClip(UPLOAD_KEY, { samples, rate, duration: samples.length / rate, words: [] });
  return samples.length / rate;
}

/** Lines in the plan that still need recording with the current voice. */
export function missingLines(plan: VideoPlan) {
  const v = plan.voiceover;
  if (!v?.enabled || v.source === "upload") return 0;
  return plan.scenes.filter((s) => s.vo && !getClip(clipKey(v, s.vo))).length;
}
