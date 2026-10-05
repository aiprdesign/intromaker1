/**
 * The server's environment variables, for the admin's setup guide: what each one is for and whether
 * it's set on this server. Values never leave the server (only set / not set).
 */
export type EnvGroup = "Admin and payments" | "Storage" | "AI" | "Voice-over" | "Product listings" | "Limits";

export interface EnvVar {
  name: string;
  group: EnvGroup;
  /** What it does, in a line. */
  purpose: string;
  /** An example value or format (never a real secret). */
  example: string;
  /** A secret: shown as set / not set only. */
  secret: boolean;
  /** Needed for the site to work as a hosted product (the rest are optional). */
  needed?: boolean;
}

export const ENV_VARS: EnvVar[] = [
  { name: "ADMIN_PASSWORD", group: "Admin and payments", purpose: "Turns on this admin area and the video log; the password to sign in here.", example: "a long, unique password", secret: true, needed: true },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    group: "Admin and payments",
    purpose: "The signing secret of your Stripe webhook endpoint, so payments switch plans on by themselves (see Billing).",
    example: "whsec_…",
    secret: true,
  },
  { name: "STRIPE_MONTHLY_LINK", group: "Admin and payments", purpose: "The monthly Stripe Payment Link (wins over Admin → Billing).", example: "https://buy.stripe.com/…", secret: false },
  { name: "STRIPE_YEARLY_LINK", group: "Admin and payments", purpose: "The yearly Stripe Payment Link (optional).", example: "https://buy.stripe.com/…", secret: false },
  { name: "STRIPE_PORTAL_LINK", group: "Admin and payments", purpose: "The Stripe customer portal login link, for Manage billing.", example: "https://billing.stripe.com/p/login/…", secret: false },
  { name: "STRIPE_YEARLY_PRICE", group: "Admin and payments", purpose: "How the yearly price reads on the account page.", example: "$90 / year", secret: false },
  { name: "INTROMAKER_SITE_URL", group: "Storage", purpose: "The site's public address, for the sitemap, robots.txt and canonical links (search engines). Without it, the address of each request is used.", example: "https://prodintro.com", secret: false },
  { name: "INTROMAKER_DATA_DIR", group: "Storage", purpose: "Where accounts, saved intros, settings and captures are kept. Point it at a mounted volume.", example: "/data", secret: false, needed: true },
  { name: "INTROMAKER_AI_PROVIDER", group: "AI", purpose: "The AI director's provider for visitors without their own key, by id: openrouter, deepseek, openai, gemini, anthropic, groq… (the AI tab wins when a provider is chosen there).", example: "openrouter", secret: false },
  { name: "INTROMAKER_AI_KEY", group: "AI", purpose: "That provider's API key.", example: "sk-or-…", secret: true },
  { name: "INTROMAKER_AI_MODEL", group: "AI", purpose: "The model (optional; the provider's first suggestion otherwise).", example: "deepseek/deepseek-v4-flash", secret: false },
  { name: "INTROMAKER_AI_BASE_URL", group: "AI", purpose: "The API address, for a custom OpenAI-compatible server (optional).", example: "https://api.runpod.ai/v2/<id>/openai/v1", secret: false },
  { name: "INTROMAKER_AI_MODE", group: "AI", purpose: "fast, balanced (default) or best: best always self-reviews the storyboard.", example: "balanced", secret: false },
  { name: "ANTHROPIC_API_KEY", group: "AI", purpose: "A Claude key for the AI director, used when INTROMAKER_AI_PROVIDER isn't set.", example: "sk-ant-…", secret: true },
  { name: "INTROMAKER_AI_DAILY_BUDGET", group: "AI", purpose: "AI videos per day on the server's key, all visitors combined (default 200).", example: "200", secret: false },
  { name: "OPENAI_API_KEY", group: "Voice-over", purpose: "OpenAI voices for visitors who haven't added their own key.", example: "sk-…", secret: true },
  { name: "ELEVENLABS_API_KEY", group: "Voice-over", purpose: "ElevenLabs voices for visitors who haven't added their own key.", example: "your ElevenLabs API key", secret: true },
  { name: "AMAZON_PAAPI_ACCESS_KEY", group: "Product listings", purpose: "Amazon Product Advertising API access key (reads Amazon listings reliably).", example: "AKIA…", secret: true },
  { name: "AMAZON_PAAPI_SECRET_KEY", group: "Product listings", purpose: "Amazon Product Advertising API secret key.", example: "your PA-API secret", secret: true },
  { name: "AMAZON_PAAPI_PARTNER_TAG", group: "Product listings", purpose: "Your Amazon Associates partner tag.", example: "yourstore-20", secret: false },
  { name: "EBAY_CLIENT_ID", group: "Product listings", purpose: "eBay developer app client id (reads eBay listings through the Browse API).", example: "YourApp-…-PRD-…", secret: true },
  { name: "EBAY_CLIENT_SECRET", group: "Product listings", purpose: "eBay developer app client secret.", example: "PRD-…", secret: true },
  { name: "INTROMAKER_MAX_CAPTURES", group: "Limits", purpose: "Website imports captured in a headless browser at once, about 300 MB of memory each (default 2; 1 on small servers).", example: "1", secret: false },
  { name: "INTROMAKER_CAPTURE_TIMEOUT_S", group: "Limits", purpose: "Seconds one website capture may take before the import reads the page's HTML instead (default 60, 15 to 120).", example: "60", secret: false },
  { name: "INTROMAKER_PROXY_HOPS", group: "Limits", purpose: "Trusted proxies in front of the server, for reading visitors' addresses (default 1; 0 when it faces the internet directly).", example: "1", secret: false },
  { name: "INTROMAKER_LOGIN_TRIES", group: "Limits", purpose: "Wrong passwords allowed before an address is blocked from signing in (default 3).", example: "3", secret: false },
  { name: "INTROMAKER_LOGIN_BLOCK_MIN", group: "Limits", purpose: "How long that block lasts, in minutes (default 60, at most 1440).", example: "60", secret: false },
  { name: "INTROMAKER_RATE_LIMIT", group: "Limits", purpose: "Rate limits are on in production; \"off\" turns them off (not recommended).", example: "off", secret: false },
];

/** Each variable and whether it's set here (never its value, except the plain settings). */
export function envStatus() {
  return ENV_VARS.map((v) => {
    const raw = process.env[v.name];
    const set = !!raw?.trim();
    return { ...v, set, value: !v.secret && set ? raw!.trim().slice(0, 80) : undefined };
  });
}
