/**
 * Claim-safe copy. Launch films are advertising, and advertising claims need substantiation
 * (the FTC's standard; the FDA's for anything health-related). The words on screen and in the
 * voice-over stay generic and descriptive:
 * - no superlatives ("the best", "#1", "world's fastest"), absolutes or guarantees ("100%",
 *   "guaranteed", "never", "forever", "always"), totality words ("all", "each", "every",
 *   "everything", "everyone", "anywhere", "unlimited", "all-in-one"), speed or multiplier claims ("in seconds", "10x faster") and no
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

/** "metric" → "metrics", "delivery" → "deliveries", "inbox" → "inboxes". */
function plural(w: string) {
  if (/[^aeiou]y$/i.test(w)) return `${w.slice(0, -1)}ies`;
  if (/(?:s|x|z|ch|sh)$/i.test(w)) return `${w}es`;
  return `${w}s`;
}

const RULES: Rule[] = [
  // Badges and awards nobody can vouch for: "Editor's Choice", "Staff pick", "Bestseller",
  // "Award winner"; and boosts with nothing behind them ("Extra strong", "Premium quality").
  [/\b(?:an?\s+|our\s+|the\s+)?(?:editor|staff|critic|customer|fan|reader|user|shopper|people|crowd)(?:s'|'s|s)?\s*[- ]?(?:choice|pick|favou?rite)s?\b\s*/gi, ""],
  [/\b(?:an?\s+|our\s+|the\s+)?(?:best[- ]?sell(?:ers?|ing)|top[- ](?:picks?|choices?|sellers?|selling)|official selection|critically acclaimed|acclaimed|highly rated|must[- ]haves?|awards?[- ](?:winners?|nominees?|nominated))\b\s*/gi, ""],
  [/\b(?:premium|top|highest|superior|exceptional|outstanding|superb)[- ]quality\b/gi, "quality"],
  [/\bextra[- ](?=(?:\*)?(?:strong|strength|secure|safe|fast|durable|tough|powerful|reliable|protective|protection|long[- ]lasting|gentle|effective|smooth|soft|comfortable|clean|bright|sharp|light|quiet|sturdy)\b)/gi, ""],
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
  // Totality words ("All", "Every", "Everything", "Everyone", "Anywhere", "Unlimited"): the line
  // keeps its meaning without promising the whole of anything.
  [/\beverything(\*?)\s+(\*?)(?:is\s+)?included\b/gi, "what's$1 $2included"],
  [/\beverything\b/gi, "what matters"],
  [/\bfor\s+everyone\b/gi, "for you"],
  [/\beveryone\b/gi, "your team"],
  [/\b(?:work|collaborate|learn|access it|join)\s+from\s+(?:anywhere|everywhere)\b/gi, (m) => `${m.split(/\s+from\s+/i)[0]} remotely`],
  [/\b(collaborate|work|learn)\s+(?:anywhere|everywhere)\b/gi, "$1 remotely"],
  [/\b(sell|shop|ship|deliver|get paid|accept payments|book|stream|publish)\s+(?:anywhere|everywhere)\b/gi, "$1 online"],
  [/\b(grow|expand|scale)\s+(?:anywhere|everywhere)\b/gi, "$1 your reach"],
  [/\b(?:everywhere|anywhere)\b/gi, "on the go"],
  [/\bask\s+anything\b/gi, "ask questions"],
  [/\banything\b/gi, "more"],
  [/\ball[- ]in[- ]one\b/gi, "connected"],
  [/\ball[- ]day\s+/gi, ""],
  [/\b(?:unlimited|limitless|infinite)\s+/gi, ""],
  [/\bthe\s+only\s+(?=[a-z*])/gi, "a "],
  [/\b(?:total|complete)\s+(?=(?:\*)?(?:control|visibility|security|privacy|peace of mind|solution|platform|toolkit|suite|package)\b)/gi, ""],
  [/\beach\s+and\s+every\b/gi, "every"],
  [/\bfor\s+(\*?)every\s*day\b/gi, "for $1daily use"],
  [/\bevery\s*day\b/gi, "daily"],
  [/\bevery\s+(\*?)detail(s?)\b/gi, "the $1details"],
  [/\bevery\s+step\s+of\s+the\s+way\b/gi, "along the way"],
  [/\bevery\s+(\*?)step\b/gi, "$1step by step"],
  [/\bevery\s+(\*?)time\b/gi, "$1time after time"],
  [/\bevery\s+(\*?)angle\b/gi, "$1different angles"],
  [/\bevery\s+(\*?)(shot|scene|moment)\b/gi, (_m, star: string, w: string) => `the ${star}${plural(w)}`],
  [/\bevery\s+(\*?)([a-z]+)\b/gi, (_m, star: string, w: string) => `your ${star}${plural(w)}`],
  // "Each" reads as a totality too: "Each cup made by hand" → "The cups made by hand".
  [/\beach\s+other\b/gi, "one another"],
  [/\beach\s+of\s+((?:\*)?(?:the|your|our|its|their|these|those)\s+\*?[a-z]+\*?)\s+(is|has|was)\b/gi, (_m, what: string, v: string) => `${what} ${{ is: "are", has: "have", was: "were" }[v.toLowerCase()]}`],
  [/\beach\s+of\s+(?=(?:\*)?(?:the|your|our|its|their|these|those)\b)/gi, ""],
  [/\beach\s+one\s+/gi, ""],
  [/\beach\s+(\*?)([a-z]+)\b/gi, (_m, star: string, w: string) => `the ${star}${plural(w)}`],
  [/\s*\beach\b/gi, ""],
  // "Never …" as a promise: "Never settle" → "Don't settle".
  [/\bnever\s+(?=(?:\*)?[a-z])/gi, "don't "],
  [/\bany\s+(\*?)(device|tool|app|platform|browser|screen|stack|workflow|format|channel|language)\b/gi, (_m, star: string, w: string) => `your ${star}${plural(w)}`],
  [/\bof\s+(?:all|any)\s+sizes?\b/gi, "of different sizes"],
  [/\ball\s+of\s+(?=your|the|our|my)\b/gi, ""],
  [/\ball\s+(?=(?:\*)?(?:your|the|our|my|these|those)\b)/gi, ""],
  [/\ball\s+night(?:\s+long)?\b/gi, "through the night"],
  [/\ball\s+set\b/gi, "ready"],
  [/\ball\s+(good|right|along|around|about|at once)\b/gi, "$1"],
  [/\ball\s+over\b/gi, "across"],
  [/\ball\s+of\s+a\s+sudden\b/gi, "suddenly"],
  [/\ball\s+ears\b/gi, "listening"],
  [/\ball\s+but\b/gi, "nearly"],
  [/\ball\s+(?=(?:\*)?[a-z])/gi, ""],
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
  // Awards won ("Winner of the 2024 Design Award").
  /\b(?:winner|winners|won|nominee|nominated)\s+(?:of|for)?\s*(?:the\s+|an?\s+)?[\w\s'-]{0,30}\bawards?\b/i,
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
/**
 * A bare quality or safety word standing in for a feature ("Secure", "Tested", "Fast", "Fully
 * encrypted"): on a fast type tick or a card it reads as a promise with nothing behind it, so
 * claim-safe copy leaves it out. Feature names ("Security", "Encryption", "Reviews") stay.
 */
const CLAIM_WORD =
  /^(?:(?:super|ultra|fully|very|truly|rock|lightning|blazing(?:ly)?|bank|military|enterprise)[- ]?)?(?:secure|safe|safer|fast|faster|speedy|quick|quicker|instant|reliable|trusted|tested|proven|approved|certified|verified|validated|compliant|encrypted|protected|private|accurate|powerful|seamless|effortless|flawless|perfect|best|guaranteed|bulletproof|unbreakable|solid|grade)$/i;
/** A badge on its own ("Editor's Choice", "Bestseller", "Extra", "Premium"): an award or rank claim. */
const BADGE = /^(?:(?:editor|staff|critic|customer|fan|reader|user|shopper|people|crowd)(?:s'|'s|s)?\s*[- ]?(?:choice|pick|favou?rite)|top[- ](?:pick|choice|seller|rated)|best[- ]?sell(?:er|ing)|award[- ]winn(?:er|ing)|acclaimed|must[- ]have|extra|premium|popular|trending|hot)$/i;
export const isClaimWord = (text: string) => {
  const t = text.replace(/[*_.!,]/g, "").replace(/\s+/g, " ").trim();
  return CLAIM_WORD.test(t) || BADGE.test(t);
};

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

/** Clauses whose whole point is a deal: discounts, coupons, refunds, "no credit card". */
const DEAL = /\d+\s?%\s*off\b|\b(?:discount|coupon|promo(?:\s+code)?|voucher|money[- ]back|refund|no credit card|without a credit card|save\s*(?:\$|€|£)\s?\d|(?:\$|€|£)\s?\d+\s*off|free\s+(?:plan|tier|version|account|shipping|delivery|returns?|gift|demo|consultation|quote|sample|month|week|for\s+\d+\s+days?)|free\s+(?:to\s+)?(?:start|use|try|join|download)|free forever)\b/i;

/** Offer wording rewritten as neutral calls to action ("Try for Free!" → "Try it today"). */
const OFFER_RULES: Rule[] = [
  [/\b(?:start|begin|get|claim|activate)\s+(?:your\s+|a\s+|my\s+)?(?:\d+[- ]day\s+)?(?:free\s+)?trial\b/gi, "Get started"],
  [/\b(?:get\s+)?start(?:ed)?\s+(?:for\s+)?free\b/gi, "Get started"],
  [/\btry(\s+(?!for\b)[A-Za-z][\w]*)?\s+(?:it\s+)?(?:for\s+)?free\b/gi, (_m, who?: string) => `Try${who ?? " it"} today`],
  [/\b(sign up|join(?: now)?|download|install|register|get it|create (?:an |your )?account)\s+(?:for\s+)?(?:free|free of charge|at no cost)\b/gi, (_m, verb: string) => verb],
  [/\b(?:it'?s\s+)?(?:totally\s+|completely\s+|100%\s+)?free\s+(?:forever|to\s+(?:start|use|try|join|download|get started))\b/gi, ""],
  [/\bfree\s+(?:plan|tier|version|account|forever|shipping|delivery|returns?|gift|download|demo|consultation|quote|sample|month|week|for\s+\d+\s+days?)\b/gi, ""],
  [/\b(?:\d+[- ]day\s+)?(?:free\s+)?trials?\b/gi, ""],
  [/\b(?:for\s+)?free(?:\s+of\s+charge)?\b|\bat no (?:extra )?cost\b/gi, ""],
];

/**
 * The same line without an offer, so an intro never promises a deal it can't vouch for:
 * clauses about discounts, coupons, refunds or "no credit card" are left out, and "free" /
 * "trial" wording becomes a neutral call to action ("Try for Free!" → "Try it today", "Start
 * your free trial" → "Get started", "Sign up free" → "Sign up"). Lines without an offer are
 * returned as they are; "" means nothing is left.
 */
export function offerSafe(text: string): string;
export function offerSafe(text: string | undefined): string | undefined;
export function offerSafe(text: string | undefined) {
  if (!text || !mentionsOffer(text)) return text;
  // Clauses with their separators ("Ship faster — no credit card"), so the punctuation survives.
  const parts = text.split(/((?<=[.!?])\s+|\s+[—–|·]\s+)/);
  let s = "";
  for (let k = 0; k < parts.length; k += 2) {
    if (DEAL.test(parts[k])) continue;
    s += (s && parts[k - 1] ? parts[k - 1] : "") + parts[k];
  }
  for (const [re, to] of OFFER_RULES) s = s.replace(re, to as string);
  s = tidy(s.replace(/\b(?:for|and|with|or|—|–)\s*(?=[.!?]*$)/i, "")).replace(/^[!.?\s]+/, "");
  // A lone verb or filler isn't a line.
  if (!/[a-z]{2,}/i.test(s.replace(/\*/g, "")) || /^(?:get|try|start|sign|join|and|or|the|it|now)\W*$/i.test(s.replace(/\*/g, "").trim())) return "";
  if (s && /^[A-Z]/.test(text.replace(/^[*\s]+/, ""))) s = s.replace(/^(\**)([a-z])/, (_m, star: string, c: string) => star + c.toUpperCase());
  return s;
}

/** The key a confirmation is stored under (so an edited offer asks again). */
export const offerKey = (text: string) => text.toLowerCase().replace(/[^a-z0-9%$€£]+/g, " ").trim();
