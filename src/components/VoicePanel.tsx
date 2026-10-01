"use client";

import type { Narration } from "@/components/useNarration";
import type { VideoPlan, VoiceSettings } from "@/engine/types";
import { getClip, UPLOAD_KEY, VOICE_SOURCES, VOICES } from "@/engine/voice";
import { loadRecording } from "@/lib/tts";

const STORAGE = "intromaker.voice.v1";

export function saveVoiceSettings(v: VoiceSettings) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

export function loadVoiceSettings(fallback: VoiceSettings): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE);
    const saved: VoiceSettings = raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    // A source this deployment doesn't offer (e.g. the local voice switched off) falls back.
    return VOICE_SOURCES.some((s) => s.id === saved.source) ? saved : { ...fallback, enabled: saved.enabled, captions: saved.captions };
  } catch {
    return fallback;
  }
}

/**
 * Voice-over settings. The narrator's lines live on the scenes (editable in the storyboard); the
 * studio's narrator (useNarration) records them with the chosen voice and re-times scenes that need longer.
 */
export default function VoicePanel({
  voice,
  onVoice,
  plan,
  onPlan,
  onRewrite,
  narration,
}: {
  voice: VoiceSettings;
  onVoice: (v: VoiceSettings) => void;
  plan: VideoPlan;
  onPlan: (p: VideoPlan) => void;
  onRewrite: () => void;
  /** The studio's narrator (records in the background, whichever tab is open). */
  narration: Narration;
}) {
  const { keys, setKey, server, busy, setBusy, error, setError, missing, lines, record } = narration;
  const set = (patch: Partial<VoiceSettings>) => {
    const next = { ...voice, ...patch };
    onVoice(next);
    saveVoiceSettings(next);
  };
  const source = VOICE_SOURCES.find((s) => s.id === voice.source)!;
  const voices = voice.source === "upload" ? [] : VOICES[voice.source];

  return (
    <div className="voice-panel">
      <label className="check-row voice-toggle">
        <input type="checkbox" checked={voice.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        <strong>Voice-over</strong>
        <span className="hint inline">narrator + captions</span>
      </label>
      {!voice.enabled && (
        <div className="voice-intro">
          <p className="hint">Turn it on and the director writes a narrator line for every slide, sized to fit it, then records it. Word-by-word captions follow the voice, and the music ducks under every line.</p>
          <ul className="hint">
            <li>Free voice that runs in your browser (no key), or OpenAI, ElevenLabs, your own voice server or an uploaded recording.</li>
            <li>Edit any line in the slide editor; it re-records automatically.</li>
            <li>Voice and captions are in every export.</li>
          </ul>
          <button className="btn btn-ghost" onClick={() => set({ enabled: true })}>
            🎙 Add a voice-over
          </button>
        </div>
      )}
      {voice.enabled && (
        <>
          <select className="select" value={voice.source} onChange={(e) => {
            const src = e.target.value as VoiceSettings["source"];
            set({ source: src, voice: src === "upload" ? voice.voice : VOICES[src][0].id, model: undefined });
          }} aria-label="Voice source">
            {VOICE_SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="hint">{source.note}</p>

          {voice.source !== "upload" && (
            <>
              {voice.source === "elevenlabs" || voice.source === "custom" ? (
                <div className="voice-row">
                  <select className="select grow" value={voices.some((x) => x.id === voice.voice) ? voice.voice : "__custom"} onChange={(e) => e.target.value !== "__custom" && set({ voice: e.target.value })} aria-label="Voice">
                    {voices.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                    <option value="__custom">Other voice ID…</option>
                  </select>
                  <input className="input sm" value={voice.voice} onChange={(e) => set({ voice: e.target.value.trim() })} placeholder="voice id" aria-label="Voice ID" />
                </div>
              ) : (
                <select className="select" value={voice.voice} onChange={(e) => set({ voice: e.target.value })} aria-label="Voice">
                  {voices.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              )}
              {voice.source === "openai" && !server.openai && (
                <input className="input" type="password" value={keys.openai ?? ""} onChange={(e) => setKey({ openai: e.target.value.trim() })} placeholder="OpenAI API key (sk-…)" aria-label="OpenAI API key" />
              )}
              {voice.source === "elevenlabs" && !server.elevenlabs && (
                <input className="input" type="password" value={keys.elevenlabs ?? ""} onChange={(e) => setKey({ elevenlabs: e.target.value.trim() })} placeholder="ElevenLabs API key" aria-label="ElevenLabs API key" />
              )}
              {voice.source === "custom" && (
                <>
                  <input className="input" value={keys.customBase ?? ""} onChange={(e) => setKey({ customBase: e.target.value.trim() })} placeholder="http://localhost:8880/v1" aria-label="Voice server base URL" />
                  <div className="voice-row">
                    <input className="input grow" value={voice.model ?? ""} onChange={(e) => set({ model: e.target.value.trim() || undefined })} placeholder="model (e.g. kokoro, tts-1)" aria-label="Voice model" />
                    <input className="input grow" type="password" value={keys.customKey ?? ""} onChange={(e) => setKey({ customKey: e.target.value.trim() })} placeholder="key (optional)" aria-label="Voice server key" />
                  </div>
                </>
              )}
              <div className="voice-row">
                <button className="btn btn-primary grow" onClick={() => void record()} disabled={!!busy || !lines}>
                  {busy ? "Recording…" : missing ? `🎙 Record voice-over (${missing} line${missing > 1 ? "s" : ""})` : "✓ Voice-over recorded"}
                </button>
                <button className="btn btn-ghost" onClick={onRewrite} disabled={!!busy} title="Write fresh narrator lines from the storyboard">
                  Rewrite lines
                </button>
              </div>
            </>
          )}

          {voice.source === "upload" && (
            <>
              <input
                className="input"
                type="file"
                accept="audio/*"
                aria-label="Narration recording"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setError(null);
                  setBusy("Decoding your recording…");
                  try {
                    const secs = await loadRecording(f);
                    setBusy(null);
                    onPlan({ ...plan });
                    setError(secs > plan.scenes.reduce((a, s) => a + s.duration, 0) + 1 ? "The recording is longer than the film; lengthen scenes or trim it." : null);
                  } catch (err) {
                    setBusy(null);
                    setError(err instanceof Error ? err.message : "Couldn't read that audio file.");
                  }
                }}
              />
              <label className="check-row">
                Starts at
                <input className="input sm" type="number" min={0} max={60} step={0.1} value={voice.offset ?? 0} onChange={(e) => set({ offset: Number(e.target.value) || 0 })} />s
              </label>
              {getClip(UPLOAD_KEY) && <p className="hint ok">Recording loaded ({getClip(UPLOAD_KEY)!.duration.toFixed(1)}s).</p>}
            </>
          )}

          <label className="check-row">
            <input type="checkbox" checked={voice.captions} onChange={(e) => set({ captions: e.target.checked })} disabled={voice.source === "upload"} />
            Word-by-word captions
          </label>
          {voice.captions && voice.source !== "upload" && (
            <div className="seg-control" role="radiogroup" aria-label="Caption style">
              {(
                [
                  ["frosted", "Frosted"],
                  ["pop", "Pop"],
                  ["box", "Box"],
                  ["karaoke", "Karaoke"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} role="radio" aria-checked={(voice.captionStyle ?? "frosted") === id} className={(voice.captionStyle ?? "frosted") === id ? "active" : ""} onClick={() => set({ captionStyle: id })}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {busy && <p className="hint">{busy}</p>}
          {error && <p className="hint warn">{error}</p>}
          {!busy && !error && voice.source !== "upload" && (
            <p className="hint">
              {lines} narrated scene{lines === 1 ? "" : "s"}. Edit any line in the storyboard; scenes stretch on the beat if a line needs longer.
            </p>
          )}
        </>
      )}
    </div>
  );
}
