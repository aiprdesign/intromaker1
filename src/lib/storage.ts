import { statSync } from "node:fs";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Where captured screenshots, UI components and logos live.
 *
 * Hosted: set INTROMAKER_DATA_DIR to a persistent disk (the Docker image uses /data, mounted as
 * a volume) so captures survive restarts and redeploys. Locally it falls back to the system temp
 * folder. Captures are kept for INTROMAKER_SHOT_TTL_DAYS (default 7) and the folder is held under
 * INTROMAKER_SHOT_MAX_MB (default 1024), oldest first, so a public demo can't fill its disk.
 * (Share links that point at an expired capture still play, without that screenshot.)
 */
export const SHOT_DIR = process.env.INTROMAKER_DATA_DIR ? join(process.env.INTROMAKER_DATA_DIR, "shots") : join(tmpdir(), "intromaker-shots");

/**
 * Whether the data folder survives a redeploy: INTROMAKER_DATA_DIR is set and is its own mounted
 * volume (a different device from the container's root). The Docker image always sets /data, so
 * without a mounted volume it's still a folder inside the container that a redeploy throws away.
 */
export function dataIsPersistent() {
  const dir = process.env.INTROMAKER_DATA_DIR;
  if (!dir) return false;
  try {
    return statSync(dir).dev !== statSync("/").dev;
  } catch {
    return false;
  }
}

const TTL_MS = Math.max(1, Number(process.env.INTROMAKER_SHOT_TTL_DAYS ?? 7) || 7) * 86_400_000;
const MAX_BYTES = Math.max(50, Number(process.env.INTROMAKER_SHOT_MAX_MB ?? 1024) || 1024) * 1_048_576;
const SWEEP_EVERY_MS = 60 * 60_000;

let lastSweep = 0;
let sweeping: Promise<unknown> | null = null;

/**
 * Where captures live. "server" (default): on disk, as above, so share links, saved intros and the
 * admin area show them for the TTL. "browser" (INTROMAKER_CAPTURE_STORAGE=browser): nothing is
 * written to disk. The server holds each capture in memory only for the minutes it takes to build
 * the film (INTROMAKER_MEMORY_TTL_MIN, default 30), and the visitor's browser keeps its own copy
 * (the studio caches every capture it loads in IndexedDB either way).
 */
export const CAPTURE_STORAGE: "server" | "browser" = process.env.INTROMAKER_CAPTURE_STORAGE === "browser" ? "browser" : "server";
const MEM_TTL_MS = Math.max(1, Number(process.env.INTROMAKER_MEMORY_TTL_MIN ?? 30) || 30) * 60_000;
const MEM_MAX_BYTES = 256 * 1_048_576;
const memory = new Map<string, { data: Buffer; at: number }>();
let memoryBytes = 0;

function remember(name: string, data: Buffer, now = Date.now()) {
  const old = memory.get(name);
  if (old) memoryBytes -= old.data.length;
  memory.set(name, { data, at: now });
  memoryBytes += data.length;
  // Forget expired captures, then the oldest while over the cap (Map order is insertion order).
  for (const [k, v] of memory) {
    if (now - v.at <= MEM_TTL_MS && memoryBytes <= MEM_MAX_BYTES) break;
    memory.delete(k);
    memoryBytes -= v.data.length;
  }
}

/** Store one capture file; returns its same-origin URL. */
export async function saveShot(id: string, data: Buffer | string, ext: "jpg" | "png" | "svg") {
  if (CAPTURE_STORAGE === "browser") {
    remember(`${id}.${ext}`, typeof data === "string" ? Buffer.from(data) : data);
    return `/api/shot?id=${id}`;
  }
  await mkdir(SHOT_DIR, { recursive: true });
  await writeFile(join(SHOT_DIR, `${id}.${ext}`), data);
  maybeSweep();
  return `/api/shot?id=${id}`;
}

/** Read one capture file ("<id>.<ext>"), or null when it's gone. */
export async function readShot(name: string): Promise<Buffer | null> {
  if (CAPTURE_STORAGE === "browser") {
    const hit = memory.get(name);
    return hit && Date.now() - hit.at <= MEM_TTL_MS ? hit.data : null;
  }
  return readFile(join(SHOT_DIR, name)).catch(() => null);
}

function maybeSweep(now = Date.now()) {
  if (sweeping || now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  sweeping = sweep(now)
    .catch((e) => console.warn("[storage] sweep failed:", (e as Error).message))
    .finally(() => {
      sweeping = null;
    });
}

/** Delete expired captures, then the oldest until the folder fits its size cap. */
export async function sweep(now = Date.now(), ttlMs = TTL_MS, maxBytes = MAX_BYTES) {
  const names = await readdir(SHOT_DIR).catch(() => [] as string[]);
  const files = (
    await Promise.all(
      names.map(async (name) => {
        const s = await stat(join(SHOT_DIR, name)).catch(() => null);
        return s?.isFile() ? { name, size: s.size, mtime: s.mtimeMs } : null;
      }),
    )
  ).filter((f): f is { name: string; size: number; mtime: number } => !!f);
  let total = files.reduce((a, f) => a + f.size, 0);
  let removed = 0;
  for (const f of files.sort((a, b) => a.mtime - b.mtime)) {
    if (now - f.mtime <= ttlMs && total <= maxBytes) break;
    await unlink(join(SHOT_DIR, f.name)).catch(() => {});
    total -= f.size;
    removed++;
  }
  if (removed) console.log(`[storage] removed ${removed} old capture file${removed > 1 ? "s" : ""}; ${(total / 1_048_576).toFixed(0)} MB kept`);
  return { removed, bytes: total };
}
