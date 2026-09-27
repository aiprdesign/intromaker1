"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EXAMPLE_PROMPTS } from "@/engine/demos";

export default function HeroPrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  // A bare domain or URL imports that website; anything else is a prompt.
  const isUrl = (s: string) =>
    /^https?:\/\/\S+$/i.test(s.trim()) || /^([\w-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(s.trim());
  const go = (p: string) =>
    router.push(isUrl(p) ? `/studio?url=${encodeURIComponent(p.trim())}` : `/studio?prompt=${encodeURIComponent(p)}`);
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
          placeholder="Describe your video — or paste your website URL"
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
