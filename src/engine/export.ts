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

export interface ExportOptions {
  long: number;
  fps: number;
  audio: boolean;
  onProgress: (p: number) => void;
  signal?: AbortSignal;
}

/**
 * Real-time capture of the renderer into a video file via MediaRecorder.
 * Frames are rendered from wall-clock time, so the result stays in sync with the soundtrack.
 */
export async function exportVideo(plan: VideoPlan, opts: ExportOptions): Promise<{ blob: Blob; ext: string }> {
  const mime = pickMime();
  if (!mime) throw new Error("This browser can't record video (MediaRecorder unsupported).");
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
    for (const track of sound.stream.stream.getAudioTracks()) stream.addTrack(track);
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
