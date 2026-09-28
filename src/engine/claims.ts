/**
 * Claim-safe copy. Launch films are advertising, so the words on screen and in the voice-over
 * stay generic: no superlatives ("the best", "#1", "world's fastest"), no absolutes or guarantees
 * ("100%", "guaranteed", "never miss"), no speed or multiplier claims ("in seconds", "10x faster")
 * and no social-proof numbers ("trusted by 12,000+ teams"). The site's own wording is kept where
 * it's neutral and softened where it isn't.
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
  [new RegExp(`(?:\\*)?(?<![\\w#])(?:${SUPERLATIVE})(?:\\*)?(?=[\\s,.!?—–-]|$)\\s*`, "gi"), ""],
  // Comparatives with nothing to compare against ("Ship faster", "a better way to").
  [/\b(?:a|the)\s+(?:\*)?(?:better|faster|smarter|easier|simpler|quicker)(?:\*)?\s+(way|place|tool|platform|app)\s+to\b/gi, (_m, noun: string) => `a new ${noun} to`],
  [/\s*(?:\*)?\b(?:faster|smarter|better|quicker|easier|cheaper)\b(?:\*)?(?!\s+than)/gi, ""],
  // Absolutes and guarantees.
  [/\b100\s?%\s*/g, ""],
  [/\b(?:guaranteed|guarantees?|risk[- ]free|foolproof|bulletproof|forever)\b\s*/gi, ""],
  [/\bnever\s+miss\s+(?:a|an|another)\s+([a-z]+?)(?:s)?(?:\s+again)?\b/gi, (_m, w: string) => `keep track of ${w}s`],
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
  return /\d[\d,.]*\s*[kmb]?\+|\d\s?%|\b\d+(?:\.\d+)?\s?[x×]\b|\b\d(?:\.\d)?\s?\/\s?5\b|\b\d[\d,.]*\s*(?:[kmb]\s+)?(?:teams?|customers?|companies|users?|businesses|developers|people|brands|merchants|members|orgs?|organizations|downloads|installs|reviews)\b/i.test(text);
}

/** Does this line still make a claim? (Used by the self-review.) */
export function hasClaim(text: string | undefined) {
  if (!text) return false;
  return safeCopy(text) !== tidy(text) || isNumericClaim(text);
}
