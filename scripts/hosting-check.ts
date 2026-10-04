/**
 * Checks the safeguards a public deployment relies on, in production mode:
 *
 *   npm run check:hosting
 *
 * rate limits (windows, 429s, spoofed X-Forwarded-For, the shared AI budget), capture storage
 * clean-up (age and size caps), the SSRF guard (localhost, private ranges, cloud metadata,
 * credentials, odd schemes), the local-AI restriction and the admin area (sign-in, sessions, the
 * film log, the server AI key) and accounts (passwords, sessions, saved intros, plan limits). Exits non-zero on any failure.
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

  console.log("Admin area");
  delete env.ADMIN_PASSWORD;
  const admin = await import("../src/lib/admin");
  const sessionRoute = await import("../src/app/api/admin/session/route");
  const filmsRoute = await import("../src/app/api/admin/films/route");
  const settingsRoute = await import("../src/app/api/admin/settings/route");
  const { stat, readFile: read } = await import("node:fs/promises");
  const A = "https://demo.example";
  const areq = (path: string, init: RequestInit & { cookie?: string; origin?: string | null } = {}) => {
    const headers: Record<string, string> = { "x-forwarded-for": "203.0.113.50", host: "demo.example", "content-type": "application/json" };
    if (init.cookie) headers.cookie = init.cookie;
    if (init.origin !== null && (init.method ?? "GET") !== "GET") headers.origin = init.origin ?? A;
    return new Request(A + path, { ...init, headers });
  };
  const plan = { title: "Check", palette: "midnight", font: "inter", aspect: "16:9", bpm: 120, seed: 1, scenes: [{ skill: "blur-reveal", text: "Hi", duration: 3, transition: "cut" }] } as never;
  check((await (await sessionRoute.GET(areq("/api/admin/session"))).json()).enabled === false, "off without ADMIN_PASSWORD");
  check((await filmsRoute.GET(areq("/api/admin/films"))).status === 404, "admin API answers 404 while off");
  await admin.recordFilm(areq("/api/generate", { method: "POST" }), { kind: "generated", plan, engine: "builtin", prompt: "secret prompt" });
  check(!(await readdir(dataDir)).includes("admin"), "nothing is logged while the admin area is off");

  env.ADMIN_PASSWORD = "correct horse battery staple";
  rl.resetLimits();
  const login = (pw: string, origin?: string | null) => sessionRoute.POST(areq("/api/admin/session", { method: "POST", body: JSON.stringify({ password: pw }), origin }));
  check((await login("wrong")).status === 401, "a wrong password is refused");
  check((await login(env.ADMIN_PASSWORD, "https://evil.example")).status === 403, "sign-in from another site is refused");
  const ok = await login(env.ADMIN_PASSWORD);
  const setCookie = ok.headers.get("set-cookie") ?? "";
  check(ok.status === 200 && /HttpOnly/.test(setCookie) && /SameSite=Strict/.test(setCookie) && /Secure/.test(setCookie), "sign-in sets an HttpOnly, SameSite=Strict, Secure cookie");
  const cookie = setCookie.split(";")[0];
  check((await filmsRoute.GET(areq("/api/admin/films"))).status === 401, "the admin API needs the session");
  check((await filmsRoute.GET(areq("/api/admin/films", { cookie }))).status === 200, "the session opens the admin API");
  check((await filmsRoute.DELETE(areq("/api/admin/films", { method: "DELETE", cookie, origin: "https://evil.example", body: JSON.stringify({ all: true }) }))).status === 403, "a cross-site write with the cookie is refused");
  const token = cookie.split("=")[1];
  const tampered = token.slice(0, -2) + (token.at(-2) === "A" ? "B" : "A") + token.slice(-1);
  check(!admin.validSession(tampered), "a tampered session is rejected");
  check(!admin.validSession(token, Date.now() + 13 * 3_600_000), "sessions expire after 12 hours");

  await admin.recordFilm(areq("/api/generate", { method: "POST" }), { kind: "generated", plan, engine: "builtin", prompt: "a CRM for teams" });
  const listed = await (await filmsRoute.GET(areq("/api/admin/films", { cookie }))).json();
  check(listed.total === 1 && listed.items[0].prompt === "a CRM for teams" && /^[a-f0-9]{10}$/.test(listed.items[0].visitor), "films are logged with a hashed visitor");
  check(!JSON.stringify(listed).includes("203.0.113.50"), "the visitor's address is never stored");

  const put = await settingsRoute.PUT(areq("/api/admin/settings", { method: "PUT", cookie, body: JSON.stringify({ provider: "openai", apiKey: "sk-test-1234567890abcdef", model: "gpt-5", dailyBudget: 7 }) }));
  const view = await put.json();
  check(put.status === 200 && view.keySet && !JSON.stringify(view).includes("1234567890abcdef"), "a saved key is never sent back (masked)");
  const mode = (await stat(join(dataDir, "admin", "settings.json"))).mode & 0o777;
  check(mode === 0o600, `settings file is private to the app (${mode.toString(8)})`);
  // Plug and play: voice and marketplace keys pasted in Admin → Setup / AI, env variables as fallback.
  const setupRoute = await import("../src/app/api/admin/setup/route");
  env.ELEVENLABS_API_KEY = "el-env-key-000000000000";
  const keysPut = await setupRoute.PUT(areq("/api/admin/setup", { method: "PUT", cookie, body: JSON.stringify({ keys: { openaiVoice: "sk-voice-1234567890abcdef", amazonTag: "mystore-20" } }) }));
  const keysView = await keysPut.json();
  check(keysPut.status === 200 && keysView.keys.openaiVoice.source === "admin" && !JSON.stringify(keysView).includes("1234567890abcdef") && keysView.keys.elevenlabs.source === "env", "service keys saved in Admin are never sent back (masked); env keys show as env");
  check((await admin.serviceKey("openaiVoice")) === "sk-voice-1234567890abcdef" && (await admin.serviceKey("elevenlabs")) === "el-env-key-000000000000", "a key saved in Admin is used, the environment is the fallback");
  const ttsRoute = await import("../src/app/api/tts/route");
  check((await (await ttsRoute.GET()).json()).openai === true, "the studio sees the server's voice key from Admin");
  await setupRoute.PUT(areq("/api/admin/setup", { method: "PUT", cookie, body: JSON.stringify({ clear: ["openaiVoice"] }) }));
  check(!(await admin.serviceKey("openaiVoice")) && (await admin.serviceKey("amazonTag")) === "mystore-20", "a key can be removed from Admin");
  check((await setupRoute.GET(areq("/api/admin/setup"))).status === 401, "the setup page needs the admin session");
  delete env.ELEVENLABS_API_KEY;
  const active = await admin.serverAi();
  check(active?.source === "admin" && active.ai.apiKey === "sk-test-1234567890abcdef" && (await admin.readSettings()).dailyBudget === 7, "the server director uses the admin's AI and budget");
  await settingsRoute.PUT(areq("/api/admin/settings", { method: "PUT", cookie, body: JSON.stringify({ provider: "openai", apiKey: "", model: "gpt-5" }) }));
  check((await admin.serverAi())?.ai.apiKey === "sk-test-1234567890abcdef", "saving with an empty key keeps the saved key");
  await settingsRoute.PUT(areq("/api/admin/settings", { method: "PUT", cookie, body: JSON.stringify({ provider: "openai", clearKey: true }) }));
  check(!JSON.parse(await read(join(dataDir, "admin", "settings.json"), "utf8")).ai?.apiKey, "the key can be removed");

  rl.resetLimits();
  const tries: number[] = [];
  for (let i = 0; i < rl.RULES.adminLogin.limit + 1; i++) tries.push((await login("guess" + i)).status);
  check(tries.slice(0, -1).every((c) => c === 401) && tries.at(-1) === 429, `password guessing is limited (${rl.RULES.adminLogin.limit} tries, then 429)`);
  env.ADMIN_PASSWORD = "a new password";
  check(!admin.validSession(token), "changing ADMIN_PASSWORD signs everyone out");

  console.log("Accounts and plans");
  rl.resetLimits();
  const acc = await import("../src/lib/accounts");
  const accountRoute = await import("../src/app/api/account/route");
  const accSession = await import("../src/app/api/account/session/route");
  const accFilms = await import("../src/app/api/account/films/route");
  const accFilm = await import("../src/app/api/account/films/[id]/route");
  const accPassword = await import("../src/app/api/account/password/route");
  const adminUsers = await import("../src/app/api/admin/users/[id]/route");
  const scrapeRoute = await import("../src/app/api/scrape/route");
  const ureq = (path: string, init: RequestInit & { cookie?: string; origin?: string | null; ip?: string } = {}) => {
    const headers: Record<string, string> = { "x-forwarded-for": init.ip ?? "203.0.113.60", host: "demo.example", "content-type": "application/json" };
    if (init.cookie) headers.cookie = init.cookie;
    if (init.origin !== null && (init.method ?? "GET") !== "GET") headers.origin = init.origin ?? A;
    return new Request(A + path, { ...init, headers });
  };
  const signup = await accountRoute.POST(ureq("/api/account", { method: "POST", body: JSON.stringify({ email: "Ana@Example.com ", password: "pass-word-1" }) }));
  const ucookie = (signup.headers.get("set-cookie") ?? "").split(";")[0];
  check(signup.status === 200 && /HttpOnly/.test(signup.headers.get("set-cookie") ?? "") && ucookie.startsWith("im_user="), "sign-up creates the account and signs in (HttpOnly cookie)");
  check((await accountRoute.POST(ureq("/api/account", { method: "POST", body: JSON.stringify({ email: "ana@example.com", password: "another-pass" }) }))).status === 409, "one account per email (case-insensitive)");
  check((await accountRoute.POST(ureq("/api/account", { method: "POST", body: JSON.stringify({ email: "bo@example.com", password: "short" }) }))).status === 400, "short passwords are refused");
  const stored = await read(join(dataDir, "accounts", "users", (await acc.currentUser(ureq("/", { cookie: ucookie })))!.id + ".json"), "utf8");
  check(!stored.includes("pass-word-1") && stored.includes("scrypt$"), "the password is stored only as an scrypt hash");
  check((await accSession.POST(ureq("/api/account/session", { method: "POST", body: JSON.stringify({ email: "ana@example.com", password: "nope-nope" }) }))).status === 401, "a wrong password is refused");
  check((await accSession.POST(ureq("/api/account/session", { method: "POST", origin: "https://evil.example", body: JSON.stringify({ email: "ana@example.com", password: "pass-word-1" }) }))).status === 403, "sign-in from another site is refused");
  // Plans are unlimited by default for now; the owner's limits (set in Admin → Plans) are still
  // enforced, so the checks below set the old Free / Pro limits first.
  const plansLib = await import("../src/lib/plans");
  check(Object.values(plansLib.DEFAULT_LIMITS).every((l) => l.savedFilms >= 100_000 && l.importsPerDay >= 100_000 && !l.watermark && l.maxLong === 3840), "every plan is unlimited by default, for now");
  const oldFree = { savedFilms: 3, aiPerMonth: 0, importsPerDay: 3, watermark: true, maxLong: 1920, maxFps: 30 };
  const oldPro = { savedFilms: 200, aiPerMonth: 100, importsPerDay: 50, watermark: false, maxLong: 3840, maxFps: 60 };
  check(plansLib.readLimits({ free: oldFree, pro: oldPro }, { legacy: true }).free.savedFilms >= 100_000, "plans saved with the old defaults (never customised) become unlimited too");
  check(plansLib.readLimits({ free: oldFree, pro: oldPro }).free.savedFilms === 3, "limits saved today are kept exactly, even the old default numbers");
  check(plansLib.readLimits({ free: { ...oldFree, savedFilms: 5 } }).free.savedFilms === 5, "limits the owner changed are kept");
  // (Customised, so they're enforced: one value differs from the old defaults.)
  await admin.writeSettings({ plans: { free: { ...oldFree, maxLong: 1280 }, pro: { ...oldPro, maxFps: 30 } } });
  const save = (cookie: string, body: object) => accFilms.POST(ureq("/api/account/films", { method: "POST", cookie, body: JSON.stringify({ plan, ...body }) }));
  const saved = await Promise.all([1, 2, 3].map(() => save(ucookie, {})));
  check(saved.every((r) => r.status === 200), "Free keeps 3 saved intros");
  const fourth = await save(ucookie, {});
  check(fourth.status === 402, "a 4th saved intro on Free is refused with an upgrade message");
  const firstId = (await saved[0].json()).id;
  check((await save(ucookie, { id: firstId, title: "Renamed by save" })).status === 200, "updating a saved intro doesn't count against the limit");
  const other = await accountRoute.POST(ureq("/api/account", { method: "POST", ip: "203.0.113.61", body: JSON.stringify({ email: "bo@example.com", password: "bo-password" }) }));
  const ocookie = (other.headers.get("set-cookie") ?? "").split(";")[0];
  check((await accFilm.GET(ureq(`/api/account/films/${firstId}`, { cookie: ocookie }), { params: Promise.resolve({ id: firstId }) })).status === 404, "another account can't open someone's intro");
  check((await accFilms.GET(ureq("/api/account/films"))).status === 401, "saved intros need a signed-in account");

  // Plans (with the owner's limits): Free has no AI allowance and 3 imports a day; the owner grants Pro.
  const anaId = (await acc.currentUser(ureq("/", { cookie: ucookie })))!.id;
  check((await acc.limitsFor(await acc.getUser(anaId))).aiPerMonth === 0, "Free's AI allowance follows the owner's limit");
  const imports: number[] = [];
  const importReq = () => ureq("/api/scrape", { method: "POST", ip: "198.51.100.77", body: JSON.stringify({ url: "http://127.0.0.1/" }) });
  for (let i = 0; i < 4; i++) imports.push((await scrapeRoute.POST(importReq())).status);
  check(imports.every((c) => c === 422), `imports that fail don't use up the daily allowance (${imports.join(",")})`);
  // Three successful imports (counted as the route counts them), then the fourth is refused.
  for (let i = 0; i < 3; i++) rl.take("importDay", rl.clientKey(importReq()), Date.now(), 3);
  check((await scrapeRoute.POST(importReq())).status === 429, "a visitor without an account gets 3 imports a day");
  const promote = await adminUsers.PATCH(areq(`/api/admin/users/${anaId}`, { method: "PATCH", cookie: (await login(env.ADMIN_PASSWORD!)).headers.get("set-cookie")!.split(";")[0], body: JSON.stringify({ plan: "pro" }) }), { params: Promise.resolve({ id: anaId }) });
  check(promote.status === 200 && (await acc.getUser(anaId))!.plan === "pro", "the owner switches an account to Pro");
  check((await save(ucookie, {})).status === 200, "Pro keeps more saved intros");
  const proUser = (await acc.getUser(anaId))!;
  check((await acc.limitsFor(proUser)).aiPerMonth === 100 && (await acc.spendAi(proUser)) && acc.usageOf((await acc.getUser(anaId))!).ai === 1, "Pro's AI allowance is counted per month");

  // The film log links a signed-in maker's films to their account, for the owner.
  const adminCookie = (await login(env.ADMIN_PASSWORD!)).headers.get("set-cookie")!.split(";")[0];
  const usersList = await import("../src/app/api/admin/users/route");
  const madeBy = { id: anaId, email: "ana@example.com" };
  await admin.recordFilm(ureq("/api/generate", { method: "POST" }), { kind: "generated", plan, engine: "builtin", prompt: "Coffee subscription with fresh roasts", account: madeBy });
  await admin.recordFilm(ureq("/api/generate", { method: "POST" }), { kind: "generated", plan, engine: "builtin", prompt: "Roasts for coffee lovers", account: madeBy });
  const mine = await (await filmsRoute.GET(areq(`/api/admin/films?account=${anaId}`, { cookie: adminCookie }))).json();
  check(mine.total === 2 && mine.items.every((e: { account?: { email: string } }) => e.account?.email === "ana@example.com"), "films made while signed in are linked to the account");
  check(mine.stats.keywords.some(([w, n]: [string, number]) => w === "coffee" && n === 2) && !mine.stats.keywords.some(([w]: [string, number]) => w === "with"), "the log lists the keywords people use");
  const users = await (await usersList.GET(areq("/api/admin/users", { cookie: adminCookie }))).json();
  const anaRow = users.users.find((u: { id: string }) => u.id === anaId);
  check(anaRow?.made.made === 2 && anaRow.made.recent[0] === "Roasts for coffee lovers", "the Users tab shows the intros an account made and its prompts");
  await admin.forgetAccount(anaId);
  const forgot = await (await filmsRoute.GET(areq(`/api/admin/films?account=${anaId}`, { cookie: adminCookie }))).json();
  check(forgot.total === 0 && (await (await filmsRoute.GET(areq("/api/admin/films?q=fresh+roasts", { cookie: adminCookie }))).json()).total === 1, "a deleted account's films stay in the log without its email");

  // Sessions end on a password change, and tampering is rejected.
  const tamperedU = ucookie.slice(0, -2) + (ucookie.at(-2) === "A" ? "B" : "A") + ucookie.slice(-1);
  check(!(await acc.currentUser(ureq("/", { cookie: tamperedU }))), "a tampered account session is rejected");
  const changed = await accPassword.POST(ureq("/api/account/password", { method: "POST", cookie: ucookie, body: JSON.stringify({ current: "pass-word-1", next: "new-pass-word" }) }));
  check(changed.status === 200 && !(await acc.currentUser(ureq("/", { cookie: ucookie }))), "changing the password signs out the old sessions");
  const temp = await acc.resetPassword(anaId);
  check(!!temp && (await accSession.POST(ureq("/api/account/session", { method: "POST", body: JSON.stringify({ email: "ana@example.com", password: temp }) }))).status === 200 && (await acc.getUser(anaId))!.mustChangePassword === true, "an owner reset gives a one-time password that must be changed");
  rl.resetLimits();
  const guesses: number[] = [];
  for (let i = 0; i < rl.RULES.accountLogin.limit + 1; i++) guesses.push((await accSession.POST(ureq("/api/account/session", { method: "POST", body: JSON.stringify({ email: "ana@example.com", password: "guess" + i }) }))).status);
  check(guesses.at(-1) === 429, `account password guessing is limited (${rl.RULES.accountLogin.limit} tries, then 429)`);

  console.log("Stripe");
  const billing = await import("../src/lib/billing");
  const webhook = await import("../src/app/api/stripe/webhook/route");
  const { createHmac } = await import("node:crypto");
  const secret = "whsec_hostingcheck";
  const sign = (body: string, t = Math.floor(Date.now() / 1000), key = secret) => `t=${t},v1=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`;
  const hook = (ev: object, sig?: (body: string) => string) => {
    const body = JSON.stringify(ev);
    return webhook.POST(new Request(A + "/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": (sig ?? sign)(body) }, body }));
  };
  const boId = (await acc.findUserByEmail("bo@example.com"))!.id;
  const paid = { id: "evt_paid", type: "checkout.session.completed", data: { object: { client_reference_id: boId, customer: "cus_bo", subscription: "sub_bo", payment_status: "paid" } } };
  delete env.STRIPE_WEBHOOK_SECRET;
  check((await hook(paid)).status === 503, "the webhook is off (503) until STRIPE_WEBHOOK_SECRET is set");
  env.STRIPE_WEBHOOK_SECRET = secret;
  check((await hook(paid, () => "t=1,v1=00")).status === 400, "a forged signature is refused");
  check((await hook(paid, (b) => sign(b, Math.floor(Date.now() / 1000) - 600))).status === 400, "a replayed (stale) signature is refused");
  check((await hook(paid, (b) => sign(b, undefined, "whsec_other"))).status === 400, "a signature from another secret is refused");
  const done = await hook(paid);
  const bo = (await acc.getUser(boId))!;
  check(done.status === 200 && bo.plan === "pro" && bo.planSource === "stripe" && bo.stripeCustomerId === "cus_bo", "a paid checkout switches the account to Pro");
  check(/duplicate/.test((await (await hook(paid)).json()).result), "a repeated event is applied once");
  await hook({ id: "evt_fail", type: "invoice.payment_failed", data: { object: { customer: "cus_bo" } } });
  check((await acc.getUser(boId))!.billingStatus === "past_due" && (await acc.getUser(boId))!.plan === "pro", "a failed payment marks past due and keeps Pro during Stripe's retries");
  await hook({ id: "evt_cancel", type: "customer.subscription.deleted", data: { object: { id: "sub_bo", customer: "cus_bo", status: "canceled" } } });
  check((await acc.getUser(boId))!.plan === "free", "a cancelled subscription goes back to Free");
  await acc.updateUser(anaId, (x) => void (x.stripeCustomerId = "cus_ana"));
  await hook({ id: "evt_ana", type: "customer.subscription.deleted", data: { object: { id: "sub_ana", customer: "cus_ana", status: "canceled" } } });
  check((await acc.getUser(anaId))!.plan === "pro", "Stripe never takes back a plan the owner set by hand");
  // A plan set by hand also isn't re-granted by a later subscription event (a renewal).
  await acc.updateUser(anaId, (x) => void ((x.plan = "free"), (x.planSource = "admin")));
  await hook({ id: "evt_ana_renew", type: "customer.subscription.updated", data: { object: { id: "sub_ana", customer: "cus_ana", status: "active" } } });
  check((await acc.getUser(anaId))!.plan === "free", "a renewal doesn't undo a plan the owner set by hand");
  // A bank debit completes the checkout before the money arrives: no Pro until it does.
  const cyId = (await acc.createUser("cy@example.com", "cy-password-1")).id;
  await hook({ id: "evt_cy_pending", type: "checkout.session.completed", created: 1000, data: { object: { client_reference_id: cyId, customer: "cus_cy", status: "complete", payment_status: "unpaid" } } });
  check((await acc.getUser(cyId))!.plan === "free", "an unpaid (pending bank) checkout doesn't grant Pro");
  await hook({ id: "evt_cy_paid", type: "checkout.session.async_payment_succeeded", created: 1100, data: { object: { client_reference_id: cyId, customer: "cus_cy", payment_status: "paid" } } });
  check((await acc.getUser(cyId))!.plan === "pro", "the bank payment arriving grants Pro");
  await hook({ id: "evt_cy_del", type: "customer.subscription.deleted", created: 1300, data: { object: { id: "sub_cy", customer: "cus_cy", status: "canceled" } } });
  await hook({ id: "evt_cy_old", type: "customer.subscription.updated", created: 1200, data: { object: { id: "sub_cy", customer: "cus_cy", status: "active" } } });
  check((await acc.getUser(cyId))!.plan === "free", "an older event arriving late (a retry) doesn't re-grant Pro");
  await hook({ id: "evt_cy_buy2", type: "checkout.session.completed", created: 1400, data: { object: { client_reference_id: cyId, customer: "cus_cy", payment_status: "paid" } } });
  await hook({ id: "evt_cy_fail", type: "invoice.payment_failed", created: 1500, data: { object: { customer: "cus_cy" } } });
  await hook({ id: "evt_cy_inv", type: "invoice.paid", created: 1600, data: { object: { customer: "cus_cy", amount_paid: 900 } } });
  check((await acc.getUser(cyId))!.billingStatus === "active", "a paid invoice clears a failed payment");
  // Money that reaches no account is flagged for the owner, who links it.
  await hook({ id: "evt_orphan", type: "checkout.session.completed", data: { object: { customer: "cus_orphan", customer_details: { email: "nobody@example.com" }, payment_status: "paid" } } });
  const st = await billing.billingStatus();
  check(st.recent[0].attention === true && /no account matches/.test(st.recent[0].result), "a payment that matches no account is flagged in Billing");
  const linkRoute = await import("../src/app/api/admin/users/[id]/route");
  const linked = await linkRoute.PATCH(areq(`/api/admin/users/${boId}`, { method: "PATCH", cookie: adminCookie, body: JSON.stringify({ stripeCustomerId: "cus_orphan" }) }), { params: Promise.resolve({ id: boId }) });
  const boNow = (await acc.getUser(boId))!;
  check(linked.status === 200 && boNow.plan === "pro" && boNow.planSource === "stripe" && boNow.stripeCustomerId === "cus_orphan", "the owner links an unmatched payment to its account");
  check((await linkRoute.PATCH(areq(`/api/admin/users/${cyId}`, { method: "PATCH", cookie: adminCookie, body: JSON.stringify({ stripeCustomerId: "cus_orphan" }) }), { params: Promise.resolve({ id: cyId }) })).status === 409, "a Stripe customer can't be linked to two accounts");
  // A live subscription keeps charging, so the account can't simply be deleted.
  const cyCookie = (await accSession.POST(ureq("/api/account/session", { method: "POST", ip: "203.0.113.70", body: JSON.stringify({ email: "cy@example.com", password: "cy-password-1" }) }))).headers.get("set-cookie")!.split(";")[0];
  const selfDel = await accountRoute.DELETE(ureq("/api/account", { method: "DELETE", cookie: cyCookie, body: JSON.stringify({ password: "cy-password-1" }) }));
  check(selfDel.status === 409 && !!(await acc.getUser(cyId)), "a subscriber is asked to cancel before deleting their account");
  check((await linkRoute.DELETE(areq(`/api/admin/users/${cyId}`, { method: "DELETE", cookie: adminCookie }), { params: Promise.resolve({ id: cyId }) })).status === 409, "the owner can't delete a paying account without confirming it was cancelled");
  check((await linkRoute.DELETE(areq(`/api/admin/users/${cyId}?stripeCancelled=1`, { method: "DELETE", cookie: adminCookie }), { params: Promise.resolve({ id: cyId }) })).status === 204, "after cancelling in Stripe, the owner can delete it");
  const rejectedBefore = (await billing.billingStatus()).rejected;
  await hook(paid, () => "t=1,v1=00");
  check((await billing.billingStatus()).rejected === rejectedBefore + 1, "refused deliveries are counted for the owner (secret or mode mismatch)");
  check(!billing.stripeLink("https://evil.example/pay", "pay") && !billing.stripeLink("http://buy.stripe.com/x", "pay") && !billing.stripeLink("https://buy.stripe.com/x", "portal"), "only Stripe-hosted https links are accepted");
  const link = billing.checkoutUrl(billing.stripeLink("https://buy.stripe.com/test_abc", "pay")!, { id: boId, email: "bo@example.com" });
  check(new URL(link).searchParams.get("client_reference_id") === boId && billing.isTestLink(link), "payment links carry the account id and are recognised as test links");
  delete env.STRIPE_WEBHOOK_SECRET;

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

  console.log("Website import errors");
  const { httpProblem, networkProblem } = await import("../src/lib/scrape");
  const page = new URL("https://acme.example/pricing/old");
  const nf = httpProblem(404, page);
  check(nf.code === "notfound" && nf.suggestion === "https://acme.example/", "a missing page (404) suggests importing the home page");
  check(httpProblem(503, page).code === "server" && httpProblem(403, page).code === "blocked" && httpProblem(429, page).code === "busy", "down, blocking and rate-limiting sites are told apart");
  const cause = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(code), { code }) });
  check(
    networkProblem(cause("ENOTFOUND"), page).code === "dns" &&
      networkProblem(cause("ECONNREFUSED"), page).code === "refused" &&
      networkProblem(cause("CERT_HAS_EXPIRED"), page).code === "tls" &&
      networkProblem(Object.assign(new Error("t"), { name: "TimeoutError" }), page).code === "timeout",
    "unknown domains, refused connections, bad certificates and timeouts each get their own message",
  );

  console.log("Product listings and photos");
  const listing = await import("../src/lib/listing");
  check(
    listing.marketOf("https://www.amazon.co.uk/Some-Thing/dp/B0TEST1234")?.id === "amazon" && listing.marketOf("https://www.ebay.com/itm/123")?.id === "ebay" && listing.marketOf("https://shop.example/products/mug")?.id === "shop" && !listing.marketOf("https://www.amazon.com/"),
    "listing links are recognised (Amazon, eBay, Shopify stores), other pages aren't",
  );
  check(
    listing.canonicalListing("https://www.amazon.com/Aero-Buds-Wireless-Earbuds-Cancelling/dp/B0C1234XYZ/ref=sr_1_3?crid=2X&keywords=earbuds&qid=1700&sr=8-3&th=1") === "https://www.amazon.com/dp/B0C1234XYZ" &&
      listing.canonicalListing("amazon.co.uk/gp/product/B0C1234XYZ?psc=1") === "https://www.amazon.co.uk/dp/B0C1234XYZ" &&
      listing.canonicalListing("https://www.amazon.de/gp/aw/d/B0C1234XYZ/?_encoding=UTF8") === "https://www.amazon.de/dp/B0C1234XYZ" &&
      listing.canonicalListing("B0C1234XYZ") === "https://www.amazon.com/dp/B0C1234XYZ" &&
      listing.canonicalListing("https://www.ebay.co.uk/itm/Aero-Buds/123456789012?hash=item1c&_trkparms=x") === "https://www.ebay.co.uk/itm/123456789012" &&
      listing.canonicalListing("https://shop.example/products/mug?variant=42&utm_source=x") === "https://shop.example/products/mug",
    "listing links are cleaned to the product code (amazon.com/dp/ASIN), dropping slugs and tracking",
  );
  check(listing.fullSize("https://m.media-amazon.com/images/I/61a._AC_SX679_.jpg") === "https://m.media-amazon.com/images/I/61a.jpg", "thumbnail addresses are upgraded to full-size photos");
  const amazonHtml = `<span id="productTitle">Aero Buds Pro Wireless Earbuds, 40H Playtime</span><a id="bylineInfo">Visit the Aero Store</a><span class="a-price">$59.99</span><div id="feature-bullets"><ul><li><span class="a-list-item">NOISE CANCELLING: two microphones per bud.</span></li><li><span class="a-list-item">Secure fit - three sizes of ear tips.</span></li></ul></div><img src="https://m.media-amazon.com/images/G/01/nav-logo.png"><script>{"hiRes":"https://m.media-amazon.com/images/I/61a._AC_SL1500_.jpg"}</script>`;
  const parsed = listing.readListing(amazonHtml, new URL("https://www.amazon.com/dp/B0TEST1234"), { id: "amazon", name: "Amazon" });
  check(
    parsed?.kind === "product" && parsed.name === "Aero" && parsed.tagline === "Aero Buds Pro Wireless Earbuds" && parsed.headlines.join() === "Noise cancelling,Secure fit" && parsed.images.join() === "https://m.media-amazon.com/images/I/61a.jpg" && !parsed.logo && !JSON.stringify(parsed).includes("59.99"),
    "an Amazon listing gives the product, its bullets and photos (never the price or the marketplace's logo)",
  );
  const market = await import("../src/lib/marketplaces");
  check(
    market.titleFromLink("https://www.amazon.com/Aero-Buds-Wireless-Earbuds-Cancelling/dp/B0C1234XYZ/ref=sr_1_3") === "Aero Buds Wireless Earbuds Cancelling" &&
      market.titleFromLink("https://www.walmart.com/ip/Aero-Buds-Pro-Earbuds/123456") === "Aero Buds Pro Earbuds" &&
      market.titleFromLink("https://www.etsy.com/listing/123456/handmade-ceramic-mug") === "Handmade Ceramic Mug" &&
      market.titleFromLink("https://www.amazon.com/dp/B0C1234XYZ") === "",
    "a blocked listing still gets the product's name from its link",
  );
  check(
    market.sigV4Key("wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", "20120215", "us-east-1", "iam").toString("hex") === "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d",
    "Amazon API requests are signed correctly (AWS Signature V4 known answer)",
  );
  const altAmazon = `<html><head><meta name="title" content="Amazon.com: Aero Buds Pro Wireless Earbuds : Electronics"><title>Amazon.com: Aero Buds Pro Wireless Earbuds : Electronics</title></head><body><div id="productOverview_feature_div"><table><tr><td>Brand</td><td>Aero</td></tr></table></div><div id="featurebullets_feature_div"><ul><li><span class="a-list-item">NOISE CANCELLING: quiet on the go.</span></li></ul></div><script>{"mainUrl":"https://m.media-amazon.com/images/I/61a._AC_SL1500_.jpg"}</script></body></html>`;
  const alt = listing.readListing(altAmazon, new URL("https://www.amazon.com/dp/B0C1234XYZ"), { id: "amazon", name: "Amazon" });
  check(
    alt?.tagline === "Aero Buds Pro Wireless Earbuds" && alt.name === "Aero" && alt.headlines[0] === "Noise cancelling" && alt.images[0] === "https://m.media-amazon.com/images/I/61a.jpg",
    "Amazon pages read through markup changes (title tag, overview table, other bullet and photo blocks)",
  );
  const viaApi = listing.readListing("<html></html>", new URL("https://www.ebay.com/itm/123456789012"), { id: "ebay", name: "eBay" }, { title: "Aero Buds Pro Wireless Earbuds", brand: "Aero", description: "", bullets: ["Noise Cancelling", "Water Resistant"], images: ["https://i.ebayimg.com/images/g/AbC/s-l500.jpg"] });
  check(viaApi?.images[0] === "https://i.ebayimg.com/images/g/AbC/s-l1600.jpg" && viaApi.headlines.length === 2, "a marketplace API's product becomes the listing (full-size photos, features)");
  const { calloutTitle } = await import("../src/engine/planner");
  check(
    calloutTitle("Premium Sound Quality With Deep Bass") === "Premium sound quality" &&
      calloutTitle("IPX5 Water Resistant") === "IPX5 water resistant" &&
      calloutTitle("Works With Alexa Devices", "Control it by voice with Alexa or your phone.") === "Works with Alexa devices",
    "product callouts are short, in sentence case, keeping model codes and names",
  );
  const photosRoute = await import("../src/app/api/photos/route");
  const upload = (parts: Blob[], origin = "http://localhost:3000") => {
    const form = new FormData();
    for (const p of parts) form.append("photo", p, "photo.jpg");
    return photosRoute.POST(new Request("http://localhost:3000/api/photos", { method: "POST", body: form, headers: { origin, host: "localhost:3000", "x-forwarded-for": "198.51.100.77" } }));
  };
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(100).fill(0), 0xff, 0xd9])], { type: "image/jpeg" });
  const html = new Blob(["<html><script>alert(1)</script></html>".padEnd(120, " ")], { type: "image/jpeg" });
  const okUp = await upload([jpeg]);
  const urls = okUp.status === 200 ? ((await okUp.json()) as { photos: string[] }).photos : [];
  check(urls.length === 1 && /^\/api\/shot\?id=[a-f0-9]{16}-u0$/.test(urls[0]), "an uploaded JPEG is stored and served from /api/shot");
  check((await upload([html])).status === 415, "anything that isn't a JPEG is refused, whatever it claims to be");
  check((await upload([jpeg], "https://evil.example")).status === 403, "uploads from another site are refused");

  console.log("Local AI");
  check(!serverReachesLocal(), "hosted server never reaches model servers on its own machine");

  console.log(failed ? `\n${failed} check(s) failed` : "\nAll hosting checks passed");
  process.exit(failed ? 1 : 0);
}

main();
