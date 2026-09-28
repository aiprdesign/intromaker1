import { AiError, checkBaseUrl, redact } from "@/lib/ai";

export const runtime = "nodejs";

/**
 * Text-to-speech for the voice-over, through the server so API keys never sit in the page:
 * OpenAI (gpt-4o-mini-tts), ElevenLabs (with word timestamps) or any OpenAI-compatible speech
 * server (Kokoro-FastAPI, openedai-speech…, allowed on your own machine). Keys come from the
 * request (the studio's voice settings) or the server's environment.
 *
 * Returns { audio: base64, mime, alignment? }.
 */
const NARRATOR =
  "Speak as a confident, warm product-launch narrator: clear and upbeat, unhurried, with a natural smile in the voice. Short pauses at full stops.";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const provider = String(body?.provider ?? "");
  const text = String(body?.text ?? "").trim().slice(0, 600);
  const voice = String(body?.voice ?? "").slice(0, 64);
  const model = typeof body?.model === "string" && body.model ? String(body.model).slice(0, 64) : undefined;
  const clientKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!text) return Response.json({ error: "Nothing to say." }, { status: 400 });
  if (!/^[\w.-]{1,64}$/.test(voice)) return Response.json({ error: "Pick a voice." }, { status: 400 });
  try {
    if (provider === "elevenlabs") {
      const key = clientKey || process.env.ELEVENLABS_API_KEY || "";
      if (!key) throw new AiError("Add your ElevenLabs API key in the voice-over settings.");
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: model ?? "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25 } }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new AiError(`ElevenLabs: ${res.status} ${redact(await res.text(), key)}`);
      const data = (await res.json()) as {
        audio_base64?: string;
        alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
      };
      if (!data.audio_base64) throw new AiError("ElevenLabs returned no audio.");
      return Response.json({ audio: data.audio_base64, mime: "audio/mpeg", alignment: data.alignment ?? null });
    }
    if (provider === "openai" || provider === "custom") {
      let base = "https://api.openai.com/v1";
      let key = clientKey || process.env.OPENAI_API_KEY || "";
      if (provider === "custom") {
        base = String(body?.baseUrl ?? "").trim().replace(/\/+$/, "");
        if (!base) throw new AiError("Add your voice server's base URL (…/v1).");
        await checkBaseUrl(base);
        key = clientKey;
      } else if (!key) throw new AiError("Add your OpenAI API key in the voice-over settings.");
      const m = model ?? (provider === "openai" ? "gpt-4o-mini-tts" : "kokoro");
      const res = await fetch(`${base}/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({
          model: m,
          voice,
          input: text,
          response_format: "mp3",
          ...(m.startsWith("gpt-4o") ? { instructions: NARRATOR } : {}),
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new AiError(`${provider === "openai" ? "OpenAI" : "Voice server"}: ${res.status} ${redact(await res.text(), key)}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 64) throw new AiError("The voice server returned no audio.");
      return Response.json({ audio: buf.toString("base64"), mime: res.headers.get("content-type") ?? "audio/mpeg", alignment: null });
    }
    return Response.json({ error: "Unknown voice provider." }, { status: 400 });
  } catch (e) {
    const message = e instanceof AiError ? e.message : e instanceof Error ? redact(e.message, clientKey) : "Voice generation failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}

/** Which voice keys the server itself holds (so the studio can skip asking for one). */
export async function GET() {
  return Response.json({ openai: !!process.env.OPENAI_API_KEY, elevenlabs: !!process.env.ELEVENLABS_API_KEY });
}
