import type { SkillId } from "./types";

/**
 * Product moments (notifications, a command palette, a board, a chat…) filled from the video's own
 * material: the product's features ("Title — detail" where the site or prompt gives a detail) and
 * its how-it-works steps. The categories' stock copy in concepts.ts is only a last resort, for a
 * product that names too few features to fill the moment.
 */
export interface MomentSource {
  /** The product's name ("Your product" or empty when it has none). */
  name: string;
  /** Its features, preferring ones the video hasn't shown yet: "Title" or "Title — detail". */
  features: string[];
  /** Its how-it-works steps, if any. */
  steps?: string[];
}

export interface OwnMoment {
  title?: string;
  /** The moment's subtext (a button, columns, a comment, a card or a file name), when it has one of its own. */
  action?: string;
  items: string[];
}

const DASH = /\s+[—–]\s+/;
const titleOf = (x: string) => x.split(DASH)[0].replace(/\*/g, "").trim();
const detailOf = (x: string) => x.split(DASH).slice(1).join(" — ").replace(/\*/g, "").trim();
const words = (x: string) => x.split(/\s+/).filter(Boolean).length;
const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Lower-case a title's first letter for mid-sentence use, leaving acronyms and names ("AI", "iOS") alone. */
const mid = (x: string) => (/^[A-Z][a-z]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x);
/** A one-line detail without a trailing full stop, short enough for a notification or a message. */
const line = (x: string, max = 12) => {
  const w = x.replace(/[.!]+$/, "").split(/\s+/);
  return w.length <= max ? w.join(" ") : "";
};

/** Distinct features (by title), at most `maxWords` words in the title. */
function pick(src: MomentSource, maxWords: number) {
  const seen = new Set<string>();
  return src.features.filter((f) => {
    const t = titleOf(f);
    const k = norm(t);
    if (!t || words(t) > maxWords || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Notification details for features the site gives none for: plain status lines, no claims. */
const STATUS = ["Ready to view", "Updated just now", "Ready when you are", "Done"];

/**
 * The moment's content from the product's own features and steps, or null when it has too few
 * (the caller then keeps the moment's category copy). `fallback` is the moment as the category
 * stages it, whose framing (a sales or hiring board's columns, a file's name) is kept where the
 * product's features can't stand in for it.
 */
export function ownMoment(skill: SkillId, src: MomentSource, fallback?: { title?: string; action?: string; items?: string[] }): OwnMoment | null {
  const named = !!src.name && src.name !== "Your product";
  const name = src.name;
  const feats = pick(src, 6);
  const short = pick(src, 4);
  const titles = (xs: string[]) => xs.map(titleOf);
  const steps = (src.steps ?? []).map(titleOf).filter((s) => s && words(s) <= 4);
  switch (skill) {
    case "notify-stack": {
      if (feats.length < 2) return null;
      // Each feature arrives as a notification: its title, then the site's own line about it.
      const items = feats.slice(0, 4).map((f, i) => `${titleOf(f)} — ${line(detailOf(f)) || STATUS[i % STATUS.length]}`);
      return { title: named ? `${name}, *live*` : "Updates, *as they happen*", items };
    }
    case "command-k": {
      if (feats.length < 2) return null;
      return { title: named ? `${name}, one *keystroke* away` : undefined, items: titles(feats).slice(0, 4) };
    }
    case "click-flow": {
      const own = feats.length >= 2 ? titles(feats) : steps.length >= 2 ? steps : null;
      if (!own) return null;
      return { title: named ? `${name}, *in action*` : "Your work, *in motion*", action: "Run", items: own.slice(0, 4) };
    }
    case "kanban": {
      if (short.length < 3) return null;
      // A sales or hiring pipeline keeps its stages and cards (deals, roles): features aren't deals.
      const columns = fallback?.action ?? "To do / In progress / Done";
      if (!/^to do \//i.test(columns)) return null;
      // The product's own steps make the columns when it has three short ones.
      const own = steps.length >= 3 ? steps.slice(0, 3).join(" / ") : columns;
      return { title: named ? `${name}, *in motion*` : undefined, action: own, items: titles(short).slice(0, 4) };
    }
    case "live-cursors":
    case "table-fill":
    case "toggle-list":
    case "changelog": {
      const own = pick(src, skill === "table-fill" || skill === "live-cursors" ? 4 : 5);
      if (own.length < 3) return null;
      return { items: titles(own).slice(0, skill === "table-fill" || skill === "changelog" ? 5 : 4) };
    }
    case "calendar-drop": {
      if (short.length < 3) return null;
      // The week's events are about the product's own features ("Lead scoring review").
      const events = [(t: string) => `${t} review`, (t: string) => `Plan ${mid(t)}`, (t: string) => `${t} check-in`, (t: string) => `${t} demo`, (t: string) => `${t} sync`];
      return { title: named ? `Your week with *${name}*` : undefined, items: titles(short).slice(0, 5).map((t, i) => events[i % events.length](t)) };
    }
    case "inbox-sweep": {
      if (short.length < 3) return null;
      // Subject lines about the product's own features.
      const subjects = [(t: string) => `Your ${mid(t)} update`, (t: string) => `${t}: what's new`, (t: string) => `Getting started with ${mid(t)}`, (t: string) => `Tips for ${mid(t)}`];
      return { items: titles(short).slice(0, 4).map((t, i) => subjects[i % subjects.length](t)) };
    }
    case "chat-thread": {
      if (!named || feats.length < 2) return null;
      const [a, b] = feats;
      const answer = line(detailOf(a), 14);
      return {
        action: `${titleOf(b)} — ${line(detailOf(b), 8) || "Ready"}`,
        items: [`Can ${name} help with ${mid(titleOf(a))}?`, answer ? `Yes: ${mid(answer)}` : `Yes, ${mid(titleOf(a))} is part of ${name}`, "Perfect, thank you!"],
      };
    }
    case "comment-pins": {
      if (short.length < 2) return null;
      const [a, b, c] = titles(short);
      return { items: [`${a} looks great here`, `Can we show ${mid(b)} next?`, ...(c ? [`Love the ${mid(c)}`] : [])] };
    }
    case "keycaps": {
      if (short.length < 2) return null;
      const keys = ["⌘ K", "C", "⌘ ↵"];
      return { items: titles(short).slice(0, 3).map((t, i) => `${keys[i]} — ${t}`) };
    }
    case "phone-tour": {
      if (short.length < 3) return null;
      const first = feats[0];
      return { action: named ? `${name} — ${line(detailOf(first), 8) || titleOf(first)}` : undefined, items: titles(short).slice(0, 3) };
    }
    case "drop-zone": {
      if (short.length < 2) return null;
      // A neutral file name (not a stock document the product may not take), of the moment's type.
      const ext = fallback?.action?.match(/\.[a-z0-9]+$/i)?.[0] ?? ".pdf";
      return { action: `your-file${ext}`, items: titles(short).slice(0, 3) };
    }
    case "code-deploy": {
      // A pipeline's steps: the product's own when it has a short how-it-works.
      if (steps.length < 3) return null;
      return { items: steps.slice(0, 4) };
    }
    default:
      return null;
  }
}
