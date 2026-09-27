import { z } from "zod/v4";
import { AiError, describe, readAiConfig, runDirector } from "@/lib/ai";

export const runtime = "nodejs";

/** Checks a provider/key/model with a tiny structured request. */
export async function POST(req: Request) {
  const cfg = readAiConfig(await req.json().catch(() => null));
  if (!cfg || cfg.provider === "builtin") return Response.json({ ok: true, label: "Built-in director (no AI key needed)" });
  try {
    const out = await runDirector(
      { ...cfg, mode: "fast" },
      {
        system: "You are a connectivity check.",
        text: 'Reply with the JSON object {"ok": true}.',
        images: [],
        schema: z.object({ ok: z.boolean() }),
      },
    );
    if (out === "refusal") return Response.json({ ok: false, error: "The model declined the test request." });
    return Response.json({ ok: true, label: describe(cfg) });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof AiError ? e.message : "Connection failed." });
  }
}
