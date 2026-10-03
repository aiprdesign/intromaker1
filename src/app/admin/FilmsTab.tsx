"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LoopCanvas from "@/components/LoopCanvas";
import { encodePlan, sanitizePlan } from "@/engine/planner";
import { SKILL_MAP } from "@/engine/skills";
import type { SkillId, VideoPlan } from "@/engine/types";
import { sceneThumb, thumbsReady } from "@/lib/thumbs";
import { api, Kpi, Skeleton, useAdminUi, When } from "./ui";

type Entry = {
  id: string;
  at: number;
  kind: "generated" | "remake" | "take" | "exported";
  visitor: string;
  source: "prompt" | "site";
  prompt?: string;
  url?: string;
  title: string;
  engine: string;
  aspect: string;
  seconds: number;
  scenes: number;
  skills: string[];
  template?: string;
  preset?: string;
};
type Stats = {
  total: number;
  today: number;
  week: number;
  visitors: number;
  exported: number;
  fromSites: number;
  engines: [string, number][];
  skills: [string, number][];
  perDay: { day: string; films: number }[];
};
type List = { items: Entry[]; total: number; page: number; size: number; stats: Stats; aiToday: number; aiBudget: number };

const KIND_LABEL: Record<Entry["kind"], string> = { generated: "New film", remake: "Remake", take: "Alternative take", exported: "Exported" };
const engineLabel = (e: Entry) => (e.engine === "builtin" ? "Built-in" : e.engine === "export" ? e.preset || "Export" : "AI");

export default function FilmsTab() {
  const { notify, confirm } = useAdminUi();
  const [data, setData] = useState<List | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [visitor, setVisitor] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, VideoPlan | null>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [refreshed, setRefreshed] = useState(0);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page) });
    if (q.trim()) qs.set("q", q.trim());
    if (kind) qs.set("kind", kind);
    if (visitor) qs.set("visitor", visitor);
    try {
      setData(await api<List>(`/api/admin/films?${qs}`));
      setError(null);
      setRefreshed(Date.now());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q, kind, visitor, page]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  // New films show up while the tab is open.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Each film's storyboard (one at a time) and a thumbnail of its middle slide.
  useEffect(() => {
    if (!data) return;
    let alive = true;
    (async () => {
      await thumbsReady();
      for (const e of data.items) {
        if (!alive) return;
        if (plans[e.id] !== undefined) continue;
        try {
          const f = await api<{ plan: VideoPlan | null }>(`/api/admin/films/${e.id}`);
          const plan = f.plan ? sanitizePlan(f.plan) : null;
          if (!alive) return;
          setPlans((p) => ({ ...p, [e.id]: plan }));
          if (plan?.scenes.length) setThumbs((t) => ({ ...t, [e.id]: sceneThumb(plan.scenes[Math.floor(plan.scenes.length / 2)], plan) }));
        } catch {
          setPlans((p) => ({ ...p, [e.id]: null }));
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const removeOne = async (e: Entry) => {
    if (!(await confirm({ title: "Delete this film from the log?", body: `“${e.title}”, ${new Date(e.at).toLocaleString()}. The visitor keeps their own copy.`, confirm: "Delete", danger: true }))) return;
    await api("/api/admin/films", { method: "DELETE", body: JSON.stringify({ ids: [e.id] }) });
    setOpen(null);
    notify("Film deleted");
    void load();
  };
  const removeAll = async () => {
    if (!data) return;
    const ok = await confirm({
      title: `Delete the ${data.stats.total} logged films?`,
      body: "The whole film log and its storyboards are removed. Visitors' own films and accounts are not affected. This can't be undone.",
      confirm: "Delete the film log",
      danger: true,
      typed: "DELETE",
    });
    if (!ok) return;
    const r = await api<{ deleted: number }>("/api/admin/films", { method: "DELETE", body: JSON.stringify({ all: true }) });
    notify(`Deleted ${r.deleted} films`);
    void load();
  };
  const filtered = !!(q.trim() || kind || visitor);
  const clear = () => {
    setQ("");
    setKind("");
    setVisitor("");
    setPage(0);
  };

  const s = data?.stats;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const items = data?.items ?? [];
  const index = items.findIndex((e) => e.id === open);
  return (
    <>
      {error && <p className="error">{error}</p>}
      {s ? (
        <>
          <section className="admin-kpis">
            <Kpi label="Films" value={s.total} hint="Film events logged (new, remakes, takes, exports)" />
            <Kpi label="Today" value={s.today} />
            <Kpi label="Last 7 days" value={s.week} />
            <Kpi label="Visitors" value={s.visitors} hint="Different visitors (anonymous)" />
            <Kpi label="Exports" value={s.exported} />
            <Kpi label="AI films today" value={`${data!.aiToday} / ${data!.aiBudget}`} hint="Paid by the site's AI key, against the daily budget" meter={data!.aiBudget ? data!.aiToday / data!.aiBudget : 0} />
          </section>
          <section className="admin-insights">
            <Chart days={s.perDay} />
            <div className="admin-card tops">
              <span className="fld-cap">Most used slides</span>
              <div className="chips">
                {s.skills.length ? (
                  s.skills.map(([k, n]) => (
                    <button key={k} className="chip" onClick={() => (setQ(k), setPage(0))} title="Show films with this slide">
                      {SKILL_MAP[k as SkillId]?.name ?? k} · {n}
                    </button>
                  ))
                ) : (
                  <span className="hint">None yet</span>
                )}
              </div>
              <span className="fld-cap">Directors</span>
              <div className="chips">
                {s.engines.map(([k, n]) => (
                  <span key={k} className="chip static">
                    {k} · {n}
                  </span>
                ))}
              </div>
              <span className="hint">
                {s.fromSites} from websites · {s.total - s.fromSites} from prompts
              </span>
            </div>
          </section>
        </>
      ) : (
        !error && <Skeleton rows={1} />
      )}

      <section className="admin-filters">
        <span className="search-box">
          <input className="input" placeholder="Search prompts, websites, titles, slides…" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} aria-label="Search films" />
          {q && (
            <button className="clear" onClick={() => setQ("")} aria-label="Clear search">
              ×
            </button>
          )}
        </span>
        <select className="select" value={kind} onChange={(e) => (setKind(e.target.value), setPage(0))} aria-label="Event">
          <option value="">Any event</option>
          {Object.entries(KIND_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {visitor && (
          <button className="chip active" onClick={() => setVisitor("")} title="Clear the visitor filter">
            Visitor {visitor} ×
          </button>
        )}
        {filtered && (
          <button className="link-btn" onClick={clear}>
            Clear filters
          </button>
        )}
        <span className="spacer" />
        <span className="hint">
          {data ? `${data.total} film${data.total === 1 ? "" : "s"}` : ""}
          {refreshed ? ` · updated ${new Date(refreshed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
        <button className="btn btn-ghost sm" onClick={() => void load()} title="Refresh">
          ↻ Refresh
        </button>
      </section>

      {!data && !error && <Skeleton rows={6} kind="card" />}
      {data && !items.length && (
        <div className="admin-card empty">
          <p>{filtered ? "No films match these filters." : "No films yet."}</p>
          <p className="hint">
            {filtered ? (
              <button className="link-btn" onClick={clear}>
                Clear filters
              </button>
            ) : (
              "Films made in the studio (new films, remakes, alternative takes) and exports show up here."
            )}
          </p>
        </div>
      )}
      <section className="admin-grid">
        {items.map((e) => (
          <article key={e.id} className="film-card">
            <button className={`film-thumb${e.aspect === "9:16" ? " tall" : ""}`} onClick={() => setOpen(e.id)} aria-label={`Preview ${e.title}`}>
              {thumbs[e.id] ? <img src={thumbs[e.id]} alt="" /> : <span className="skeleton thumb" />}
            </button>
            <div className="film-meta">
              <button className="film-title" onClick={() => setOpen(e.id)}>
                {e.title}
              </button>
              <span className="film-src" title={e.url ?? e.prompt}>
                {e.url ? e.url.replace(/^https?:\/\//, "") : e.prompt || "—"}
              </span>
              <span className="film-tags">
                <span className={`tag ${e.kind}`}>{KIND_LABEL[e.kind]}</span>
                <span className="tag">{engineLabel(e)}</span>
                <span className="tag">
                  {e.aspect} · {e.seconds}s · {e.scenes} slides
                </span>
              </span>
              <span className="film-when">
                <When t={e.at} /> ·{" "}
                <button className="visitor" onClick={() => (setVisitor(e.visitor), setPage(0))} title="Show this visitor's films">
                  visitor {e.visitor}
                </button>
              </span>
            </div>
          </article>
        ))}
      </section>
      {pages > 1 && (
        <nav className="admin-pages">
          <button className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ← Newer
          </button>
          <span className="hint">
            Page {page + 1} of {pages}
          </span>
          <button className="btn btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            Older →
          </button>
        </nav>
      )}

      {!!data?.stats.total && (
        <details className="admin-danger">
          <summary>Danger zone</summary>
          <p className="hint">Remove the whole film log. Visitors&apos; accounts and saved intros are not affected.</p>
          <button className="btn btn-danger sm" onClick={removeAll}>
            Delete the {data.stats.total} films…
          </button>
        </details>
      )}

      {index >= 0 && (
        <FilmDetail
          entry={items[index]}
          plan={plans[items[index].id]}
          onClose={() => setOpen(null)}
          onDelete={() => removeOne(items[index])}
          onPrev={index > 0 ? () => setOpen(items[index - 1].id) : undefined}
          onNext={index < items.length - 1 ? () => setOpen(items[index + 1].id) : undefined}
        />
      )}
    </>
  );
}

/** Films per day with a scale, date labels and the count on hover. */
function Chart({ days }: { days: { day: string; films: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.films));
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return (
    <div className="admin-card chart">
      <span className="fld-cap">
        Films per day <em>last 14 days · peak {max}</em>
      </span>
      <div className="bars" role="img" aria-label={days.map((d) => `${fmt(d.day)}: ${d.films}`).join(", ")}>
        {days.map((d) => (
          <div key={d.day} className={`bar${d.films ? "" : " zero"}`} title={`${fmt(d.day)}: ${d.films} film${d.films === 1 ? "" : "s"}`}>
            {d.films > 0 && <em>{d.films}</em>}
            <span style={{ height: d.films ? `${Math.max(6, (d.films / max) * 100)}%` : undefined }} />
          </div>
        ))}
      </div>
      <div className="bar-axis">
        <span>{fmt(days[0].day)}</span>
        <span>{fmt(days[Math.floor(days.length / 2)].day)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function FilmDetail({
  entry,
  plan,
  onClose,
  onDelete,
  onPrev,
  onNext,
}: {
  entry: Entry;
  plan: VideoPlan | null | undefined;
  onClose: () => void;
  onDelete: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector(".admin-confirm")) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, onPrev, onNext]);
  const studioLink = useMemo(() => (plan ? `/studio#plan=${encodePlan(plan)}` : null), [plan]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal admin-detail" role="dialog" aria-label={entry.title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{entry.title}</h2>
          <div className="admin-detail-nav">
            <button className="icon-btn" onClick={onPrev} disabled={!onPrev} aria-label="Newer film" title="Newer (←)">
              ←
            </button>
            <button className="icon-btn" onClick={onNext} disabled={!onNext} aria-label="Older film" title="Older (→)">
              →
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="Close" title="Close (Esc)">
              ✕
            </button>
          </div>
        </header>
        <div className={`admin-preview${entry.aspect === "9:16" ? " tall" : ""}`}>
          {plan ? <LoopCanvas key={entry.id} plan={plan} long={720} fps={30} /> : <p className="hint">{plan === null ? "Storyboard not available." : "Loading…"}</p>}
        </div>
        <dl className="admin-facts">
          <dt>{entry.url ? "Website" : "Prompt"}</dt>
          <dd>
            {entry.url ? (
              <a href={entry.url} target="_blank" rel="noopener noreferrer nofollow">
                {entry.url}
              </a>
            ) : (
              entry.prompt || "—"
            )}
          </dd>
          <dt>Event</dt>
          <dd>
            {KIND_LABEL[entry.kind]}
            {entry.preset ? ` · ${entry.preset}` : ""} · {new Date(entry.at).toLocaleString()}
          </dd>
          <dt>Director</dt>
          <dd>{entry.engine === "builtin" ? "Built-in director" : entry.engine}</dd>
          <dt>Film</dt>
          <dd>
            {entry.aspect} · {entry.seconds}s · {entry.scenes} slides{entry.template ? ` · style ${entry.template}` : ""}
          </dd>
          <dt>Visitor</dt>
          <dd>{entry.visitor} (anonymous)</dd>
        </dl>
        {plan && (
          <ol className="admin-scenes">
            {plan.scenes.map((s, i) => (
              <li key={i}>
                <span className="tag">{SKILL_MAP[s.skill]?.name ?? s.skill}</span> {s.text.replace(/\*/g, "")}
                {s.items?.length ? <small> — {s.items.join(", ")}</small> : null}
              </li>
            ))}
          </ol>
        )}
        <footer>
          {studioLink && (
            <a className="btn btn-primary" href={studioLink} target="_blank" rel="noopener">
              Open in studio ↗
            </a>
          )}
          <button className="btn btn-ghost danger" onClick={onDelete}>
            Delete
          </button>
        </footer>
      </div>
    </div>
  );
}
