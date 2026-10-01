/**
 * Claim-safe copy. Launch films are advertising, and advertising claims need substantiation
 * (the FTC's standard; the FDA's for anything health-related). The words on screen and in the
 * voice-over stay generic and descriptive:
 * - no superlatives ("the best", "#1", "world's fastest"), absolutes or guarantees ("100%",
 *   "guaranteed", "never miss"), speed or multiplier claims ("in seconds", "10x faster") and no
 *   social-proof numbers ("trusted by 12,000+ teams");
 * - no efficacy or outcome promises ("stops every threat", "boost your revenue", "clinically
 *   proven"), health or medical claims (treats, cures, prevents a disease; FDA approved),
 *   certification or compliance claims (SOC 2, HIPAA compliant, bank-grade), green claims
 *   (eco-friendly, carbon neutral), endorsements ("as seen on", "recommended by") or origin
 *   claims ("Made in USA").
 * The site's own wording is kept where it's neutral, softened where that is safe, and left out
 * where it isn't. This is an automated screen, not legal review.
 */

const SUPERLATIVE =
  "best|fastest|easiest|simplest|smartest|quickest|cheapest|strongest|safest|greatest|finest|" +
  "most (?:powerful|advanced|trusted|secure|reliable|popular|complete|intuitive|innovative|affordable|flexible|accurate)|" +
  "(?:industry|market|category|world)[- ]leading|leading|best[- ]in[- ]class|world[- ]class|top[- ]rated|award[- ]winning|" +
  "ultimate|unbeatable|unmatched|unrivall?ed|unparalleled|revolutionary|groundbreaking|game[- ]changing|cutting[- ]edge|" +
  "state[- ]of[- ]the[- ]art|perfect|flawless|premier|no\\. ?1|#1|number[- ]one";

type Rule = [RegExp, string | ((...m: string[]) => string)];

const RULES: Rule[] = [
  // Social proof with a number or a boast: "Trusted by 12,000+ teams", "Loved by thousands".
  [/\b(?:trusted|loved|used|chosen|relied on|backed)\s+by\s+(?:over\s+|more than\s+)?(?:\*?\d[\d,.]*\s*[kmb]?\+?\*?|thousands|millions|hundreds|the best|leading|top|the world'?s)[^.!?|—–]*/gi, "Built for *teams*"],
  [/\bjoin\s+(?:over\s+|more than\s+)?\*?\d[\d,.]*\s*[kmb]?\+?\*?\s+[^.!?|—–]*/gi, "Join us"],
  // "The world's fastest …", "the #1 …", "the best way to …".
  [new RegExp(`\\b(the|a|our)\\s+(?:world'?s\\s+)?(?:\\*)?(?:${SUPERLATIVE})(?:\\*)?\\s+(way|place|tool|platform|app)\\s+to\\b`, "gi"), (_m, _a, noun) => `a new ${noun} to`],
  [new RegExp(`\\bthe\\s+world'?s\\s+(?:first|largest|biggest|${SUPERLATIVE})\\s+`, "gi"), "the "],
  [/\bworld'?s\s+(?:first|largest|biggest)\s+/gi, ""],
  // "The most powerful X ever built": the boast goes, and so does its tail.
  [/\s+(?:ever\s+(?:built|made|created|designed)|of all time|on the market|in the world)\b/gi, ""],
  [new RegExp(`(?:\\*)?(?<![\\w#])(?:${SUPERLATIVE})(?:\\*)?(?=[\\s,.!?—–-]|$)\\s*`, "gi"), ""],
  // Comparatives with nothing to compare against ("Ship faster", "a better way to").
  [/\b(?:a|the)\s+(?:\*)?(?:better|faster|smarter|easier|simpler|quicker)(?:\*)?\s+(way|place|tool|platform|app)\s+to\b/gi, (_m, noun: string) => `a new ${noun} to`],
  [/\s*(?:\*)?\b(?:faster|smarter|better|quicker|easier|cheaper)\b(?:\*)?(?!\s+than)/gi, ""],
  // Absolutes and guarantees.
  [/\b100\s?%\s*/g, ""],
  [/\b(?:guaranteed|guarantees?|risk[- ]free|foolproof|bulletproof|forever)\b\s*/gi, ""],
  [/\bnever\s+miss\s+(?:a|an|another)\s+([a-z]+(?:-[a-z]+)*)(?:\s+again)?\b/gi, (_m, w: string) => `keep track of ${/s$/i.test(w) ? w : `${w}s`}`],
  [/\bnever\s+miss\b/gi, "keep track of"],
  [/\bnever\s+lose\b/gi, "keep"],
  [/\bnever\s+worry\s+about\b/gi, "worry less about"],
  [/\bzero\s+(?:downtime|errors?|bugs?|risk|effort|hassle)\b/gi, "less hassle"],
  [/\balways[- ](?:on|up)\b/gi, "on"],
  [/\balways\s+/gi, ""],
  [/\b(?:exactly|precisely|perfectly|completely|totally|fully)\s+(?=[a-z])/gi, ""],
  [/\beffortless(?:ly)?\b/gi, (m) => (m.toLowerCase().endsWith("ly") ? "simply" : "simple")],
  [/\beverything you need\b/gi, "the tools you need"],
  [/\beverything\b/gi, "it all"],
  [/\bno more\b/gi, "less time on"],
  [/\s+again\b(?=[.!?]?$)/gi, ""],
  // Efficacy: "Sentinel stops cyber threats" → "Sentinel helps you monitor cyber threats".
  [/\b(stops?|blocks?|prevents?|eliminates?|kills?)\s+(?:all\s+|every\s+|any\s+)?((?:cyber\s*|online\s+|payment\s+)?(?:threats?|attacks?|breaches|fraud|hacks?|malware|phishing|errors?|bugs?|downtime|spam|bots?))\b/gi, (_m, verb: string, what: string) => `${/s$/i.test(verb) ? "helps you monitor" : "monitor"} ${what}`],
  [/\b(?:clinically|scientifically|independently)?\s*(?:proven|tested|validated)\s+(?:to\s+\w+\s*)?/gi, ""],
  [/\bget results\b/gi, "get started"],
  // Speed and multiplier claims.
  [/\s*\bat the speed of (?:thought|light|sound)\b/gi, ""],
  [/\b(?:blazing(?:ly)?|lightning)[- ]fast\b\s*/gi, ""],
  [/\s+(?:that\s+)?you can (?:trust|rely on|count on)\b/gi, ""],
  [/\bseamless(?:ly)?\s*/gi, ""],
  [/\b(?:in|within)\s+(?:just\s+|only\s+|a few\s+)?(?:\*)?(?:seconds|minutes|a minute|a second|one click|a click)(?:\*)?/gi, ""],
  [/\b(?:instantly|in no time|like never before|faster than ever|than ever before)\b\s*/gi, ""],
  [/\binstant\s+(?=[a-z])/gi, ""],
  [/\b\d+(?:\.\d+)?\s?[x×]\s+(?:faster|quicker|more|better|cheaper|less)\b\s*/gi, ""],
  [/\b(?:up to\s+)?\d+(?:\.\d+)?\s?%\s+(?:faster|quicker|more|better|cheaper|less|fewer|higher|lower|increase|reduction|off)\b\s*/gi, ""],
];

/** Tidy what rewriting leaves behind: doubled spaces, empty emphasis, dangling punctuation. */
function tidy(s: string) {
  return s
    .replace(/\*\s*\*/g, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,;:])(?=[.!?])/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[,;:—–-]\s*/, "")
    .replace(/\s*[,;:—–-]\s*$/, "")
    .trim();
}

/** The same line with its claims taken out ("The #1 CRM for startups" → "The CRM for startups"). */
export function safeCopy(text: string): string;
export function safeCopy(text: string | undefined): string | undefined;
export function safeCopy(text: string | undefined) {
  if (!text) return text;
  let s = text;
  for (const [re, to] of RULES) s = s.replace(re, to as string);
  s = tidy(s);
  // Keep the original capitalisation of the first letter.
  if (s && /^[A-Z]/.test(text.replace(/^[*\s]+/, ""))) s = s.replace(/^(\**)([a-z])/, (_m, star: string, c: string) => star + c.toUpperCase());
  return s;
}

/** Numbers used as a claim: counts, percentages, multipliers, ratings ("10,000+ teams", "99.9%", "4.9/5"). */
export function isNumericClaim(text: string) {
  // (Quantified performance too: "up to 40 hours", "charges in 10 minutes", "40H playtime".)
  return /\bup to\s+\d|\b\d[\d,.]*\s*(?:h|hrs?|hours?|mins?|minutes?|secs?|seconds?|days?|weeks?|months?|years?)\b|\d[\d,.]*\s*[kmb]?\+|\d\s?%|\b\d+(?:\.\d+)?\s?[x×]\b|\b\d(?:\.\d)?\s?\/\s?5\b|\b\d[\d,.]*\s*(?:[kmb]\s+)?(?:teams?|customers?|companies|users?|businesses|developers|people|brands|merchants|members|orgs?|organizations|downloads|installs|reviews)\b/i.test(text);
}

/**
 * Health and medical claims (the FDA's territory): disease, treatment and body-effect claims,
 * clinical proof, approvals and professional endorsements. Screened out in every wording mode.
 */
const HEALTH: RegExp[] = [
  // FDA: disease, treatment and body-effect claims; approvals.
  /\b(?:cures?|cured|treats?|treatment\s+(?:for|of)|heals?|healing|diagnos\w*|mitigat\w*|remed(?:y|ies))\b/i,
  /\bprevents?\s+(?:\w+\s+)?(?:disease|illness|infection|cancer|diabetes|flu|covid|heart)/i,
  /\bclinical(?:ly)?\b|\b(?:reduces?|relieves?|improves?|boosts?|restores?|balances?)\s+(?:your\s+)?(?:stress|sleep|pain|energy|mood|focus|skin|health|wellbeing|well-being|hormones?|gut|memory)\b/i,
  /\b(?:sleep|feel|look|breathe|recover|live|age)\s+(?:better|younger|healthier|longer|great)\b|\bhealthier\b/i,
  /\bFDA\b|\b(?:doctor|physician|dermatologist|dentist)[- ](?:recommended|approved|tested)\b|\b(?:medical|pharmaceutical|clinical)[- ]grade\b/i,
  /\b(?:immun\w*|weight[- ]loss|lose weight|burns?\s+fat|fat[- ]burning|detox\w*|anti[- ]aging|reverses?\s+aging|metabolism|disease|cancer|diabetes|covid|anxiety|depression|insomnia|symptoms?)\b/i,
];

/** A health or medical claim: never put on screen, whatever the wording mode. */
export function isHealthClaim(text: string) {
  return HEALTH.some((re) => re.test(text));
}

/**
 * Claims that can't be softened into something true-by-default, so the line is left out:
 * health and medical claims, certifications and compliance, green claims, endorsements, origin,
 * and promised business outcomes.
 */
const UNSAFE: RegExp[] = [
  ...HEALTH,
  // Certifications, compliance and security grades.
  /\b(?:SOC\s?2|ISO\s?27001|HIPAA|GDPR|PCI(?:[- ]DSS)?|FedRAMP|CCPA|HITRUST)\b/i,
  /\b(?:compliant|compliance[- ]ready|certified|accredited|unhackable|hack[- ]proof)\b|\b(?:bank|military|enterprise)[- ]grade\b/i,
  // Green claims.
  /\b(?:eco[- ]friendly|environmentally[- ]friendly|carbon[- ](?:neutral|negative|free)|net[- ]zero|climate[- ](?:positive|neutral)|sustainabl\w*|biodegradable|compostable|recyclable|non[- ]toxic|all[- ]natural|chemical[- ]free|plastic[- ]free)\b/i,
  // Endorsements and origin.
  /\b(?:as seen (?:on|in)|recommended by|endorsed by|approved by|official (?:partner|sponsor)|made in (?:the\s+)?(?:usa|u\.s\.a?\.?|america|uk|germany))\b/i,
  // Promised business outcomes.
  /\b(?:boost|increase|double|triple|maximi[sz]e|skyrocket|supercharge|grow|improve|cut|reduce|slash|lower|save|drive)s?\s+(?:your\s+|more\s+)?(?:revenue|sales|profits?|conversions?|roi|productivity|efficiency|costs?|churn|retention|leads|money|spend)\b/i,
];

/** A claim that can't be made safe by rewording: the line is left out. */
export function isUnsafe(text: string) {
  return UNSAFE.some((re) => re.test(text));
}

/** Does this line still make a claim? (Used by the self-review.) */
export function hasClaim(text: string | undefined) {
  if (!text) return false;
  return safeCopy(text) !== tidy(text) || isNumericClaim(text) || isUnsafe(text);
}

/** "Free" that isn't an offer: compounds and verbs ("hassle-free", "free up", "feel free"). */
const NOT_OFFER = /\b[\w]+-free\b|\bfree (up|of|from|yourself|your time|time|to (use|explore|ask))\b|\b(feel|set|break) free\b|\btoll[- ]free\b|\bfreedom\b/g;

/**
 * Whether copy makes an offer viewers could act on: something free, a trial, a discount or
 * coupon, "no credit card", a money-back guarantee. Offers must be real and available (FTC), so
 * the studio asks the maker to confirm each one before exporting.
 */
export function mentionsOffer(text: string | undefined): boolean {
  if (!text) return false;
  const t = ` ${text.toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ")} `.replace(NOT_OFFER, " ");
  return /\bfree\b|\btrials?\b|\d+\s?% off\b|\b(discount|coupon|promo code|voucher|money[- ]back|guarantee[ds]?)\b|\bno credit card\b|\bsave (\$|€|£)?\d/.test(t);
}

/** Every offer in a storyboard: the slide, and the words as they appear on screen. */
export function offersIn(plan: { scenes: { text: string; subtext?: string; items?: string[] }[] }): { scene: number; text: string }[] {
  const out: { scene: number; text: string }[] = [];
  plan.scenes.forEach((s, i) => {
    for (const t of [s.subtext, s.text.replace(/\*/g, ""), ...(s.items ?? [])]) if (t && mentionsOffer(t) && !out.some((o) => o.text === t)) out.push({ scene: i, text: t });
  });
  return out;
}

/** The key a confirmation is stored under (so an edited offer asks again). */
export const offerKey = (text: string) => text.toLowerCase().replace(/[^a-z0-9%$€£]+/g, " ").trim();
