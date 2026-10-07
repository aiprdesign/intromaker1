"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CharacterDesigner, { loadCast, newCharacter, saveCast } from "@/components/CharacterDesigner";
import type { CastMember } from "@/engine/types";

/**
 * The designer on its own page. The cast is kept in this browser, the same one the studio uses,
 * so the characters made here star in the next video's abstract character slides.
 */
export default function CharacterLab() {
  const router = useRouter();
  const [cast, setCast] = useState<CastMember[] | null>(null);
  const [about, setAbout] = useState("");
  useEffect(() => {
    const saved = loadCast();
    // A first visit starts with one character to play with (kept once it's changed).
    setCast(saved.length ? saved : [newCharacter()]);
  }, []);
  const change = (c: CastMember[]) => {
    setCast(c);
    saveCast(c);
  };
  const start = (e: React.FormEvent) => {
    e.preventDefault();
    if (cast?.length) saveCast(cast);
    try {
      localStorage.setItem("intromaker.cast.use", "on");
    } catch {
      /* ignore */
    }
    const text = about.trim() || "a friendly new app";
    router.push(`/studio?prompt=${encodeURIComponent(`A video with abstract characters for ${text}`)}`);
  };
  if (!cast) return <div className="char-lab" aria-busy="true" />;
  return (
    <div className="char-lab">
      <div className="char-card char-lab-panel">
        <CharacterDesigner cast={cast} onChange={change} />
      </div>
      <form className="char-card char-lab-cta" onSubmit={start}>
        <label className="field-label" htmlFor="char-about">
          Make a video with them
        </label>
        <div className="char-lab-row">
          <input id="char-about" className="input" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What's your video about? e.g. Loop, a planner for busy teams" maxLength={200} />
          <button type="submit" className="btn btn-primary" disabled={!cast.length}>
            Make the video
          </button>
        </div>
        <p className="hint">Your characters are kept in this browser. The studio casts them first in the abstract character slides; change them any time under Style → Characters.</p>
      </form>
    </div>
  );
}
