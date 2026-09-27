"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EXAMPLE_PROMPTS } from "@/engine/demos";

export default function HeroPrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const go = (p: string) => router.push(`/studio?prompt=${encodeURIComponent(p)}`);
  return (
    <div className="hero-prompt">
      <form
        className="prompt-bar"
        onSubmit={(e) => {
          e.preventDefault();
          go(prompt.trim() || EXAMPLE_PROMPTS[0]);
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='Describe your video… e.g. "Epic launch trailer for NOVA AI"'
          aria-label="Video prompt"
        />
        <button className="btn btn-primary btn-lg" type="submit">
          Generate ✦
        </button>
      </form>
      <div className="examples">
        {EXAMPLE_PROMPTS.slice(0, 4).map((p) => (
          <button key={p} className="chip" onClick={() => go(p)}>
            {p.length > 52 ? `${p.slice(0, 50)}…` : p}
          </button>
        ))}
      </div>
    </div>
  );
}
