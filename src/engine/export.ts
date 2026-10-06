import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
} from "mediabunny";
import { Soundtrack } from "./audio";
import { ensureFonts } from "./fonts";
import { mediaState, preloadPlanMedia, syncVideos } from "./media";
import { aspectSize, renderFrame, sceneAt, totalDuration, renderFrameBlurred } from "./renderer";
import type { VideoPlan } from "./types";

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export function canExport() {
  return typeof VideoEncoder !== "undefined" || pickMime() !== null;
}

export interface ExportOptions {
  long: number;
  fps: number;
  audio: boolean;
  onProgress: (p: number) => void;
  signal?: AbortSignal;
  /** Small mark in the corner of every frame (the Free plan's). */
  watermark?: string;
}

export interface ExportResult {
  blob: Blob;
  ext: string;
}

/**
 * Export the plan to a video file. Prefers frame-accurate offline encoding (WebCodecs):
 * every frame is rendered at its exact timestamp, so the result is perfectly smooth and the
 * right length even on slow machines. Falls back to realtime MediaRecorder capture.
 */
export async function exportVideo(plan: VideoPlan, opts: ExportOptions): Promise<ExportResult> {
  if (typeof VideoEncoder !== "undefined") {
    try {
      return await exportOffline(plan, opts);
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      console.warn("[export] offline encoding failed, falling back to realtime capture:", e);
      if (opts.long > 1920) throw new Error(`This browser couldn't encode a video this large. Export at 1080p, or try the latest Chrome or Edge.`);
    }
  }
  // Realtime capture drops frames above 1080p, so it never records larger.
  return exportRealtime(plan, { ...opts, long: Math.min(opts.long, 1920) });
}

async function exportOffline(plan: VideoPlan, opts: ExportOptions): Promise<ExportResult> {
  await Promise.all([ensureFonts(), preloadPlanMedia(plan)]);
  const { w, h } = aspectSize(plan.aspect, opts.long);
  const videoCodec = await getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: w, height: h });
  if (!videoCodec) throw new Error("No video encoder available");
  const audioCodec = opts.audio
    ? await getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: 2, sampleRate: 48000 })
    : null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const video = new CanvasSource(canvas, { codec: videoCodec, quality: QUALITY_HIGH, keyFrameInterval: 1 });
  output.addVideoTrack(video);
  // 256 kbps stereo: transparent for AAC and Opus (the encoders' "high" preset is lower).
  const audio = audioCodec ? new AudioBufferSource({ codec: audioCodec, bitrate: 256_000 }) : null;
  if (audio) output.addAudioTrack(audio);

  mediaState.exporting = true;
  try {
    await output.start();
    if (audio) {
      await audio.add(await Soundtrack.renderOffline(plan, 48000));
      audio.close();
    }
    const duration = totalDuration(plan);
    const frames = Math.max(1, Math.round(duration * opts.fps));
    const dt = 1 / opts.fps;
    for (let i = 0; i < frames; i++) {
      if (opts.signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
      const at = sceneAt(plan, i * dt);
      if (at) await syncVideos(plan, at.index, at.local);
      // Offline, so every frame gets full camera motion blur (6 samples across a 180° shutter).
      renderFrameBlurred(ctx, plan, i * dt, w, h, { watermark: opts.watermark }, { samples: 6, fps: opts.fps });
      await video.add(i * dt, dt);
      opts.onProgress((i + 1) / frames);
      // Let the page repaint the progress UI now and then.
      if (i % 8 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    video.close();
    await output.finalize();
  } catch (e) {
    if (output.state !== "finalized") await output.cancel().catch(() => {});
    throw e;
  } finally {
    mediaState.exporting = false;
  }
  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error("Encoder produced no data");
  return { blob: new Blob([buffer], { type: "video/mp4" }), ext: "mp4" };
}

/** Realtime capture via MediaRecorder (fallback for browsers without WebCodecs). */
async function exportRealtime(plan: VideoPlan, opts: ExportOptions): Promise<ExportResult> {
  const mime = pickMime();
  if (!mime) throw new Error("This browser can't export video. Try the latest Chrome or Edge.");
  await Promise.all([ensureFonts(), preloadPlanMedia(plan)]);

  const { w, h } = aspectSize(plan.aspect, opts.long);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  Object.assign(canvas.style, { position: "fixed", left: "-100000px", top: "0", pointerEvents: "none" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  renderFrame(ctx, plan, 0, w, h, { watermark: opts.watermark });

  const stream = canvas.captureStream(opts.fps);
  let sound: Soundtrack | null = null;
  if (opts.audio) {
    sound = new Soundtrack();
    await sound.ctx.resume();
    for (const track of sound.stream?.stream.getAudioTracks() ?? []) stream.addTrack(track);
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: opts.long >= 1900 ? 16_000_000 : 8_000_000,
    audioBitsPerSecond: 256_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((res) => (recorder.onstop = () => res()));

  const duration = totalDuration(plan);
  recorder.start(250);
  sound?.play(plan, 0);
  const t0 = performance.now();

  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (opts.signal?.aborted) {
        reject(new DOMException("Export cancelled", "AbortError"));
        return;
      }
      const t = (performance.now() - t0) / 1000;
      renderFrame(ctx, plan, Math.min(t, duration), w, h, { watermark: opts.watermark });
      opts.onProgress(Math.min(1, t / duration));
      if (t >= duration + 0.15) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }).finally(async () => {
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    stream.getTracks().forEach((tr) => tr.stop());
    await sound?.close();
    canvas.remove();
  });

  return { blob: new Blob(chunks, { type: mime.split(";")[0] }), ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
}

/** Export sizes, by the long side of a 16:9 or 9:16 video. */
export const EXPORT_SIZES = [
  { long: 1280, label: "720p" },
  { long: 1920, label: "1080p" },
  { long: 2560, label: "1440p" },
  { long: 3840, label: "4K" },
] as const;
export const sizeLabel = (long: number) => [...EXPORT_SIZES].reverse().find((s) => long >= s.long)?.label ?? "720p";

/**
 * The export takes the format being watched (chosen in the player's toolbar) at 1080p, or the
 * size chosen beside the Export button (`long`, the long side of a 16:9 video: 3840 for 4K):
 * 1920×1080 at 60 fps for 16:9, 1080×1920 at 30 fps for 9:16 (Reels, TikTok, Shorts) and
 * 1080×1080 at 30 fps for 1:1 (feeds), each scaled up together.
 */
export function exportFormat(aspect: VideoPlan["aspect"], long = 1920) {
  const k = long / 1920;
  const px = (n: number) => Math.round(n * k);
  const tag = long === 1920 ? "" : ` (${sizeLabel(long)})`;
  if (aspect === "9:16") return { name: `9:16 · ${px(1080)}×${px(1920)}${tag}`, long: px(1920), fps: 30 };
  // aspectSize gives a square 9/16 of the long side: 1920 → 1080×1080.
  if (aspect === "1:1") return { name: `1:1 · ${px(1080)}×${px(1080)}${tag}`, long: px(1920), fps: 30 };
  return { name: `16:9 · ${px(1920)}×${px(1080)}${tag}`, long: px(1920), fps: 60 };
}

/**
 * Whether this browser can encode a video this large. Sizes above 1080p need frame-accurate
 * offline encoding (WebCodecs): realtime capture can't keep up and would drop frames.
 */
export async function canEncodeSize(w: number, h: number): Promise<boolean> {
  if (Math.max(w, h) <= 1920) return canExport();
  if (typeof VideoEncoder === "undefined") return false;
  try {
    return (await getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: w, height: h })) !== null;
  } catch {
    return false;
  }
}

/** PNG thumbnail/poster: the held end card (logo, closing line and button). */
export async function exportThumbnail(plan: VideoPlan, long: number, watermark?: string): Promise<Blob> {
  await Promise.all([ensureFonts(), preloadPlanMedia(plan)]);
  const { w, h } = aspectSize(plan.aspect, long);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const t = Math.max(0, totalDuration(plan) - 0.05);
  const at = sceneAt(plan, t);
  if (at) await syncVideos(plan, at.index, at.local);
  renderFrame(canvas.getContext("2d")!, plan, t, w, h, { watermark });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Thumbnail failed"))), "image/png"));
}
