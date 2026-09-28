import { AiError, listModels, readAiConfig } from "@/lib/ai";

export const runtime = "nodejs";

/** Lists the models a provider/key can use, for the AI settings model picker. */
export async function POST(req: Request) {
  const cfg = readAiConfig(await req.json().catch(() => null));
  if (!cfg || cfg.provider === "builtin") return Response.json({ models: [] });
  try {
    return Response.json({ models: await listModels(cfg) });
  } catch (e) {
    return Response.json({ models: [], error: e instanceof AiError ? e.message : "Couldn't list models." });
  }
}
