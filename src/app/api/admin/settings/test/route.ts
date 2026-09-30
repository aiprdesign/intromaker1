import { z } from "zod/v4";
import { AiError, describe, readAiConfig, runDirector } from "@/lib/ai";
import { noStore, readSettings, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Check the server AI with a tiny structured request: the saved settings, or the form's (an empty key uses the saved one). */
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const saved = await readSettings();
  const provider = typeof body.provider === "string" ? body.provider : saved.ai?.provider;
  const key = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : saved.ai?.provider === provider ? saved.ai?.apiKey : undefined;
  const cfg = readAiConfig({ ...saved.ai, ...body, provider, apiKey: key });
  if (!cfg || cfg.provider === "builtin") return Response.json({ ok: true, label: "Built-in director (no AI key needed)" }, { headers: noStore });
  try {
    const out = await runDirector(
      { ...cfg, mode: "fast" },
      { system: "You are a connectivity check.", text: 'Reply with the JSON object {"ok": true}.', images: [], schema: z.object({ ok: z.boolean() }) },
    );
    if (out === "refusal") return Response.json({ ok: false, error: "The model declined the test request." }, { headers: noStore });
    return Response.json({ ok: true, label: describe(cfg) }, { headers: noStore });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof AiError ? e.message : "Connection failed." }, { headers: noStore });
  }
}
