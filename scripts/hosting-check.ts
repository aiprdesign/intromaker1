/**
 * Checks the safeguards a public deployment relies on, in production mode:
 *
 *   npm run check:hosting
 *
 * rate limits (windows, 429s, spoofed X-Forwarded-For, the shared AI budget), capture storage
 * clean-up (age and size caps), the SSRF guard (localhost, private ranges, cloud metadata,
 * credentials, odd schemes) and the local-AI restriction. Exits non-zero on any failure.
 */
import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = "production";
delete env.INTROMAKER_ALLOW_PRIVATE_URLS;
delete env.INTROMAKER_RATE_LIMIT;
env.INTROMAKER_PROXY_HOPS = "1";
env.INTROMAKER_AI_DAILY_BUDGET = "3";

let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "  ✓" : "  ✗"} ${what}`);
  if (!ok) failed++;
};
const req = (xff?: string) => new Request("https://demo.example/api/scrape", { method: "POST", headers: xff ? { "x-forwarded-for": xff } : {} });

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "intromaker-check-"));
  env.INTROMAKER_DATA_DIR = dataDir;
  const rl = await import("../src/lib/ratelimit");
  const storage = await import("../src/lib/storage");
  const { assertPublicUrl } = await import("../src/lib/netguard");
  const { serverReachesLocal } = await import("../src/lib/ai");

  console.log("Rate limits");
  rl.resetLimits();
  const limit = rl.RULES.scrape.limit;
  const codes: number[] = [];
  for (let i = 0; i <= limit; i++) codes.push(rl.rateLimit(req("203.0.113.7"), "scrape")?.status ?? 200);
  check(codes.slice(0, limit).every((c) => c === 200) && codes[limit] === 429, `scrape: ${limit} allowed, then 429`);
  const r429 = rl.rateLimit(req("203.0.113.7"), "scrape");
  check(!!r429?.headers.get("Retry-After"), "429 carries Retry-After");
  check(rl.rateLimit(req("198.51.100.9"), "scrape") === null, "another visitor is unaffected");
  check(rl.rateLimit(req("1.2.3.4, 203.0.113.7"), "scrape")?.status === 429, "a spoofed X-Forwarded-For entry doesn't reset the limit");
  const t0 = Date.now();
  rl.resetLimits();
  for (let i = 0; i < limit; i++) rl.take("scrape", "k", t0);
  check(!rl.take("scrape", "k", t0).ok && rl.take("scrape", "k", t0 + rl.RULES.scrape.windowMs + 1).ok, "the window resets after its time");

  console.log("Server AI budget");
  rl.resetLimits();
  const spend = [1, 2, 3, 4].map((i) => rl.spendServerAi(req(`192.0.2.${i}`)).ok);
  check(spend.join() === "true,true,true,false", "daily budget (3) shared across visitors, then built-in director");

  console.log("Capture storage");
  check(storage.SHOT_DIR === join(dataDir, "shots"), "captures go to INTROMAKER_DATA_DIR/shots");
  await storage.saveShot("aaaaaaaaaaaaaaaa-hero", Buffer.alloc(1000), "jpg");
  await storage.saveShot("bbbbbbbbbbbbbbbb-hero", Buffer.alloc(1000), "jpg");
  await storage.saveShot("cccccccccccccccc-hero", Buffer.alloc(1000), "jpg");
  const old = (Date.now() - 10 * 86_400_000) / 1000;
  await utimes(join(storage.SHOT_DIR, "aaaaaaaaaaaaaaaa-hero.jpg"), old, old);
  await storage.sweep(Date.now(), 7 * 86_400_000, 10_000_000);
  let left = await readdir(storage.SHOT_DIR);
  check(!left.includes("aaaaaaaaaaaaaaaa-hero.jpg") && left.length === 2, "captures older than the TTL are removed");
  await writeFile(join(storage.SHOT_DIR, "dddddddddddddddd-full.jpg"), Buffer.alloc(3000));
  await storage.sweep(Date.now(), 7 * 86_400_000, 3500);
  left = await readdir(storage.SHOT_DIR);
  check(left.length === 1 && left[0] === "dddddddddddddddd-full.jpg", "oldest captures go first when over the size cap");
  await rm(dataDir, { recursive: true, force: true });

  console.log("SSRF guard");
  const blocked = [
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://[::1]/",
    "http://10.0.0.5",
    "http://192.168.1.1",
    "http://172.16.0.1",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1",
    "http://0.0.0.0",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:a9fe:a9fe]/",
    "http://[::127.0.0.1]/",
    "http://[64:ff9b::a00:1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://metadata.internal/",
    "http://user:pass@example.com",
    "file:///etc/passwd",
    "ftp://example.com",
    "javascript:alert(1)",
  ];
  for (const u of blocked) {
    const ok = await assertPublicUrl(u).then(
      () => false,
      () => true,
    );
    check(ok, `blocked: ${u}`);
  }
  const pub = await assertPublicUrl("http://93.184.215.14/").then(
    () => true,
    () => false,
  );
  check(pub, "allowed: a public IPv4 address");
  const pub6 = await assertPublicUrl("http://[2606:2800:21f:cb07:6820:80da:af6b:8b2c]/").then(
    () => true,
    () => false,
  );
  check(pub6, "allowed: a public IPv6 address");

  // DNS rebinding: even if a name passed the first check, the connection itself is refused when
  // the name resolves to a private address at connect time (localtest.me → ::1 / 127.0.0.1).
  const { pinned } = await import("../src/lib/netguard");
  const { fetch: undiciFetch } = await import("undici");
  const rebound = await undiciFetch("http://localtest.me:3100/", { dispatcher: pinned, signal: AbortSignal.timeout(8000) }).then(
    () => "connected",
    (e: Error & { cause?: Error }) => (/not reachable/.test(`${e.message} ${e.cause?.message}`) ? "refused" : `error: ${e.cause?.message ?? e.message}`),
  );
  check(rebound === "refused", `connect-time check refuses a name that resolves to a private address (${rebound})`);

  console.log("Local AI");
  check(!serverReachesLocal(), "hosted server never reaches model servers on its own machine");

  console.log(failed ? `\n${failed} check(s) failed` : "\nAll hosting checks passed");
  process.exit(failed ? 1 : 0);
}

main();
