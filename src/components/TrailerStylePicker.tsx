"use client";

import { TRAILER_STYLES } from "@/engine/trailers";
import LoopCanvas from "./LoopCanvas";

/**
 * Gallery of trailer styles for the epic trailer cut; each previews live with its own title effect,
 * palette and type. Picking one restyles the film instantly.
 */
export default function TrailerStylePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="template-grid">
      {TRAILER_STYLES.map((s, i) => (
        <button key={s.id} className={`template-card ${value === s.id ? "active" : ""}`} onClick={() => onChange(s.id)} title={s.description}>
          <LoopCanvas
            scene={{ skill: s.mood.title[0], text: "LAUNCH DAY", duration: 4.6, transition: "cut" }}
            plan={{ palette: s.mood.palette, font: s.mood.font, seed: 500 + i, style: "trailer", bpm: s.mood.bpm }}
            long={320}
            fps={15}
          />
          <span className="template-name">{s.name}</span>
        </button>
      ))}
    </div>
  );
}
