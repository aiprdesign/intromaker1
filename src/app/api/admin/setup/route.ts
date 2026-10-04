import { describe } from "@/lib/ai";
import { maskKey, noStore, planLimits, readSettings, requireAdmin, SERVICE_KEYS, writeSettings, type ServiceKeyName, type ServiceKeys } from "@/lib/admin";
import { webhookConfigured } from "@/lib/billing";
import { envStatus } from "@/lib/envvars";
import { effectiveBilling } from "@/lib/stripe-links";
import { dataIsPersistent } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAMES = Object.keys(SERVICE_KEYS) as ServiceKeyName[];

/** Plug and play: what's set up, and the service keys (masked: only a hint ever leaves the server). */
async function view() {
  const s = await readSettings();
  const keys = Object.fromEntries(
    NAMES.map((k) => {
      const saved = s.keys?.[k];
      const env = process.env[SERVICE_KEYS[k].env];
      // The partner tag isn't a secret; the rest show a masked hint only.
      const hint = k === "amazonTag" ? (saved ?? env ?? "") : maskKey(saved ?? env);
      return [k, { label: SERVICE_KEYS[k].label, env: SERVICE_KEYS[k].env, source: saved ? "admin" : env ? "env" : null, hint }];
    }),
  ) as Record<ServiceKeyName, { label: string; env: string; source: "admin" | "env" | null; hint: string }>;
  const plans = await planLimits();
  const envAi = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const b = effectiveBilling(s.billing);
  return {
    keys,
    env: envStatus(),
    status: {
      persistent: dataIsPersistent(),
      ai: s.ai && s.ai.provider !== "builtin" ? describe(s.ai) : envAi ? "Anthropic Claude (ANTHROPIC_API_KEY)" : null,
      voice: !!(keys.openaiVoice.source || keys.elevenlabs.source),
      stripeLinks: !!(b.monthlyLink || b.yearlyLink),
      stripeWebhook: webhookConfigured(),
      proUnlocksMore: JSON.stringify(plans.free) !== JSON.stringify(plans.pro),
      proPrice: !!s.proPrice?.trim(),
      contactEmail: !!s.contactEmail?.trim(),
      amazon: !!(keys.amazonAccess.source && keys.amazonSecret.source && keys.amazonTag.source),
      ebay: !!(keys.ebayId.source && keys.ebaySecret.source),
    },
  };
}

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return Response.json(await view(), { headers: noStore });
}

/**
 * Save service keys: { keys: { name: "value" } , clear?: [names] }. An empty value keeps the saved
 * key (so the form never needs to show it); names in clear remove it (the environment variable,
 * if any, applies again).
 */
export async function PUT(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { keys?: Record<string, unknown>; clear?: unknown } | null;
  if (!body) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  const current = (await readSettings()).keys ?? {};
  const next: ServiceKeys = { ...current };
  for (const k of NAMES) {
    const v = body.keys?.[k];
    if (typeof v === "string" && v.trim()) {
      if (/\s/.test(v.trim()) || v.trim().length > 400) return Response.json({ error: `${SERVICE_KEYS[k].label} doesn't look right.` }, { status: 400 });
      next[k] = v.trim();
    }
  }
  if (Array.isArray(body.clear)) for (const k of body.clear) if (NAMES.includes(k as ServiceKeyName)) delete next[k as ServiceKeyName];
  await writeSettings({ keys: next });
  return Response.json(await view(), { headers: noStore });
}
