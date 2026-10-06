/**
 * The intros made in this browser, for the studio's sidebar: an index (newest first) and each
 * intro's saved state under its own key, so opening one picks up where it was left. Kept in
 * localStorage, at most MAX of them (the oldest dropped first). Signed-in accounts also list the
 * intros saved to the account (see /api/account/films).
 */
export interface LocalIntro {
  id: string;
  title: string;
  updatedAt: number;
  /** The intro's accent colour, for its icon. */
  color: string;
  aspect: string;
  /** The account copy, once saved there (so the sidebar lists it once). */
  savedId?: string;
}

const INDEX = "intromaker.intros";
const KEY = (id: string) => `intromaker.intro.${id}`;
const MAX = 30;

export function newIntroId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function listLocalIntros(): LocalIntro[] {
  try {
    const list = JSON.parse(localStorage.getItem(INDEX) ?? "[]") as LocalIntro[];
    return Array.isArray(list) ? list.filter((x) => x && typeof x.id === "string").sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

/** Save an intro's state and its index entry; returns the index (newest first). */
export function saveLocalIntro(meta: LocalIntro, film: unknown): LocalIntro[] {
  const list = [meta, ...listLocalIntros().filter((x) => x.id !== meta.id)].sort((a, b) => b.updatedAt - a.updatedAt);
  const keep = list.slice(0, MAX);
  try {
    for (const gone of list.slice(MAX)) localStorage.removeItem(KEY(gone.id));
    try {
      localStorage.setItem(KEY(meta.id), JSON.stringify(film));
    } catch {
      // Full: make room by dropping the oldest intros, then try once more.
      for (const old of keep.slice(-5)) if (old.id !== meta.id) localStorage.removeItem(KEY(old.id));
      keep.splice(-5, 5, ...keep.slice(-5).filter((x) => x.id === meta.id));
      localStorage.setItem(KEY(meta.id), JSON.stringify(film));
    }
    localStorage.setItem(INDEX, JSON.stringify(keep));
  } catch {
    /* storage blocked: the sidebar shows what it has */
  }
  return keep;
}

export function loadLocalIntro<T>(id: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(KEY(id)) ?? "null") as T | null;
  } catch {
    return null;
  }
}
