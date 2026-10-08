import { CONCEPT_MAP } from "./concepts";

/**
 * The style Auto picks for an intro's purpose. The kind of product (its concept) sets the base;
 * the words then steer it where the purpose calls for a particular look:
 * - AI companies: a dark, glowing tech look (AI Glow).
 * - Corporate, B2B and professional services: clean, light and calm (Enterprise Clean), or Swiss
 *   Clean for law and finance firms.
 * - Online stores: clean and trustworthy (Enterprise Clean), so the products carry the colour.
 * Character videos (kids, classrooms…) are picked before this, in charpick.ts.
 */
const AI = /\b(ai|a\.i\.|artificial intelligence|llms?|gpt|genai|generative|machine learning|ml models?|neural|ai agents?|copilots?|chatbots?)\b/;
const CORPORATE = /\b(enterprise|corporate|corporation|consult(?:ing|ancy|ants?)|b2b|firms?|holdings|advisory|professional services|partners|compliance|insurance|insurers?|banks?|banking|accounting|accountants?|audit(?:ing|ors?)?|wealth|asset management|investments?|procurement|outsourcing|staffing|industrial|manufactur(?:er|ing))\b/;
const LAW_FINANCE = /\b(law firms?|lawyers?|attorneys?|legal|solicitors?|tax|accounting|accountants?|wealth|investments?|asset management)\b/;
// Products whose own style already suits a corporate audience stay in it.
const KEEP_FOR_CORPORATE = new Set(["security", "devtools", "legal", "sales", "fintech", "logistics", "analytics"]);

export function purposeStyle(concept: string | undefined, text: string): string | undefined {
  const t = text.toLowerCase();
  const id = concept && CONCEPT_MAP[concept] ? concept : "general";
  if (id === "ai" || ((id === "general" || id === "productivity" || id === "communication") && AI.test(t))) return "aiglow";
  if (id === "ecommerce") return "enterprise";
  if (CORPORATE.test(t) && !KEEP_FOR_CORPORATE.has(id)) return LAW_FINANCE.test(t) ? "swiss" : "enterprise";
  return CONCEPT_MAP[id]?.template;
}
