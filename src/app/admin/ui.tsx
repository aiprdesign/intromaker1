"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/* ───────────────────────── Data ───────────────────────── */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** JSON request to the admin API. A 401 means the session ended: the shell shows the sign-in. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (res.status === 204) return {} as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError((data as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
    if (res.status === 401) window.dispatchEvent(new CustomEvent("admin:expired"));
    throw err;
  }
  return data as T;
}

/** "5 min ago", "3 h ago", or the date. */
export function when(t: number) {
  const d = Date.now() - t;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.round(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** A relative time with the exact time on hover. */
export function When({ t }: { t: number }) {
  return (
    <time dateTime={new Date(t).toISOString()} title={new Date(t).toLocaleString()}>
      {when(t)}
    </time>
  );
}

/* ───────────────────────── Toasts and confirmations ───────────────────────── */

type Toast = { id: number; text: string; tone: "ok" | "error" };
type ConfirmReq = { title: string; body?: string; confirm: string; danger?: boolean; typed?: string; resolve: (ok: boolean) => void };

interface AdminUi {
  notify: (text: string, tone?: "ok" | "error") => void;
  confirm: (o: Omit<ConfirmReq, "resolve">) => Promise<boolean>;
}
const Ctx = createContext<AdminUi>({ notify: () => {}, confirm: async () => false });
export const useAdminUi = () => useContext(Ctx);

export function AdminUiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ask, setAsk] = useState<ConfirmReq | null>(null);
  const seq = useRef(0);
  const notify = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3500);
  }, []);
  const confirm = useCallback((o: Omit<ConfirmReq, "resolve">) => new Promise<boolean>((resolve) => setAsk({ ...o, resolve })), []);
  return (
    <Ctx.Provider value={{ notify, confirm }}>
      {children}
      <div className="admin-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`admin-toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
      {ask && (
        <ConfirmDialog
          req={ask}
          onDone={(ok) => {
            ask.resolve(ok);
            setAsk(null);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function ConfirmDialog({ req, onDone }: { req: ConfirmReq; onDone: (ok: boolean) => void }) {
  const [typed, setTyped] = useState("");
  const ok = !req.typed || typed.trim() === req.typed;
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!req.typed) btn.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onDone(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [req.typed, onDone]);
  return (
    <div className="modal-backdrop" onClick={() => onDone(false)}>
      <form
        className="modal admin-confirm"
        role="alertdialog"
        aria-label={req.title}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onDone(true);
        }}
      >
        <h2>{req.title}</h2>
        {req.body && <p className="hint">{req.body}</p>}
        {req.typed && (
          <label className="fld">
            <span className="fld-cap">
              Type <code>{req.typed}</code> to confirm
            </span>
            <input className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
        )}
        <div className="admin-row actions">
          <button type="button" className="btn btn-ghost" onClick={() => onDone(false)}>
            Cancel
          </button>
          <button ref={btn} className={`btn ${req.danger ? "btn-danger" : "btn-primary"}`} disabled={!ok}>
            {req.confirm}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ───────────────────────── Small pieces ───────────────────────── */

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt("Copy this", text);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

export function Kpi({ label, value, hint, meter }: { label: string; value: React.ReactNode; hint?: string; meter?: number }) {
  return (
    <div className="admin-card stat" title={hint}>
      <span className="fld-cap">{label}</span>
      <strong>{value}</strong>
      {meter !== undefined && (
        <span className="meter" aria-hidden>
          <span style={{ width: `${Math.min(100, Math.max(0, meter * 100))}%` }} />
        </span>
      )}
    </div>
  );
}

export function Skeleton({ rows = 3, kind = "row" }: { rows?: number; kind?: "row" | "card" }) {
  return (
    <div className={kind === "card" ? "admin-grid" : "admin-table"} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`skeleton ${kind}`} />
      ))}
    </div>
  );
}

/** Track whether a form differs from what was saved. */
export function useDirty<T>(value: T, saved: T | null) {
  return saved !== null && JSON.stringify(value) !== JSON.stringify(saved);
}

/** A bar that sticks to the bottom while a form has unsaved changes. */
export function SaveBar({ dirty, busy, onSave, onDiscard, label = "Save changes" }: { dirty: boolean; busy?: boolean; onSave: () => void; onDiscard: () => void; label?: string }) {
  if (!dirty) return null;
  return (
    <div className="admin-savebar" role="region" aria-label="Unsaved changes">
      <span>Unsaved changes</span>
      <button className="btn btn-ghost sm" onClick={onDiscard} disabled={busy}>
        Discard
      </button>
      <button className="btn btn-primary sm" onClick={onSave} disabled={busy}>
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}
