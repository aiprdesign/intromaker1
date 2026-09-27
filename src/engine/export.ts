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
import { aspectSize, renderFrame, totalDuration } from "./renderer";
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
    }
  }
  return exportRealtime(plan, opts);
}

async function exportOffline(plan: VideoPlan, opts: ExportOptions): Promise<ExportResult> {
  await ensureFonts();
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
  const audio = audioCodec ? new AudioBufferSource({ codec: audioCodec, quality: QUALITY_HIGH }) : null;
  if (audio) output.addAudioTrack(audio);

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
      renderFrame(ctx, plan, i * dt, w, h);
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
  }
  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error("Encoder produced no data");
  return { blob: new Blob([buffer], { type: "video/mp4" }), ext: "mp4" };
}

/** Realtime capture via MediaRecorder (fallback for browsers without WebCodecs). */
async function exportRealtime(plan: VideoPlan, opts: ExportOptions): Promise<ExportResult> {
  const mime = pickMime();
  if (!mime) throw new Error("This browser can't export video. Try the latest Chrome or Edge.");
  await ensureFonts();

  const { w, h } = aspectSize(plan.aspect, opts.long);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  Object.assign(canvas.style, { position: "fixed", left: "-100000px", top: "0", pointerEvents: "none" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  renderFrame(ctx, plan, 0, w, h);

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
      renderFrame(ctx, plan, Math.min(t, duration), w, h);
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
