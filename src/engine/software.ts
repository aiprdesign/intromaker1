/**
 * Is the intro for software, and is it phone-first? SaaS, tech and app intros show the product
 * on real 3D devices by default (see applyTemplate): web products on a laptop, apps on a phone.
 */
// Kinds of product that are software by nature.
const SOFTWARE_CONCEPTS = new Set(["devtools", "ai", "fintech", "security", "analytics", "sales", "marketing", "productivity", "hr", "communication", "creative"]);
const SOFTWARE = /\b(saas|software|platform|apps?|web ?app|dashboards?|api|sdk|cloud|workspace|plugin|extension|crm|erp|no-code|low-code|automation|automate[sd]?|ai|copilot|chatbot|tool(?:kit)?s?|integrations?|analytics|startup|tech)\b/;
const PHONE = /\b(ios|android|iphone|ipad|mobile apps?|phone apps?|app store|play store|google play|on your phone|from your phone|in your pocket|on the go|download (?:the|our) app)\b/;
// "App" said of a web product (a web app, a dashboard for teams) isn't a phone app.
const WEB = /\b(web ?apps?|saas|dashboards?|desktop|browser|api|sdk|platform|workspace|crm|erp|enterprise|b2b)\b/;

export function softwareKind(concept: string | undefined, text: string): "web" | "app" | undefined {
  const t = text.toLowerCase();
  const phone = PHONE.test(t) || (/\bapps?\b/.test(t) && !WEB.test(t));
  if (!SOFTWARE_CONCEPTS.has(concept ?? "") && !SOFTWARE.test(t) && !PHONE.test(t)) return undefined;
  return phone ? "app" : "web";
}
