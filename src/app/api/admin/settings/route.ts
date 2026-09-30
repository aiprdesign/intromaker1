import { describe, readAiConfig } from "@/lib/ai";
import { maskKey, noStore, readSettings, requireAdmin, writeSettings } from "@/lib/admin";
import { PRESET_MAP } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server AI settings. The key never leaves the server: only a masked hint is returned. */
async function view() {
  const s = await readSettings();
  const envKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return {
    provider: s.ai?.provider ?? "builtin",
    model: s.ai?.model ?? "",
    baseUrl: s.ai?.baseUrl ?? "",
    mode: s.ai?.mode ?? "balanced",
    images: s.ai?.images !== false,
    keySet: !!s.ai?.apiKey,
    keyHint: maskKey(s.ai?.apiKey),
    dailyBudget: s.dailyBudget ?? null,
    perVisitor: s.perVisitor ?? null,
    envKey,
    envBudget: Number(process.env.INTROMAKER_AI_DAILY_BUDGET ?? 200) || 0,
    active: s.ai && s.ai.provider !== "builtin" ? describe(s.ai) : envKey ? "Anthropic Claude (ANTHROPIC_API_KEY)" : "Built-in director (no AI)",
    updatedAt: s.updatedAt ?? null,
  };
}

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return Response.json(await view(), { headers: noStore });
}

/**
 * Save: { provider, apiKey?, model?, baseUrl?, mode?, images?, dailyBudget?, perVisitor?, clearKey? }.
 * An empty apiKey keeps the saved one (so the form never needs to show it); clearKey removes it.
 */
export async function PUT(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  const current = await readSettings();
  const provider = typeof body.provider === "string" ? body.provider : "builtin";
  if (provider !== "builtin" && !PRESET_MAP[provider]) return Response.json({ error: "Unknown provider" }, { status: 400 });
  const sameProvider = current.ai?.provider === provider;
  const newKey = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : undefined;
  const apiKey = body.clearKey ? undefined : (newKey ?? (sameProvider ? current.ai?.apiKey : undefined));
  const ai = readAiConfig({ ...body, provider, apiKey });
  const num = (v: unknown, max: number) => (v === null || v === "" || v === undefined ? undefined : Math.min(max, Math.max(0, Math.floor(Number(v)))) || 0);
  await writeSettings({ ai: ai ?? undefined, dailyBudget: num(body.dailyBudget, 100_000), perVisitor: num(body.perVisitor, 10_000) });
  return Response.json(await view(), { headers: noStore });
}
