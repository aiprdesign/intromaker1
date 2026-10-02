"use client";

import { BRAND_STYLES, MOVIE_STYLES, type TrailerStyle } from "@/engine/trailers";
import LoopCanvas from "./LoopCanvas";

/**
 * Gallery of trailer styles: movie trailers by genre first (they preview as the genre's title
 * card), then the brand and launch trailers. Each previews live in its own palette, type and
 * effect; picking one restyles the film instantly.
 */
export default function TrailerStylePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const grid = (styles: TrailerStyle[], offset: number) => (
    <div className="template-grid">
      {styles.map((s, i) => (
        <button key={s.id} className={`template-card ${value === s.id ? "active" : ""}`} onClick={() => onChange(s.id)} title={s.description}>
          <LoopCanvas
            scene={{ skill: s.movie ? "intertitle" : s.mood.title[0], text: s.preview ?? "LAUNCH DAY", duration: 4.6, transition: "cut" }}
            plan={{ palette: s.mood.palette, font: s.mood.font, seed: 500 + offset + i, style: "trailer", bpm: s.mood.bpm, trailerStyle: s.id }}
            long={320}
            fps={15}
          />
          <span className="template-name">{s.name}</span>
        </button>
      ))}
    </div>
  );
  return (
    <>
      <p className="field-label">Movie trailers</p>
      {grid(MOVIE_STYLES, 0)}
      <p className="field-label">Brand & launch trailers</p>
      {grid(BRAND_STYLES, 100)}
    </>
  );
}
