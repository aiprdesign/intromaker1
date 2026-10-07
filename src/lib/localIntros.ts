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
  /** Renamed by you: the title stays as given instead of following the video's name. */
  named?: boolean;
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

function writeIndex(list: LocalIntro[]) {
  try {
    localStorage.setItem(INDEX, JSON.stringify(list));
  } catch {
    /* storage blocked */
  }
  return list;
}

/** Remove an intro from this browser; returns the index. */
export function removeLocalIntro(id: string): LocalIntro[] {
  try {
    localStorage.removeItem(KEY(id));
  } catch {
    /* ignore */
  }
  return writeIndex(listLocalIntros().filter((x) => x.id !== id));
}

/** Give an intro your own title (kept as the video changes); returns the index. */
export function renameLocalIntro(id: string, title: string): LocalIntro[] {
  const name = title.trim().slice(0, 80);
  if (!name) return listLocalIntros();
  return writeIndex(listLocalIntros().map((x) => (x.id === id ? { ...x, title: name, named: true } : x)));
}

/**
 * A copy of an intro under a new id, newest in the list ("Name copy"), not linked to the account
 * copy. `film` is the state to copy when it isn't stored yet (an account intro). Returns the new
 * id and the index, or null when there's nothing to copy or no room.
 */
export function duplicateLocalIntro(source: Pick<LocalIntro, "title" | "color" | "aspect"> & { id?: string }, film?: unknown): { id: string; list: LocalIntro[] } | null {
  const state = film ?? (source.id ? loadLocalIntro<Record<string, unknown>>(source.id) : null);
  if (!state || typeof state !== "object") return null;
  const id = newIntroId();
  const copy = { ...(state as Record<string, unknown>), savedId: null, localId: id };
  const title = `${source.title.replace(/ copy( \d+)?$/, "")} copy`.slice(0, 80);
  try {
    const list = saveLocalIntro({ id, title, updatedAt: Date.now(), color: source.color, aspect: source.aspect, named: true }, copy);
    return list.some((x) => x.id === id) ? { id, list } : null;
  } catch {
    return null;
  }
}
