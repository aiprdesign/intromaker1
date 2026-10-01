"use client";

import { useEffect, useRef, useState } from "react";
import { loadAiSettings } from "@/components/AiSettings";
import type { VideoPlan, VoiceSettings } from "@/engine/types";
import { LOCAL_VOICE, onClips, VOICES } from "@/engine/voice";
import { generateVoiceover, loadVoiceKeys, missingLines, saveVoiceKeys, type VoiceKeys } from "@/lib/tts";

export type Narration = ReturnType<typeof useNarration>;

/**
 * The studio's narrator. It runs whatever tab is open: lines without a clip record themselves
 * when the voice-over is switched on, when the voice changes, for a new film or remake, and (after
 * a short pause) for a line you've edited. It stops on an error (e.g. a missing key) until
 * something changes. The Voice tab only shows and changes its settings.
 */
export function useNarration(plan: VideoPlan, voice: VoiceSettings, onPlan: (p: VideoPlan) => void) {
  const [keys, setKeys] = useState<VoiceKeys>({});
  const [server, setServer] = useState<{ openai: boolean; elevenlabs: boolean }>({ openai: false, elevenlabs: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);

  useEffect(() => {
    const k = loadVoiceKeys();
    // Reuse the OpenAI key already saved in AI settings.
    const ai = loadAiSettings();
    const openai = ai.provider === "openai" ? ai.apiKey : ai.saved?.openai?.apiKey;
    setKeys({ ...k, openai: k.openai || openai || undefined });
    fetch("/api/tts")
      .then((r) => r.json())
      .then(setServer)
      .catch(() => {});
    return onClips(() => bump((n) => n + 1));
  }, []);

  const setKey = (patch: Partial<VoiceKeys>) => {
    const next = { ...keys, ...patch };
    setKeys(next);
    saveVoiceKeys(next);
  };

  /** Whether a voice source can record here without asking for anything. */
  const ready = (source: VoiceSettings["source"]) =>
    source === "local" ? LOCAL_VOICE : source === "openai" ? server.openai || !!keys.openai : source === "elevenlabs" ? server.elevenlabs || !!keys.elevenlabs : source === "custom" ? !!keys.customBase : false;
  /** The voice to switch on automatically: the chosen one if it works, else the first that does. */
  const autoVoice = (v: VoiceSettings): VoiceSettings | null => {
    if (ready(v.source)) return { ...v, enabled: true };
    const src = (["local", "openai", "elevenlabs"] as const).find(ready);
    return src ? { ...v, enabled: true, source: src, voice: VOICES[src][0].id, model: undefined } : null;
  };

  const withVoice = { ...plan, voiceover: voice };
  const missing = missingLines(withVoice);
  const lines = plan.scenes.filter((s) => s.vo).length;

  const lastError = useRef<string | null>(null);
  const recording = useRef<Promise<VideoPlan | null> | null>(null);
  const planRef = useRef(withVoice);
  planRef.current = withVoice;
  const keysRef = useRef(keys);
  keysRef.current = keys;
  /** Record every line still missing; resolves to the re-timed plan (or null on an error). */
  const record = () =>
    (recording.current ??= (async () => {
      setError(null);
      try {
        const out = await generateVoiceover(planRef.current, keysRef.current, setBusy);
        const next = { ...out, voiceover: undefined };
        onPlan(next);
        return next;
      } catch (e) {
        lastError.current = e instanceof Error ? e.message : "Voice generation failed.";
        setError(lastError.current);
        return null;
      } finally {
        setBusy(null);
        recording.current = null;
      }
    })());

  const recordRef = useRef(record);
  recordRef.current = record;
  const errorRef = useRef(error);
  errorRef.current = error;
  const auto = voice.enabled && voice.source !== "upload" && missing > 0 && lines > 0;
  const lineKey = plan.scenes.map((s) => s.vo ?? "").join("|");
  useEffect(() => {
    setError(null);
  }, [voice.enabled, voice.source, voice.voice, voice.model, keys.openai, keys.elevenlabs, keys.customBase]);
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => {
      if (!recording.current && !errorRef.current) void recordRef.current();
    }, 1200);
    return () => clearTimeout(id);
  }, [auto, lineKey, voice.source, voice.voice, voice.model, error]);

  /**
   * Before an export: finish any lines still to record so the narration is in the file. Resolves
   * to the plan to export (re-timed when scenes stretched), or null when the voice can't record.
   */
  const ensure = async (): Promise<VideoPlan | null> => {
    if (!voice.enabled || voice.source === "upload") return planRef.current;
    if (recording.current) await recording.current;
    const out = await record();
    return out ? { ...out, voiceover: voice } : null;
  };

  /** Why the last recording failed (read after `ensure`, before the next render). */
  const failure = () => lastError.current;

  return { failure, keys, setKey, server, busy, setBusy, error, setError, missing, lines, record, ready, autoVoice, ensure };
}
