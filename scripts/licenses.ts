/**
 * Open-source licence check and notices.
 *
 *   npm run check:licenses   fail if any dependency's licence isn't open source and fine for
 *                            commercial use (or is copyleft without an explained exception)
 *   npm run licenses         also write THIRD_PARTY_NOTICES.md (full licence texts) and the
 *                            data for the in-app /licenses page
 *
 * Covers every production package in package-lock.json (including optional platform binaries),
 * the dev tools, and the components Prodintro.com loads at runtime rather than from npm.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const WRITE = process.argv.includes("--write");

/** Permissive licences: commercial use allowed; keep the notice. */
const PERMISSIVE = new Set(["MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "BSD 2 Clause", "BSD 3 Clause", "0BSD", "Unlicense", "CC0-1.0", "BlueOak-1.0.0", "Zlib", "Python-2.0"]);
/** Allowed with conditions, each explained in the notices. */
const CONDITIONAL: Record<string, string> = {
  "OFL-1.1": "Fonts: free to use, embed and ship commercially (including in rendered videos); the fonts themselves may not be sold on their own.",
  "MPL-2.0": "File-level copyleft: commercial use is fine; changes made to the MPL files themselves must be shared. Prodintro.com uses them unmodified.",
  "CC-BY-4.0": "Data (browser-support tables used at build time): commercial use is fine with attribution, given here.",
};
/** Copyleft packages allowed only for an explained reason. */
const EXCEPTIONS: { match: RegExp; licence: RegExp; why: string }[] = [
  {
    match: /^@img\/sharp/,
    licence: /LGPL-3\.0/,
    why: "Optional image optimiser installed by Next.js (libvips, LGPL-3.0). Prodintro.com turns image optimisation off (next.config: images.unoptimized), so it is never loaded, and the Docker build deletes it from the production server. LGPL-3.0 permits commercial use of an unmodified, separately linked library.",
  },
];

type Entry = { name: string; version: string; licence: string; scope: "prod" | "dev" | "runtime"; installed: boolean; optional: boolean; text?: string; notice?: string; homepage?: string; note?: string };

function licenceFiles(dir: string) {
  if (!existsSync(dir)) return { text: undefined, notice: undefined };
  const files = readdirSync(dir);
  const read = (re: RegExp) => {
    const f = files.find((x) => re.test(x));
    return f ? readFileSync(join(dir, f), "utf8").trim() : undefined;
  };
  return { text: read(/^(licen[cs]e|copying)(\.(md|txt|markdown))?$/i) ?? read(/^licen[cs]e/i), notice: read(/^notice(\.(md|txt))?$/i) };
}

const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8")) as { packages: Record<string, { version?: string; license?: string; dev?: boolean; optional?: boolean }> };
const entries: Entry[] = [];
for (const [path, p] of Object.entries(lock.packages)) {
  if (!path) continue;
  const name = path.replace(/^.*node_modules\//, "");
  const dir = join(ROOT, path);
  const installed = existsSync(join(dir, "package.json"));
  const pj = installed ? (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { homepage?: string; repository?: string | { url?: string } }) : {};
  const repo = typeof pj.repository === "string" ? pj.repository : pj.repository?.url;
  entries.push({
    name,
    version: p.version ?? "?",
    licence: p.license ?? "UNKNOWN",
    scope: p.dev ? "dev" : "prod",
    installed,
    optional: !!p.optional,
    homepage: pj.homepage ?? repo?.replace(/^git\+/, "").replace(/\.git$/, ""),
    ...(installed ? licenceFiles(dir) : {}),
  });
}

// gl-transitions bundles many shaders, each under its author's licence: list any that differ.
try {
  const all = JSON.parse(readFileSync(join(ROOT, "node_modules/gl-transitions/gl-transitions.json"), "utf8")) as { name: string; license: string; author: string }[];
  const others = all.filter((x) => x.license !== "MIT");
  const gl = entries.find((e) => e.name === "gl-transitions");
  if (gl && others.length) gl.note = `${all.length} GLSL transitions, each under its author's licence: MIT, except ${others.map((x) => `${x.name} (${x.license}, ${x.author})`).join("; ")}. Prodintro.com's gallery uses 12 MIT transitions.`;
} catch {
  /* not installed */
}

/** Loaded at runtime (not from npm), or installed into the Docker image. */
const RUNTIME: Entry[] = [
  {
    name: "kokoro-js", version: "1.2.1", licence: "Apache-2.0", scope: "runtime", installed: false, optional: true, homepage: "https://github.com/hexgrad/kokoro",
    note: "Optional in-browser voice (voice source \"Free voice on this computer\"). Downloaded by the viewer's browser from jsDelivr when chosen; not bundled with or served by Prodintro.com.",
  },
  {
    name: "phonemizer (eSpeak NG)", version: "1.2.1", licence: "Apache-2.0 wrapper; contains eSpeak NG (GPL-3.0-or-later)", scope: "runtime", installed: false, optional: true, homepage: "https://github.com/espeak-ng/espeak-ng",
    note: "Dependency of kokoro-js. Its bundle is a WebAssembly build of eSpeak NG, which is GPL-3.0-or-later: open source and allowed commercially, but copyleft. It is only fetched by the viewer's browser from jsDelivr when the local voice is chosen, and a deployment can remove that option (NEXT_PUBLIC_INTROMAKER_LOCAL_VOICE=off). Source: github.com/espeak-ng/espeak-ng.",
  },
  { name: "@huggingface/transformers", version: "3.x", licence: "Apache-2.0", scope: "runtime", installed: false, optional: true, homepage: "https://github.com/huggingface/transformers.js", note: "Dependency of kokoro-js (model runtime)." },
  { name: "onnxruntime-web", version: "1.x", licence: "MIT", scope: "runtime", installed: false, optional: true, homepage: "https://github.com/microsoft/onnxruntime", note: "Dependency of kokoro-js (inference engine)." },
  { name: "Kokoro-82M (ONNX) model and voices", version: "1.0", licence: "Apache-2.0", scope: "runtime", installed: false, optional: true, homepage: "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX", note: "Voice model weights, downloaded from Hugging Face by the viewer's browser when the local voice is chosen." },
  {
    name: "Chromium (headless shell)", version: "Playwright build", licence: "BSD-3-Clause", scope: "runtime", installed: false, optional: false, homepage: "https://www.chromium.org/",
    note: "Installed into the Docker image by Playwright to capture websites; runs as a separate program. Chromium bundles third-party components under their own permissive and weak-copyleft licences (see chrome://credits).",
  },
  { name: "Google Fonts (brand fonts)", version: "—", licence: "OFL-1.1 / Apache-2.0", scope: "runtime", installed: false, optional: true, homepage: "https://fonts.google.com/", note: "When a captured site uses a Google font, it is loaded from Google Fonts to match the brand." },
];

/**
 * Every file the app serves from public/ (images, media, documents), with where it came from and
 * its licence. The check fails on any file not listed here, so nothing of unknown origin ships.
 */
const ASSETS: { path: string; licence: string; source: string }[] = [
  ...["kelvo-front.jpg", "kelvo-angle.jpg", "kelvo-back.jpg"].map((f) => ({
    path: `public/samples/${f}`,
    licence: "Original work (Prodintro.com's own licence)",
    source: "The imaginary Kelvo bottle for the homepage's sample product video, drawn from plain SVG shapes by scripts/sample-art.mjs; no third-party images (its lettering is set in the system sans-serif).",
  })),
];

/* ───────── check ───────── */

const problems: string[] = [];
const explained: string[] = [];
function judge(e: Entry) {
  const parts = e.licence.replace(/[()]/g, "").split(/\s+(?:OR|AND)\s+|\s*\/\s*/);
  const either = /\sOR\s|\//.test(e.licence);
  const ok = (l: string) => PERMISSIVE.has(l) || l in CONDITIONAL;
  if (either ? parts.some(ok) : parts.every(ok)) return;
  const ex = EXCEPTIONS.find((x) => x.match.test(e.name) && x.licence.test(e.licence));
  if (ex) {
    const label = `${ex.match.source.replace(/\\\//g, "/").replace(/^\^/, "")}*`;
    if (!explained.some((x) => x.startsWith(label))) explained.push(`${label} (${e.licence}): not loaded or shipped`);
    e.note ??= ex.why;
    return;
  }
  if (e.scope === "runtime" && /GPL-3\.0-or-later/.test(e.licence)) {
    explained.push(`${e.name}: ${e.licence} (optional, loaded by the browser, can be switched off)`);
    return;
  }
  problems.push(`${e.scope} ${e.name}@${e.version}: ${e.licence}`);
}
for (const e of [...entries, ...RUNTIME]) judge(e);

// Served files: each one listed with its origin and licence.
const walk = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])) : [];
for (const f of walk(join(ROOT, "public"))) {
  const rel = f.slice(ROOT.length + 1);
  if (!ASSETS.some((a) => a.path === rel)) problems.push(`asset ${rel}: not listed in ASSETS (scripts/licenses.ts) with its source and licence`);
}
for (const a of ASSETS) if (!existsSync(join(ROOT, a.path))) problems.push(`asset ${a.path}: listed but missing`);

const prod = entries.filter((e) => e.scope === "prod");
const dev = entries.filter((e) => e.scope === "dev");
const count = (list: Entry[]) => Object.entries(list.reduce<Record<string, number>>((a, e) => ((a[e.licence] = (a[e.licence] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
console.log(`Production packages: ${prod.length}`);
for (const [l, n] of count(prod)) console.log(`  ${String(n).padStart(3)}  ${l}`);
console.log(`Dev tools (not shipped): ${dev.length}`);
for (const [l, n] of count(dev)) console.log(`  ${String(n).padStart(3)}  ${l}`);
console.log(`Runtime components: ${RUNTIME.length}`);
if (explained.length) console.log(`\nAllowed with an explained exception:\n  ${explained.join("\n  ")}`);

/* ───────── notices ───────── */

if (WRITE) {
  const shipped = prod.filter((e) => !EXCEPTIONS.some((x) => x.match.test(e.name)));
  const sorted = [...shipped].sort((a, b) => a.name.localeCompare(b.name));
  const md: string[] = [
    "# Third-party notices",
    "",
    "Prodintro.com is built on open-source software. Every component below is open source and its licence allows commercial use. This file is generated by `npm run licenses` from the installed packages; `npm run check:licenses` fails the build if a dependency's licence isn't.",
    "",
    "## Licence conditions that apply",
    "",
    ...Object.entries(CONDITIONAL).map(([l, w]) => `- **${l}**: ${w}`),
    "- **Apache-2.0**: keep the licence and any NOTICE (reproduced below).",
    "- **MIT / ISC / BSD / 0BSD / Unlicense**: keep the copyright and licence notice (reproduced below).",
    "",
    "## Loaded at runtime or installed separately",
    "",
    "| Component | Licence | Notes |",
    "|---|---|---|",
    ...RUNTIME.map((e) => `| [${e.name}](${e.homepage}) ${e.version} | ${e.licence} | ${e.note ?? ""} |`),
    "",
    "## Images and media served by the app",
    "",
    "| File | Licence | Source |",
    "|---|---|---|",
    ...ASSETS.map((a) => `| ${a.path} | ${a.licence} | ${a.source} |`),
    "",
    "## Not shipped",
    "",
    ...EXCEPTIONS.map((x) => `- \`${x.match.source.replace(/\\\//g, "/").replace(/^\^/, "")}*\`: ${x.why}`),
    `- ${dev.length} development tools (TypeScript, tsx, type definitions and their dependencies): used to build and test, not part of the app.`,
    "",
    "## Packages",
    "",
    "| Package | Version | Licence |",
    "|---|---|---|",
    ...sorted.map((e) => `| ${e.homepage ? `[${e.name}](${e.homepage})` : e.name} | ${e.version} | ${e.licence}${e.optional && !e.installed ? " (platform binary)" : ""} |`),
    "",
    "## Licence texts",
    "",
  ];
  for (const e of sorted) {
    if (!e.text && !e.notice && !e.note) continue;
    md.push(`### ${e.name} ${e.version} (${e.licence})`, "");
    if (e.note) md.push(e.note, "");
    if (e.notice) md.push("NOTICE:", "", "```", e.notice, "```", "");
    if (e.text) md.push("```", e.text, "```", "");
  }
  writeFileSync(join(ROOT, "THIRD_PARTY_NOTICES.md"), md.join("\n") + "\n");
  const data = {
    runtime: RUNTIME.map(({ name, version, licence, homepage, note }) => ({ name, version, licence, homepage, note })),
    packages: sorted.map(({ name, version, licence, homepage, note, text, notice }) => ({ name, version, licence, homepage, note, text, notice })),
    conditions: CONDITIONAL,
    assets: ASSETS,
  };
  mkdirSync(join(ROOT, "src/app/licenses"), { recursive: true });
  writeFileSync(join(ROOT, "src/app/licenses/notices.json"), JSON.stringify(data));
  console.log(`\nWrote THIRD_PARTY_NOTICES.md and src/app/licenses/notices.json (${sorted.length} packages).`);
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} licence problem(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("\n✓ Every dependency is open source and allows commercial use.");
