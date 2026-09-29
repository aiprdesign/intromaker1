/**
 * Product concepts: what kind of SaaS this is (developer tool, AI product, fintech, security,
 * CRM…). Best-in-class launch videos in each category follow a recognisable arc, speak in its
 * vocabulary and use its iconography. Detecting the concept lets the director adapt the story
 * order, chapter labels, CTA wording, icon family and recommended style automatically.
 */

export type ConceptRole =
  | "pain"
  | "hook"
  | "reveal"
  | "meet"
  | "how"
  | "tour"
  | "features"
  | "bento"
  | "cards"
  | "stat"
  | "quote"
  | "logos"
  | "integrations"
  | "promise"
  | "demo"
  | "metric"
  | "gallery"
  | "cta";

export interface Concept {
  id: string;
  name: string;
  /** Keywords; each hit in the site/prompt copy scores a point (tagline and description count double). */
  keywords: RegExp;
  /** Icon family (Lucide names) for this category, most characteristic first. */
  icons: string[];
  /** Icons for the integrations orbit (generic tool categories this product connects to). */
  orbit: string[];
  /** Story order of beats (roles) for this category's typical launch film. */
  arc: ConceptRole[];
  /** Chapter labels (eyebrows) in this category's voice. */
  eyebrows: Partial<Record<ConceptRole, string>>;
  /** Headline for the feature-icons beat. */
  featuresTitle: string;
  /** CTA headline options; {name} is the product name. */
  cta: string[];
  /** Style template that suits the category best. */
  template: string;
  /** Positioning line for the word-swap beat ("Ship faster|safer|together"). */
  swap: string;
}

const STORY: ConceptRole[] = ["pain", "hook", "reveal", "meet", "how", "tour", "features", "bento", "quote", "logos", "cards", "integrations", "cta"];

export const CONCEPTS: Concept[] = [
  {
    id: "devtools",
    name: "Developer tool",
    keywords: /\b(developers?|api|sdk|code|coding|deploy|deployment|git|ci\/cd|infrastructure|kubernetes|terminal|cli|open[- ]source|repo(sitor(y|ies))?|framework|serverless|backend|frontend|devops|engineering teams?)\b/g,
    icons: ["CodeXml", "SquareTerminal", "GitBranch", "Rocket", "Server", "Webhook"],
    orbit: ["GitBranch", "Database", "Cloud", "Server", "Webhook", "MessagesSquare", "Bug", "Container"],
    arc: ["pain", "hook", "reveal", "meet", "how", "tour", "features", "integrations", "cards", "stat", "quote", "logos", "bento", "cta"],
    eyebrows: { how: "Get started", tour: "Developer experience", features: "Built for developers", integrations: "Works with your stack", cards: "Performance" },
    featuresTitle: "Built for how you *ship*",
    cta: ["Start *building*", "Try *{name}*", "Ship with *{name}*"],
    template: "midnight",
    swap: "Your code, built|tested|shipped",
  },
  {
    id: "ai",
    name: "AI product",
    keywords: /\b(ai|a\.i\.|artificial intelligence|gpt|llms?|agents?|copilot|generative|machine learning|assistant|prompts?|models?|autopilot|intelligent)\b/g,
    icons: ["Sparkles", "BrainCircuit", "Bot", "WandSparkles", "Zap", "MessageSquareText"],
    orbit: ["FileText", "Mail", "MessagesSquare", "Database", "CalendarCheck", "Globe", "Image", "Code"],
    arc: ["hook", "pain", "reveal", "tour", "features", "how", "cards", "quote", "logos", "integrations", "bento", "meet", "cta"],
    eyebrows: { tour: "See it in action", features: "What it can do", how: "How it works", hook: "Introducing" },
    featuresTitle: "AI that *works with you*",
    cta: ["Try it *free*", "Meet your *AI teammate*", "Start with *{name}*"],
    template: "aiglow",
    swap: "Your work, drafted|summarised|automated",
  },
  {
    id: "fintech",
    name: "Fintech",
    keywords: /\b(payments?|bank(ing)?|financ(e|ial)|invoic(e|es|ing)|billing|accounting|expenses?|payroll|cards?|wallets?|crypto|treasury|money|spend(ing)?|transactions?|cash ?flow)\b/g,
    icons: ["CreditCard", "Landmark", "Coins", "Receipt", "ShieldCheck", "TrendingUp"],
    orbit: ["Landmark", "CreditCard", "Receipt", "FileSpreadsheet", "Calculator", "Wallet", "Mail", "Database"],
    arc: ["pain", "hook", "reveal", "meet", "tour", "features", "cards", "stat", "quote", "logos", "how", "integrations", "bento", "cta"],
    eyebrows: { features: "Built for finance teams", cards: "Real results", tour: "Your money, one view" },
    featuresTitle: "Finance, *organised*",
    cta: ["Open an *account*", "Get started *free*", "Take control with *{name}*"],
    template: "aurora",
    swap: "Your spend, tracked|approved|reported",
  },
  {
    id: "security",
    name: "Security",
    keywords: /\b(secur(e|ity)|threats?|complian(ce|t)|soc ?2|zero[- ]trust|identity|encrypt(ion|ed)?|vulnerab(ility|ilities)|siem|endpoints?|fraud|attacks?|breach(es)?|firewall|malware)\b/g,
    icons: ["ShieldCheck", "LockKeyhole", "Fingerprint", "Radar", "BadgeCheck", "Activity"],
    orbit: ["Cloud", "Server", "Laptop", "Smartphone", "Fingerprint", "Mail", "Database", "Network"],
    arc: ["pain", "hook", "reveal", "tour", "features", "cards", "stat", "logos", "quote", "how", "integrations", "meet", "bento", "cta"],
    eyebrows: { pain: "The threat", features: "Protection", logos: "Security teams", cards: "Detection" },
    featuresTitle: "Security, *by design*",
    cta: ["Book a *demo*", "See it in *action*", "Try *{name}*"],
    template: "hud",
    swap: "Your systems, monitored|reviewed|logged",
  },
  {
    id: "analytics",
    name: "Analytics & data",
    keywords: /\b(analytics|dashboards?|insights?|metrics?|bi|business intelligence|data|reporting|reports?|warehouse|visuali[sz]ation|kpis?|charts?)\b/g,
    icons: ["ChartNoAxesCombined", "ChartPie", "Database", "TrendingUp", "Gauge", "Table"],
    orbit: ["Database", "FileSpreadsheet", "Cloud", "CreditCard", "Megaphone", "Users", "Webhook", "Mail"],
    arc: ["pain", "hook", "reveal", "tour", "cards", "features", "how", "integrations", "quote", "logos", "meet", "bento", "cta"],
    eyebrows: { cards: "Insights", features: "What's inside", integrations: "Connect your sources" },
    featuresTitle: "Answers, *not spreadsheets*",
    cta: ["See your *data*", "Start *free*", "Get insights with *{name}*"],
    template: "midnight",
    swap: "Your data, explored|measured|shared",
  },
  {
    id: "sales",
    name: "Sales & CRM",
    keywords: /\b(crm|sales|pipelines?|deals?|leads?|prospect(s|ing)?|quota|revenue teams?|reps|outreach|close (more )?deals)\b/g,
    icons: ["Handshake", "TrendingUp", "Target", "Users", "Mail", "Phone"],
    orbit: ["Mail", "Phone", "CalendarCheck", "MessagesSquare", "Users", "Database", "FileText", "Video"],
    arc: ["pain", "hook", "reveal", "meet", "how", "tour", "features", "cards", "quote", "logos", "integrations", "bento", "cta"],
    eyebrows: { features: "Built for revenue teams", cards: "Results", logos: "Trusted by sales teams" },
    featuresTitle: "Your pipeline, *organised*",
    cta: ["Book a *demo*", "Sell with *{name}*", "Start *free*"],
    template: "enterprise",
    swap: "Your deals, tracked|organised|shared",
  },
  {
    id: "marketing",
    name: "Marketing",
    keywords: /\b(marketing|campaigns?|email marketing|seo|social media|ads|advertis(ing|ers)|audiences?|newsletters?|content|creators?|brand awareness|growth)\b/g,
    icons: ["Megaphone", "Mail", "Search", "Heart", "TrendingUp", "Target"],
    orbit: ["Mail", "Search", "Heart", "Image", "Video", "ChartPie", "ShoppingCart", "MessagesSquare"],
    arc: ["hook", "pain", "reveal", "tour", "features", "cards", "quote", "logos", "how", "integrations", "bento", "meet", "cta"],
    eyebrows: { features: "Features", cards: "Campaigns" },
    featuresTitle: "Marketing, *organised*",
    cta: ["Grow your *audience*", "Start *free*", "Launch with *{name}*"],
    template: "pop",
    swap: "Your campaigns, planned|launched|measured",
  },
  {
    id: "productivity",
    name: "Collaboration & productivity",
    keywords: /\b(collaborat(e|ion|ive)|projects?|tasks?|workspaces?|docs|notes|wiki|meetings?|kanban|productivity|remote|async|organi[sz]e)\b/g,
    icons: ["Users", "SquareKanban", "ListChecks", "MessagesSquare", "CalendarCheck", "FileText"],
    orbit: ["MessagesSquare", "CalendarCheck", "FileText", "Mail", "Video", "Folder", "GitBranch", "PenTool"],
    arc: ["hook", "pain", "reveal", "meet", "tour", "features", "how", "integrations", "quote", "logos", "cards", "bento", "cta"],
    eyebrows: { features: "All in one place", integrations: "Works with your tools" },
    featuresTitle: "Your work, *in one place*",
    cta: ["Get started *free*", "Try it with your *team*", "Work with *{name}*"],
    template: "frosted",
    swap: "Your work, planned|tracked|shared",
  },
  {
    id: "hr",
    name: "HR & recruiting",
    keywords: /\b(hr|hiring|hire|recruit(ing|ment|ers)?|talent|employees?|payroll|onboard(ing)?|people ops|benefits|candidates?|workforce)\b/g,
    icons: ["UserPlus", "Users", "Briefcase", "CalendarCheck", "Award", "Smile"],
    orbit: ["Mail", "CalendarCheck", "Video", "FileText", "Landmark", "MessagesSquare", "Users", "Signature"],
    arc: ["pain", "hook", "reveal", "meet", "how", "tour", "features", "quote", "logos", "cards", "integrations", "bento", "cta"],
    eyebrows: { features: "Built for people teams", how: "How it works" },
    featuresTitle: "Hire and grow your *people*",
    cta: ["Book a *demo*", "Start *free*", "Build your team with *{name}*"],
    template: "clay",
    swap: "Your hiring, organised|scheduled|tracked",
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    keywords: /\b(shops?|stores?|e-?commerce|checkout|carts?|orders?|inventory|merchants?|sell(ing)? online|shopify|retail|fulfil(l)?ment|shipping)\b/g,
    icons: ["Store", "ShoppingCart", "Truck", "CreditCard", "Tag", "Boxes"],
    orbit: ["CreditCard", "Truck", "Mail", "Megaphone", "Boxes", "ChartPie", "Image", "Receipt"],
    arc: ["hook", "reveal", "tour", "features", "cards", "quote", "logos", "how", "integrations", "pain", "bento", "meet", "cta"],
    eyebrows: { features: "Sell more", cards: "Results" },
    featuresTitle: "Tools to *run your store*",
    cta: ["Start *selling*", "Open your *store*", "Sell with *{name}*"],
    template: "pop",
    swap: "Your orders, listed|shipped|tracked",
  },
  {
    id: "health",
    name: "Health",
    keywords: /\b(health(care)?|patients?|clinic(s|al|ians?)?|medical|doctors?|telehealth|patient care|wellness|therapy|hospital|providers?|prescriptions?|care team|appointments?|visits?|symptoms?|insomnia|anxiety|nurses?)\b/g,
    icons: ["HeartPulse", "Stethoscope", "CalendarCheck", "ShieldCheck", "Users", "Pill"],
    orbit: ["CalendarCheck", "Video", "FileText", "ShieldCheck", "MessagesSquare", "CreditCard", "Pill", "Smartphone"],
    arc: ["pain", "hook", "reveal", "meet", "how", "features", "tour", "quote", "logos", "cards", "integrations", "bento", "cta"],
    eyebrows: { features: "Care tools", how: "How it works" },
    featuresTitle: "Care, *simplified*",
    cta: ["Book a *demo*", "Get *started*", "Care with *{name}*"],
    template: "paper",
    swap: "Your care, scheduled|recorded|followed up",
  },
  {
    id: "education",
    name: "Education",
    keywords: /\b(learn(ing|ers)?|courses?|students?|teachers?|education|school|training|lms|tutor(ing)?|lessons?|classroom)\b/g,
    icons: ["GraduationCap", "BookOpen", "Lightbulb", "Trophy", "Users", "Video"],
    orbit: ["Video", "BookOpen", "CalendarCheck", "MessagesSquare", "FileText", "Trophy", "Smartphone", "Mail"],
    arc: ["hook", "pain", "reveal", "tour", "features", "how", "quote", "logos", "cards", "integrations", "bento", "meet", "cta"],
    eyebrows: { features: "Learning tools", how: "How it works" },
    featuresTitle: "Learning that *sticks*",
    cta: ["Start *learning*", "Try it *free*", "Learn with *{name}*"],
    template: "frosted",
    swap: "Your courses, planned|published|tracked",
  },
  {
    id: "creative",
    name: "Design & creative",
    keywords: /\b(design(ers)?|creative|video editing|photos?|editor|brand(ing)?|prototyp(e|ing)|canvas|illustrat(e|ion)|render(ing)?|animation|mockups?|figma)\b/g,
    icons: ["Palette", "PenTool", "Image", "Clapperboard", "Layers", "WandSparkles"],
    orbit: ["Image", "Video", "PenTool", "Palette", "Folder", "MessagesSquare", "Cloud", "Shapes"],
    arc: ["hook", "reveal", "tour", "features", "cards", "quote", "logos", "how", "integrations", "pain", "bento", "meet", "cta"],
    eyebrows: { features: "Create anything", tour: "See it in action" },
    featuresTitle: "Made for *creators*",
    cta: ["Start *creating*", "Try it *free*", "Create with *{name}*"],
    template: "holo",
    swap: "Your ideas, sketched|designed|shared",
  },
  {
    id: "communication",
    name: "Communication & support",
    keywords: /\b(chat|messaging|messages?|calls?|video calls?|inbox|support|help ?desk|customer (support|service)|tickets?|conversations?|live chat)\b/g,
    icons: ["MessagesSquare", "Headset", "Phone", "Video", "Mail", "Bell"],
    orbit: ["Mail", "Phone", "MessagesSquare", "Smartphone", "Globe", "Database", "Bot", "CalendarCheck"],
    arc: ["pain", "hook", "reveal", "tour", "features", "how", "integrations", "quote", "logos", "cards", "bento", "meet", "cta"],
    eyebrows: { features: "Every conversation", integrations: "Every channel" },
    featuresTitle: "Every conversation, *one inbox*",
    cta: ["Try it *free*", "Support customers with *{name}*", "Get *started*"],
    template: "neon",
    swap: "Your inbox, sorted|routed|answered",
  },
];

export const GENERAL: Concept = {
  id: "general",
  name: "SaaS product",
  keywords: /$^/g,
  icons: ["Sparkles", "Zap", "ChartNoAxesCombined", "Layers", "ShieldCheck", "Users"],
  orbit: ["Mail", "MessagesSquare", "CalendarCheck", "Database", "Cloud", "FileText", "CreditCard", "GitBranch"],
  arc: STORY,
  eyebrows: {},
  featuresTitle: "What's *inside*",
  cta: ["Try *{name}* today", "Get started with *{name}*", "Start building with *{name}*"],
  template: "midnight",
  swap: "Your work, planned|built|shared",
};

export const CONCEPT_MAP: Record<string, Concept> = Object.fromEntries([...CONCEPTS, GENERAL].map((c) => [c.id, c]));

/** Score every concept against the copy; weak or tied evidence falls back to "general". */
export function detectConcept(primary: string, secondary = ""): Concept {
  let best = GENERAL;
  let bestScore = 0;
  for (const c of CONCEPTS) {
    const hits = (s: string) => (s.toLowerCase().match(c.keywords) ?? []).length;
    const score = hits(primary) * 2 + hits(secondary);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : GENERAL;
}

/** Chapter icon per story role (shown inside the eyebrow pill). */
export const ROLE_ICONS: Partial<Record<ConceptRole, string>> = {
  pain: "TriangleAlert",
  hook: "Sparkles",
  meet: "Laptop",
  how: "Route",
  tour: "MousePointerClick",
  features: "Blocks",
  bento: "LayoutGrid",
  cards: "ChartNoAxesCombined",
  stat: "TrendingUp",
  quote: "Star",
  logos: "Building2",
  integrations: "Plug",
  promise: "Zap",
  demo: "MousePointerClick",
  metric: "TrendingUp",
  gallery: "Images",
};

/**
 * The signature interaction moment for each category, as the best launch films in it stage
 * one: Linear/Raycast open a command palette, AI products stream an answer, automation tools
 * finish a whole checklist in one click, and commerce/sales/security tools show the product
 * alive with a stack of notifications. The copy is generic UI of the category (commands,
 * tasks, events), never a claim about the product; the first command / the prompt's answer
 * is filled from the product's real features by the director.
 */
export interface DemoSpec {
  skill: "command-k" | "ai-prompt" | "click-flow" | "notify-stack";
  title: string;
  eyebrow: string;
  /** click-flow: the button label. */
  action?: string;
  /** command-k: supporting commands; click-flow: tasks; notify-stack: "Event — detail"; ai-prompt: [prompt]. */
  items: string[];
}

const PALETTE_CMDS = ["Search your workspace", "Invite a teammate", "Open settings"];

export const DEMOS: Record<string, DemoSpec> = {
  devtools: { skill: "command-k", title: "Your tools, one *keystroke* away", eyebrow: "Keyboard-first", items: ["View deploy logs", "Open preview URL", "Search docs"] },
  productivity: { skill: "command-k", title: "Your tools, one *keystroke* away", eyebrow: "Keyboard-first", items: PALETTE_CMDS },
  ai: { skill: "ai-prompt", title: "Just *ask*.", eyebrow: "AI built in", items: ["What can you do, {name}?"] },
  fintech: {
    skill: "click-flow", title: "Month-end, *handled*", eyebrow: "Automations", action: "Approve all",
    items: ["Match receipts", "Categorise spend", "Sync to accounting", "Notify finance"],
  },
  analytics: {
    skill: "click-flow", title: "Insights, *on demand*", eyebrow: "In action", action: "Generate report",
    items: ["Pull the latest data", "Build the charts", "Spot the trends", "Share with the team"],
  },
  hr: {
    skill: "click-flow", title: "Hiring admin, *handled*", eyebrow: "Automations", action: "Send offers",
    items: ["Collect approvals", "Generate offer letters", "Send for e-signature", "Schedule onboarding"],
  },
  health: {
    skill: "click-flow", title: "Scheduling, *handled*", eyebrow: "In action", action: "Confirm",
    items: ["Check availability", "Book the appointment", "Send reminders", "Update the record"],
  },
  education: {
    skill: "click-flow", title: "Your course, *live*", eyebrow: "In action", action: "Publish",
    items: ["Upload lessons", "Build the quizzes", "Invite students", "Track progress"],
  },
  creative: {
    skill: "click-flow", title: "From idea to *live*", eyebrow: "In action", action: "Publish",
    items: ["Export the assets", "Optimise for web", "Share with the team", "Go live"],
  },
  general: {
    skill: "click-flow", title: "Busywork, *handled*", eyebrow: "In action", action: "Run",
    items: ["Sync your data", "Update the records", "Notify the team", "Share the summary"],
  },
  sales: {
    skill: "notify-stack", title: "Your pipeline, *alive*", eyebrow: "Live",
    items: ["Meeting booked — Discovery call, Thursday 10:00", "Lead assigned — Routed to the right rep", "Follow-up sent — Sequence step 2 of 4", "Deal won — Moved to closed-won"],
  },
  marketing: {
    skill: "notify-stack", title: "Campaigns that *keep running*", eyebrow: "Live",
    items: ["Campaign live — Sent to your audience", "New subscribers — Your list just grew", "A/B test winner — Variant B picked", "Report ready — This week's results are in"],
  },
  ecommerce: {
    skill: "notify-stack", title: "Your store, *live*", eyebrow: "Live",
    items: ["New order — 2 items, ships today", "Payment received — Order confirmed", "Order shipped — Tracking sent to customer", "New review — From a customer"],
  },
  security: {
    skill: "notify-stack", title: "Alerts, *in real time*", eyebrow: "Live",
    items: ["Alert raised — Unusual login flagged", "Device verified — Access granted", "Evidence collected — Control checked", "Report ready — Weekly summary"],
  },
  communication: {
    skill: "notify-stack", title: "Every conversation, *one place*", eyebrow: "Live",
    items: ["New message — The team replied", "You were mentioned — In #launch", "Call starting — The team is joining", "Thread resolved — Marked done"],
  },
};
