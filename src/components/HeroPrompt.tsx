"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "./Icon";
import { EXAMPLE_PROMPTS } from "@/engine/demos";

/** A bare domain or a full http(s) address. */
const isUrl = (s: string) => /^https?:\/\/\S+\.\S+$/i.test(s.trim()) || /^([\w-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(s.trim());

/**
 * The homepage hero: a SaaS launch video from the product's website (the default), or from a
 * written prompt. Both open the studio, which imports the site or directs the prompt.
 */
export default function HeroPrompt() {
  const router = useRouter();
  const [mode, setMode] = useState<"url" | "prompt">("url");
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fromUrl = (raw: string) => {
    const u = raw.trim();
    if (!isUrl(u)) {
      setError("Enter your website's address, like yourproduct.com");
      return;
    }
    router.push(`/studio?url=${encodeURIComponent(u)}`);
  };
  const fromPrompt = (p: string) => {
    // A URL typed into the prompt box still imports the site.
    const text = p.trim() || EXAMPLE_PROMPTS[0];
    router.push(isUrl(text) ? `/studio?url=${encodeURIComponent(text)}` : `/studio?prompt=${encodeURIComponent(text)}`);
  };

  return (
    <div className="hero-prompt">
      <div className="mode-tabs" role="tablist" aria-label="Start from">
        <button role="tab" aria-selected={mode === "url"} className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}>
          <Icon name="Globe" size={14} /> From your website
        </button>
        <button role="tab" aria-selected={mode === "prompt"} className={mode === "prompt" ? "active" : ""} onClick={() => setMode("prompt")}>
          <Icon name="Sparkles" size={14} /> From a prompt
        </button>
      </div>

      {mode === "url" ? (
        <>
          <form
            className={`prompt-bar url-bar${error ? " invalid" : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              fromUrl(url);
            }}
            noValidate
          >
            <span className="url-prefix" aria-hidden>
              <Icon name="Globe" size={18} />
            </span>
            <input
              type="url"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="yourproduct.com"
              aria-label="Your website address"
              aria-invalid={!!error}
              aria-describedby="url-help"
            />
            <button className="btn btn-primary btn-lg" type="submit">
              Make my video ✦
            </button>
          </form>
          <p id="url-help" className={`hero-note${error ? " error" : ""}`} role={error ? "alert" : undefined}>
            {error ?? (
              <>
                We read your public homepage (logo, brand colours, screenshots, UI and copy) and direct a launch film from it.{" "}
                <Link href="/privacy">What we keep</Link>
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <form
            className="prompt-bar"
            onSubmit={(e) => {
              e.preventDefault();
              fromPrompt(prompt);
            }}
          >
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your product and the video you want" aria-label="Video prompt" autoFocus />
            <button className="btn btn-primary btn-lg" type="submit">
              Generate ✦
            </button>
          </form>
          <div className="examples">
            {EXAMPLE_PROMPTS.slice(0, 4).map((p) => (
              <button key={p} className="chip" onClick={() => fromPrompt(p)}>
                {p.length > 52 ? `${p.slice(0, 50)}…` : p}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
