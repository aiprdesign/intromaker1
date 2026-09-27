"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Nav";
import Player from "@/components/Player";
import { EXAMPLE_PROMPTS, HERO_PLAN } from "@/engine/demos";
import { PALETTES } from "@/engine/palettes";
import { assetUrl, extractBrandColors } from "@/engine/media";
import { decodePlan, encodePlan, planFromPrompt, planFromSite, sanitizePlan, type Length, type StyleChoice } from "@/engine/planner";
import { SKILL_MAP, SKILLS } from "@/engine/skills";
import { PALETTE_IDS, TRANSITIONS, type Aspect, type Brand, type PaletteId, type Scene, type SiteData, type SkillId, type VideoPlan } from "@/engine/types";

type Engine = "claude" | "builtin" | "manual";

export default function Studio() {
  const params = useSearchParams();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [length, setLength] = useState<Length>("standard");
  const [palette, setPalette] = useState<PaletteId | "auto">("auto");
  const [plan, setPlan] = useState<VideoPlan>(HERO_PLAN);
  const [engine, setEngine] = useState<Engine>("manual");
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [version, setVersion] = useState(0);
  const [style, setStyle] = useState<StyleChoice>("auto");
  const [siteUrl, setSiteUrl] = useState("");
  const [site, setSite] = useState<SiteData | null>(null);
  const [brandColors, setBrandColors] = useState<Brand["colors"]>(undefined);
  const [useBrandColors, setUseBrandColors] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    fetch("/api/generate")
      .then((r) => r.json())
      .then((d) => setAiAvailable(Boolean(d.ai)))
      .catch(() => setAiAvailable(false));
  }, []);

  const generate = async (
    opts: {
      prompt?: string;
      seed?: number;
      aspect?: Aspect;
      palette?: PaletteId | "auto";
      site?: SiteData | null;
      colors?: Brand["colors"];
    } = {},
  ) => {
    const s = opts.site !== undefined ? opts.site : site;
    const colors = opts.colors !== undefined ? opts.colors : useBrandColors ? brandColors : undefined;
    const p = (opts.prompt ?? prompt).trim() || (s ? "" : EXAMPLE_PROMPTS[0]);
    const a = opts.aspect ?? aspect;
    const pal = opts.palette ?? palette;
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, aspect: a, length, palette: pal, seed: opts.seed, site: s, colors, style }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlan(sanitizePlan(data.plan));
      setVersion((v) => v + 1);
      setEngine(data.engine);
      if (data.note) setNote(data.note);
    } catch {
      // Offline or API unavailable: the director also runs in the browser.
      setPlan(
        s
          ? planFromSite(s, { aspect: a, length, palette: pal, seed: opts.seed, colors, style })
          : planFromPrompt({ prompt: p, aspect: a, length, palette: pal, seed: opts.seed, style }),
      );
      setVersion((v) => v + 1);
      setEngine("builtin");
    } finally {
      setLoading(false);
    }
  };

  /** Scrape a website, pull its brand colours, then storyboard an intro from it. */
  const importSite = async (raw?: string) => {
    const url = (raw ?? siteUrl).trim();
    if (!url) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const s: SiteData = data.site;
      setSite(s);
      setSiteUrl(s.url);
      const colorSources = [s.logo, ...s.images.slice(0, 2)].filter(Boolean).map((u) => assetUrl(u as string));
      const colors = (await extractBrandColors(colorSources, s.themeColor)) ?? undefined;
      setBrandColors(colors);
      await generate({ site: s, colors: useBrandColors ? colors : undefined });
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const clearSite = () => {
    setSite(null);
    setBrandColors(undefined);
    setImportError(null);
  };

  // Boot from URL: #plan=… (shared link), ?url=… (website), ?prompt=…, or ?skill=… from the showcase.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const shared = hash.startsWith("#plan=") ? decodePlan(hash.slice(6)) : null;
    if (shared) {
      setPlan(shared);
      setAspect(shared.aspect);
      setEngine("manual");
      return;
    }
    const pal = params.get("palette") as PaletteId | null;
    if (pal && (PALETTE_IDS as readonly string[]).includes(pal)) setPalette(pal);
    const skill = params.get("skill") as SkillId | null;
    if (skill && SKILL_MAP[skill]) {
      const s = SKILL_MAP[skill];
      setPlan(
        sanitizePlan({
          title: s.name,
          palette: pal ?? "cyber",
          font: "anton",
          aspect: "16:9",
          bpm: 124,
          seed: 7,
          scenes: [{ skill, text: s.sample.text, subtext: s.sample.subtext, duration: 4.5, transition: "cut" }],
        }),
      );
      return;
    }
    const web = params.get("url");
    if (web) {
      setSiteUrl(web);
      importSite(web);
      return;
    }
    const q = params.get("prompt");
    if (q) {
      setPrompt(q);
      generate({ prompt: q, palette: pal ?? "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateScene = (i: number, patch: Partial<Scene>) => {
    // Not sanitised: an empty headline mid-typing must stay empty.
    if (patch.duration !== undefined) patch.duration = Math.min(8, Math.max(1.6, patch.duration || 1.6));
    setPlan((p) => ({ ...p, scenes: p.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
    setEngine("manual");
  };
  const moveScene = (i: number, dir: -1 | 1) => {
    setPlan((p) => {
      const scenes = [...p.scenes];
      const j = i + dir;
      if (j < 0 || j >= scenes.length) return p;
      [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
      return { ...p, scenes };
    });
  };
  const removeScene = (i: number) =>
    setPlan((p) => (p.scenes.length > 1 ? { ...p, scenes: p.scenes.filter((_, j) => j !== i) } : p));
  const addScene = () =>
    setPlan((p) =>
      sanitizePlan({
        ...p,
        scenes: [...p.scenes, { skill: "kinetic-slam", text: "NEW SCENE", duration: 2.8, transition: "flash" }],
      }),
    );

  const share = async () => {
    const url = `${window.location.origin}/studio#plan=${encodePlan(plan)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const setGlobal = (patch: Partial<VideoPlan>) => setPlan((p) => sanitizePlan({ ...p, ...patch }));

  return (
    <div className="studio">
      <header className="studio-bar">
        <Logo />
        <span className="studio-title">{plan.title}</span>
        <span className={`engine-badge ${engine}`}>
          {engine === "claude" ? "✦ Directed by Claude" : engine === "builtin" ? "Built-in director" : "Manual edit"}
        </span>
        <button className="btn btn-ghost" onClick={share}>
          {copied ? "Link copied ✓" : "Share link"}
        </button>
      </header>

      <div className="studio-body">
        <aside className="panel">
          <h2>From a website</h2>
          <form
            className="url-row"
            onSubmit={(e) => {
              e.preventDefault();
              importSite();
            }}
          >
            <input
              className="input"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="yourproduct.com"
              aria-label="Website URL"
              inputMode="url"
            />
            <button className="btn btn-ghost" type="submit" disabled={importing || loading}>
              {importing ? "Importing…" : "Import"}
            </button>
          </form>
          {importError && <p className="hint warn">{importError}</p>}
          {site && (
            <div className="site-card">
              <div className="site-head">
                {site.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(site.logo)} alt="" className="site-logo" />
                ) : (
                  <span className="site-logo placeholder">{site.name.slice(0, 1)}</span>
                )}
                <div className="site-meta">
                  <strong>{site.name}</strong>
                  <span>{site.domain}</span>
                </div>
                <button className="icon-btn sm" onClick={clearSite} aria-label="Remove website">
                  ✕
                </button>
              </div>
              {site.tagline && <p className="site-tagline">{site.tagline}</p>}
              {site.images.length > 0 && (
                <div className="site-thumbs">
                  {site.images.slice(0, 8).map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={assetUrl(src)} alt="" loading="lazy" />
                  ))}
                </div>
              )}
              <div className="site-stats">
                <span>{site.images.length} images</span>
                <span>{site.videos.length} videos</span>
                <span>{site.headlines.length} headlines</span>
                <span>{site.stats.length} stats</span>
              </div>
              {brandColors && (
                <label className="brand-colors">
                  <input
                    type="checkbox"
                    checked={useBrandColors}
                    onChange={(e) => {
                      setUseBrandColors(e.target.checked);
                      setPlan((p) =>
                        p.brand ? { ...p, brand: { ...p.brand, colors: e.target.checked ? brandColors : undefined } } : p,
                      );
                    }}
                  />
                  <span className="swatch lg" style={{ background: brandColors.primary }} />
                  <span className="swatch lg" style={{ background: brandColors.secondary }} />
                  Use brand colours
                </label>
              )}
            </div>
          )}

          <h2 className="mt">{site ? "Extra direction (optional)" : "Prompt"}</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={site ? "e.g. focus on speed, end with 'Start free trial'" : "Describe your video: brand, vibe, claims, numbers…"}
            rows={5}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
            }}
          />
          <div className="examples compact">
            {EXAMPLE_PROMPTS.map((p) => (
              <button key={p} className="chip" onClick={() => setPrompt(p)} title={p}>
                {p.length > 38 ? `${p.slice(0, 36)}…` : p}
              </button>
            ))}
          </div>

          <label className="field-label">Format</label>
          <div className="seg-control">
            {(["16:9", "9:16", "1:1"] as Aspect[]).map((a) => (
              <button
                key={a}
                className={aspect === a ? "active" : ""}
                onClick={() => {
                  setAspect(a);
                  setGlobal({ aspect: a });
                }}
              >
                {a === "16:9" ? "Landscape" : a === "9:16" ? "Vertical" : "Square"}
              </button>
            ))}
          </div>

          <label className="field-label">Style</label>
          <div className="seg-control">
            {(
              [
                ["auto", "Auto"],
                ["saas", "SaaS launch"],
                ["trailer", "Epic trailer"],
              ] as [StyleChoice, string][]
            ).map(([id, label]) => (
              <button key={id} className={style === id ? "active" : ""} onClick={() => setStyle(id)}>
                {label}
              </button>
            ))}
          </div>

          <label className="field-label">Length</label>
          <div className="seg-control">
            {(["short", "standard", "long"] as Length[]).map((l) => (
              <button key={l} className={length === l ? "active" : ""} onClick={() => setLength(l)}>
                {l === "short" ? "~10s" : l === "standard" ? "~16s" : "~26s"}
              </button>
            ))}
          </div>

          <label className="field-label">Palette</label>
          <div className="swatches">
            <button className={`swatch-btn auto ${palette === "auto" ? "active" : ""}`} onClick={() => setPalette("auto")} title="Auto">
              Auto
            </button>
            {PALETTE_IDS.map((id) => (
              <button
                key={id}
                className={`swatch-btn ${palette === id ? "active" : ""}`}
                title={PALETTES[id].name}
                style={{ background: `linear-gradient(135deg, ${PALETTES[id].primary}, ${PALETTES[id].secondary})` }}
                onClick={() => {
                  setPalette(id);
                  setGlobal({ palette: id });
                }}
              />
            ))}
          </div>

          <div className="gen-row">
            <button className="btn btn-primary btn-lg grow" onClick={() => generate()} disabled={loading}>
              {loading ? "Directing…" : "Generate ✦"}
            </button>
            <button
              className="btn btn-ghost btn-lg"
              onClick={() => generate({ seed: Math.floor(Math.random() * 1e9) })}
              disabled={loading}
              title="Same prompt, new creative take"
            >
              Remix
            </button>
          </div>
          <p className="hint">
            {aiAvailable === null
              ? ""
              : aiAvailable
                ? "Claude AI Director is on."
                : "Running the built-in director. Set ANTHROPIC_API_KEY on the server to enable the Claude AI Director."}
          </p>
          {note && <p className="hint warn">{note}</p>}
        </aside>

        <section className="main">
          <div className={loading ? "dim" : ""}>
            <Player plan={plan} resetKey={version} />
          </div>

          <div className="storyboard-head">
            <h2>Storyboard</h2>
            <div className="global-opts">
              <label>
                Type
                <select className="select sm" value={plan.font} onChange={(e) => setGlobal({ font: e.target.value as VideoPlan["font"] })}>
                  <option value="anton">Impact (Anton)</option>
                  <option value="grotesk">Modern (Grotesk)</option>
                </select>
              </label>
              <label>
                Tempo
                <input
                  className="input sm"
                  type="number"
                  min={70}
                  max={160}
                  value={plan.bpm}
                  onChange={(e) => setGlobal({ bpm: Number(e.target.value) })}
                />
                bpm
              </label>
            </div>
          </div>
          <div className="storyboard">
            {plan.scenes.map((s, i) => (
              <div className="scene-card" key={i}>
                <div className="scene-top">
                  <span className="scene-n">{String(i + 1).padStart(2, "0")}</span>
                  <select className="select sm grow" value={s.skill} onChange={(e) => updateScene(i, { skill: e.target.value as SkillId })}>
                    {SKILLS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  className={`input headline ${plan.style === "saas" ? "natural" : ""}`}
                  value={s.text}
                  maxLength={200}
                  onChange={(e) => updateScene(i, { text: e.target.value })}
                  aria-label="Headline"
                  title="Wrap a word in *asterisks* for the gradient accent"
                />
                {SKILL_MAP[s.skill].itemsHint !== undefined && (
                  <input
                    className="input"
                    value={(s.items ?? []).join(", ")}
                    placeholder={SKILL_MAP[s.skill].itemsHint}
                    onChange={(e) =>
                      updateScene(i, {
                        items: e.target.value
                          .split(",")
                          .map((x) => x.trimStart())
                          .filter((x, j, arr) => x || j === arr.length - 1),
                      })
                    }
                    aria-label="List items"
                  />
                )}
                <input
                  className="input"
                  value={s.subtext ?? ""}
                  maxLength={60}
                  placeholder="Subtext (optional)"
                  onChange={(e) => updateScene(i, { subtext: e.target.value || undefined })}
                  aria-label="Subtext"
                />
                <div className="scene-row">
                  <label>
                    <input
                      className="input sm"
                      type="number"
                      step={0.1}
                      min={1.6}
                      max={8}
                      value={Number(s.duration.toFixed(2))}
                      onChange={(e) => updateScene(i, { duration: Number(e.target.value) })}
                    />
                    s
                  </label>
                  <select className="select sm" value={s.transition} onChange={(e) => updateScene(i, { transition: e.target.value as Scene["transition"] })}>
                    {TRANSITIONS.map((tr) => (
                      <option key={tr} value={tr}>
                        {tr}
                      </option>
                    ))}
                  </select>
                  <div className="scene-actions">
                    <button className="icon-btn sm" onClick={() => moveScene(i, -1)} aria-label="Move left">←</button>
                    <button className="icon-btn sm" onClick={() => moveScene(i, 1)} aria-label="Move right">→</button>
                    <button className="icon-btn sm" onClick={() => removeScene(i)} aria-label="Delete scene">✕</button>
                  </div>
                </div>
              </div>
            ))}
            <button className="scene-add" onClick={addScene}>
              + Add scene
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
