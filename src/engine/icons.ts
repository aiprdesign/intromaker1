/**
 * Icon system: Lucide icons (ISC, https://lucide.dev) drawn as crisp canvas vector paths,
 * with an optional "draw-on" stroke animation, plus a matcher that picks the icon a designer
 * would for a feature's wording, falling back to the product concept's own icon family.
 */
import { LUCIDE, type IconNode } from "./lucide-set";

const pathCache = new Map<string, Path2D[]>();

/** Convert one Lucide element (path, circle, rect, line, polyline, polygon, ellipse) to a Path2D. */
function toPath(tag: string, a: Record<string, string | number | undefined>): Path2D | null {
  const n = (k: string) => Number(a[k] ?? 0);
  switch (tag) {
    case "path":
      return new Path2D(String(a.d ?? ""));
    case "circle": {
      const p = new Path2D();
      p.arc(n("cx"), n("cy"), n("r"), 0, Math.PI * 2);
      return p;
    }
    case "ellipse": {
      const p = new Path2D();
      p.ellipse(n("cx"), n("cy"), n("rx"), n("ry"), 0, 0, Math.PI * 2);
      return p;
    }
    case "rect": {
      const p = new Path2D();
      const r = Number(a.rx ?? a.ry ?? 0);
      p.roundRect(n("x"), n("y"), n("width"), n("height"), r);
      return p;
    }
    case "line":
      return new Path2D(`M${n("x1")} ${n("y1")}L${n("x2")} ${n("y2")}`);
    case "polyline":
    case "polygon": {
      const pts = String(a.points ?? "").trim().split(/[\s,]+/).map(Number);
      let d = "";
      for (let i = 0; i + 1 < pts.length; i += 2) d += `${i ? "L" : "M"}${pts[i]} ${pts[i + 1]}`;
      return new Path2D(tag === "polygon" ? d + "Z" : d);
    }
    default:
      return null;
  }
}

function paths(name: string) {
  let hit = pathCache.get(name);
  if (!hit) {
    const node: IconNode | undefined = LUCIDE[name] ?? LUCIDE.Sparkles;
    hit = node.map(([tag, attrs]) => toPath(tag, attrs)).filter((p): p is Path2D => !!p);
    pathCache.set(name, hit);
  }
  return hit;
}

export const hasIcon = (name: string) => !!LUCIDE[name];

/**
 * Draw a Lucide icon centred at (cx, cy) in a size×size box. `progress` < 1 draws the strokes
 * on progressively (line-art reveal); `weight` scales the stroke width.
 */
export function drawLucide(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  size: number,
  color: string,
  opts: { progress?: number; weight?: number; glow?: string } = {},
) {
  const s = size / 24;
  const p = Math.max(0, Math.min(1, opts.progress ?? 1));
  if (p <= 0) return;
  ctx.save();
  ctx.translate(cx - 12 * s, cy - 12 * s);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * (opts.weight ?? 1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = 8;
  }
  if (p < 1) {
    ctx.setLineDash([80, 80]);
    ctx.lineDashOffset = 80 * (1 - p);
  }
  for (const path of paths(name)) ctx.stroke(path);
  ctx.restore();
}

/** Wording → icon, most specific first. */
const KEYWORDS: [RegExp, string][] = [
  // Everyday products (food, fitness, travel, events, music, homes, giving): specific nouns first.
  [/\b(bakery|bakeries|baker|pastr|bread|croissant)/, "Croissant"],
  [/\b(cake|dessert|sweet treat)/, "CakeSlice"],
  [/\b(coffee|caf(e|é)|espresso|latte)/, "Coffee"],
  [/\bpizza/, "Pizza"],
  [/\b(recipe|cook|kitchen|chef)/, "ChefHat"],
  [/\b(nutrition|calorie|diet|healthy eating|salad|meal plan)/, "Salad"],
  [/\b(table booking|book a table|reservation|concierge)/, "ConciergeBell"],
  [/\b(salon|haircut|barber|stylist)/, "Scissors"],
  [/\b(streak|burn)/, "Flame"],
  [/\b(timer|interval|countdown)/, "Timer"],
  [/\b(steps|walking|running|runner)\b/, "Footprints"],
  [/\b(cycling|bike|ride)/, "Bike"],
  [/\b(sleep|bedtime|meditat|mindful)/, "Moon"],
  [/\b(hotel|accommodation|lodging|stays)\b/, "Hotel"],
  [/\b(luggage|packing|suitcase|baggage)/, "Luggage"],
  [/\b(itinerar|destination|adventure|explorer)/, "Compass"],
  [/\b(ticketing|e-?tickets?|event tickets?|concert|festival|gig)/, "Ticket"],
  [/\b(party|celebrat|wedding|birthday)/, "PartyPopper"],
  [/\b(playlists?|albums?|songs?)\b/, "ListMusic"],
  [/\b(music|musician|artist|band)s?\b/, "Music"],
  [/\b(podcast|microphone)/, "Mic"],
  [/\b(radio|broadcast)/, "Radio"],
  [/\b(listing|rental|tenant|landlord|lease|move in)/, "KeyRound"],
  [/\b(mortgage|loan)/, "Landmark"],
  [/\bvolunteer/, "Users"],
  [/\bsupporters?\b/, "Heart"],
  [/\b(donat|fundrais|charit|nonprofit)/, "HandHeart"],
  [/\b(parcel|package|shipment)/, "Package"],
  [/\b(route|dispatch|fleet|driver)/, "Route"],
  [/\b(dog walk|dogs?|pupp(y|ies))\b/, "Dog"],
  [/\b(cats?|kittens?)\b/, "Cat"],
  [/\b(pets?|vets?|groom)/, "PawPrint"],
  [/\b(fashion|cloth|apparel|outfit|wardrobe)/, "Shirt"],
  [/\b(furniture|interior|decor)/, "Sofa"],
  [/\b(repair|maintenance|handyman|plumb)/, "Wrench"],
  [/\b(version history|versions|history|undo|restore|rollback)/, "History"],
  [/\b(galler|portfolio)/, "Images"],
  [/\b(camera|photographer|photo shoot)/, "Camera"],
  [/\b(hike|hiking|outdoor|trail|climb)/, "Mountain"],
  [/\b(camp|camping)\b/, "Tent"],
  [/\b(bus|transit|commute)\b/, "Bus"],
  [/\b(sail|boat|cruise)/, "Sailboat"],
  [/\b(guest check-?in|qr code|scan to)/, "QrCode"],
  [/\b(certificate|diploma|badge)/, "Award"],
  [/\b(contract|e-?signature|sign here)/, "FileSignature"],
  [/\b(ai|gpt|llm|copilot|assistant|agent)s?\b/, "Sparkles"],
  [/\b(machine learning|model|neural|intelligen)/, "BrainCircuit"],
  [/\b(bot|chatbot)\b/, "Bot"],
  [/\b(deals?|sales|close|closing|crm|leads?|prospect)/, "Handshake"],
  [/\b(automat|workflow|no-code|nocode|zap)/, "Workflow"],
  [/\b(jobs?|job posts?|vacanc|careers?|openings?)\b/, "Briefcase"],
  [/\b(preview|previews|staging)\b/, "Eye"],
  [/\b(edge|cdn|regions?)\b/, "Globe"],
  [/\b(functions?|serverless|lambda)\b/, "Cloud"],
  [/\b(audit logs?|logs?|logging|activity feed|audit trail)\b/, "FileCheck"],
  [/\b(access|permissions?|roles?|rbac|sharing controls?)\b/, "Key"],
  [/\b(alerts?|notif|remind)/, "BellRing"],
  [/\b(launch|ship(?!p)|deploy|release|go live)/, "Rocket"],
  [/\b(secur|protect|threat|attack|malware|firewall)/, "ShieldCheck"],
  [/\b(privacy|encrypt|password|credential|secret)/, "LockKeyhole"],
  [/\b(sso|login|auth|identity|passkey|biometric)/, "Fingerprint"],
  [/\b(complian|soc ?2|gdpr|hipaa|iso|audit|certif)/, "BadgeCheck"],
  [/\b(monitor|observab|incident|uptime|status)/, "Activity"],
  [/\b(analytic|insight|report|metric|kpi|dashboard|chart|stats)/, "ChartNoAxesCombined"],
  [/\b(forecast|growth|revenue|grow|increase|boost|progress)/, "TrendingUp"],
  [/\b(data|database|warehouse|sql|query)/, "Database"],
  [/\b(api|sdk|endpoint|webhook)/, "Webhook"],
  [/\b(code|developer|dev\b|engineer|repos?\b|repositor)/, "CodeXml"],
  [/\b(terminal|cli|command|shell)/, "SquareTerminal"],
  [/\b(git|branch|merge|pull request|version control)/, "GitBranch"],
  [/\b(bug|debug|error|crash|test)/, "Bug"],
  [/\b(cloud|serverless|hosting|host)/, "Cloud"],
  [/\b(server|infra|kubernetes|container|docker)/, "Server"],
  [/\b(integrat|connect|plug|plugin|extension|marketplace)/, "Plug"],
  [/\b(backup|storage|file|upload|drive)/, "CloudUpload"],
  [/\b(document|doc|note|write|content|wiki)/, "FileText"],
  [/\b(sign|contract|e-?sign|agreement)/, "Signature"],
  [/\b(team|collab|together|people|member|share)/, "Users"],
  [/\b(customer|client|user)s?\b/, "UserCheck"],
  [/\b(hire|hiring|recruit|talent|candidate|onboard)/, "UserPlus"],
  [/\b(saved (?:responses|replies)|canned|snippets?|macros?)\b/, "MessageSquareText"],
  [/\b(chat|message|messag|comment|repl(?:y|ies)|inbox|responses?)/, "MessagesSquare"],
  [/\b(support|help ?desk|ticket|service)/, "Headset"],
  [/\b(email|mail|newsletter)/, "Mail"],
  [/\b(call|phone|voice)/, "Phone"],
  [/\b(meeting|video|stream|webinar)/, "Video"],
  [/\b(schedul|calendar|booking|appointment|event)/, "CalendarCheck"],
  [/\b(approv|sign[- ]offs?)/, "ClipboardCheck"],
  [/\b(task|todo|to-do|checklist|project)/, "ListChecks"],
  [/\b(board|kanban|sprint|roadmap)/, "SquareKanban"],
  [/\b(goal|okr|target|objective)/, "Target"],
  [/\b(payroll|salar(?:y|ies)|wages?)\b/, "Banknote"],
  [/\b(payment|pay\b|pay |checkout|card|stripe)/, "CreditCard"],
  [/\b(invoice|billing|receipt|expense)/, "Receipt"],
  [/\b(bank|banking|account|treasury)/, "Landmark"],
  [/\b(money|cash|price|pricing|cost|save money|savings?)\b/, "Coins"],
  [/\b(wallet|crypto|token)/, "Wallet"],
  [/\b(transfer|exchange|swap|convert)/, "ArrowLeftRight"],
  [/\b(shop|store|ecommerce|e-commerce|sell|seller)/, "Store"],
  [/\b(cart|order|purchase|buy|grocer|shopping list)/, "ShoppingCart"],
  [/\b(pipelines?|funnels?|conversions?)\b/, "Filter"],
  [/\b(ship|shipping|deliver|logistic|fulfil)/, "Truck"],
  [/\b(inventory|product|catalog|sku)/, "Boxes"],
  [/\b(marketing|campaign|promot|ads?|advertis)/, "Megaphone"],
  [/\b(seo|search|find|discover)/, "Search"],
  [/\b(social|community|audience|follower)/, "Heart"],
  [/\b(design|creative|brand)/, "Palette"],
  [/\b(edit|draw|illustrat|vector)/, "PenTool"],
  [/\b(photo|image|picture)/, "Image"],
  [/\b(video edit|film|movie|clip)/, "Clapperboard"],
  [/\b(audio|podcast|sound|music)/, "AudioLines"],
  [/\b(caption|subtitle|transcri)/, "Captions"],
  [/\b(translat|language|multilingual)/, "Languages"],
  [/\b(mobile|apps?\b|ios|android|phone app)/, "Smartphone"],
  [/\b(desktop|laptop|computer)/, "Laptop"],
  [/\b(health|patient|clinic|care|medical)/, "HeartPulse"],
  [/\b(doctor|telehealth)/, "Stethoscope"],
  [/\b(learn|course|student|teach|education|training)/, "GraduationCap"],
  [/\b(read|book|library|knowledge)/, "BookOpen"],
  [/\b(legal|law|lawyer)/, "Scale"],
  [/\b(travel|trip|flight)/, "Plane"],
  [/\b(map|location|place|local)/, "MapPin"],
  [/\b(home|house|property|real estate)/, "House"],
  [/\b(food|restaurant|menu|meal)/, "Utensils"],
  [/\b(fitness|workout|gym)/, "Dumbbell"],
  [/\b(games?|gaming|gamers?|play(ers)?)\b/, "Gamepad2"],
  [/\b(green|climate|carbon|sustain)/, "Leaf"],
  [/\b(research|science|lab|experiment)/, "FlaskConical"],
  [/\b(template|layout|page|website|site)/, "LayoutDashboard"],
  [/\b(component|block|build)/, "Blocks"],
  [/\b(network|node|graph)/, "Network"],
  [/\b(price|discount|coupon|offer)/, "Percent"],
  [/\b(gift|reward|loyalty|referral)/, "Gift"],
  [/\b(spreadsheet|table|csv)/, "FileSpreadsheet"],
  [/\b(qr|scan)/, "ScanLine"],
  // Generic modifiers last: a specific noun (invoice, deploy, team…) wins over "fast" or "time".
  [/\b(fast|speed|instant|quick|lightning|performance|latency|second)/, "Zap"],
  [/\b(sync|real-?time|live|update)/, "RefreshCw"],
  [/\b(time|hour|minute|clock|deadline)/, "Clock"],
  [/\b(global|world|anywhere|international|countr|region)/, "Earth"],
  [/\b(idea|inspir|brainstorm)/, "Lightbulb"],
  [/\b(custom|config|setting|flexib)/, "SlidersHorizontal"],
  [/\b(scale|scalab|enterprise|infinite)/, "Infinity"],
  [/\b(reliab|trust|trusted|proven)/, "Award"],
  [/\b(award|best|win|top)/, "Trophy"],
  [/\b(simple|easy|effortless|intuitive)/, "WandSparkles"],
  [/\b(click|one-click|drag)/, "MousePointerClick"],
];

/** Keywords from here on are modifiers ("fast", "live", "global"): they only pick an icon when no noun does. */
const GENERIC_FROM = KEYWORDS.findIndex(([re]) => re.test("fast"));

/** Related icons to use when the best one is already taken by another tile. */
const ALTERNATIVES: Record<string, string[]> = {
  ChartNoAxesCombined: ["ChartLine", "ChartColumn", "ChartPie", "ChartBar", "Gauge"],
  TrendingUp: ["ChartLine", "ChartColumn", "Target"],
  Users: ["UserCheck", "UserPlus", "Handshake"],
  UserPlus: ["UserCheck", "Briefcase", "Users"],
  UserCheck: ["Users", "BadgeCheck"],
  ListChecks: ["ClipboardCheck", "CircleCheck", "SquareKanban"],
  SquareKanban: ["Kanban", "FolderKanban", "ListChecks"],
  CalendarCheck: ["CalendarDays", "CalendarClock", "Calendar", "Clock"],
  MessagesSquare: ["MessageSquareText", "MessageCircle", "AtSign"],
  Mail: ["Send", "Inbox", "AtSign"],
  FileText: ["FilePen", "FileCheck", "BookOpen", "Folder"],
  FileCheck: ["History", "FileText", "ClipboardCheck"],
  ShieldCheck: ["Shield", "ShieldAlert", "LockKeyhole"],
  LockKeyhole: ["Lock", "Key", "Fingerprint"],
  Key: ["KeyRound", "Lock", "Fingerprint"],
  BadgeCheck: ["Award", "Stamp", "FileCheck"],
  BellRing: ["Bell", "Siren", "Activity"],
  Activity: ["Gauge", "Radar", "Siren"],
  CreditCard: ["Wallet", "Banknote", "Receipt"],
  Receipt: ["Calculator", "FileSpreadsheet", "Banknote"],
  Coins: ["PiggyBank", "Banknote", "HandCoins"],
  Store: ["ShoppingBag", "Tag", "Box"],
  ShoppingCart: ["ShoppingBag", "Tag"],
  Truck: ["Package", "Route", "Warehouse"],
  Package: ["Box", "Boxes", "Truck"],
  Boxes: ["Warehouse", "Package", "Tag"],
  Sparkles: ["WandSparkles", "BrainCircuit", "Bot"],
  BrainCircuit: ["Brain", "Sparkles", "Cpu"],
  Bot: ["Sparkles", "MessageCircle"],
  Workflow: ["Repeat", "RefreshCw", "Cable"],
  Rocket: ["Flag", "Milestone", "Play"],
  CodeXml: ["Code", "Braces", "Binary"],
  SquareTerminal: ["Terminal", "Command", "Keyboard"],
  GitBranch: ["GitMerge", "GitPullRequest", "GitCommitHorizontal"],
  Cloud: ["CloudUpload", "Server", "Satellite"],
  Server: ["HardDrive", "Cpu", "Router"],
  Database: ["HardDrive", "Table", "Server"],
  Webhook: ["Cable", "Link2", "Plug"],
  Plug: ["Cable", "Puzzle", "Link"],
  CloudUpload: ["Upload", "Archive", "Folder"],
  Globe: ["Earth", "Map", "Network"],
  Eye: ["Monitor", "Scan", "Search"],
  Search: ["Filter", "ScanLine", "Eye"],
  Filter: ["Target", "Goal", "ChartColumn"],
  Megaphone: ["Newspaper", "Target", "Radio"],
  Palette: ["Brush", "PenTool", "Shapes"],
  Image: ["Images", "Camera", "Frame"],
  Video: ["Film", "Clapperboard", "Play"],
  Headset: ["LifeBuoy", "CircleHelp", "MessageCircle"],
  Smartphone: ["Laptop", "Monitor", "Wifi"],
  Zap: ["Gauge", "Timer", "Flame"],
  RefreshCw: ["Repeat", "Wifi", "Radio"],
  Clock: ["Timer", "Hourglass", "CalendarClock"],
  SlidersHorizontal: ["Settings", "Filter", "Component"],
  LayoutDashboard: ["LayoutGrid", "Frame", "Component"],
  Blocks: ["Component", "Shapes", "Puzzle"],
  Target: ["Goal", "Crosshair", "Flag"],
  Briefcase: ["Building2", "UserPlus", "Handshake"],
  Handshake: ["Users", "Briefcase", "ThumbsUp"],
  Landmark: ["Building2", "PiggyBank", "Wallet"],
  GraduationCap: ["School", "BookOpen", "Lightbulb"],
  HeartPulse: ["Stethoscope", "Pill", "Activity"],
  MapPin: ["Map", "Navigation", "Compass"],
  Plane: ["Luggage", "Map", "Compass"],
};

type Match = { icon: string; pos: number; rank: number };

/** Whether wording names something with a specific icon of its own ("bread" → a croissant; not "great"). */
export function hasSpecificIcon(label: string) {
  return matchesIn(label.toLowerCase()).some((m) => m.rank < GENERIC_FROM);
}

/** Every keyword that appears in `text`, with where it appears and how specific it is. */
function matchesIn(text: string): Match[] {
  const out: Match[] = [];
  KEYWORDS.forEach(([re, icon], rank) => {
    const m = re.exec(text);
    if (m) out.push({ icon, pos: m.index, rank });
  });
  return out;
}

/**
 * The icons that suit a tile, best first, read the way a designer would: its title's head noun
 * ("Team *calendar*" is a calendar, "Fast *checkout*" a card), then the rest of the title, then
 * its one-line description ("Title — description"), then modifiers ("fast", "live").
 */
function candidates(label: string): string[] {
  const [rawTitle, desc = ""] = label.split(/\s+[—–]\s+/);
  const title = rawTitle.toLowerCase();
  // The head phrase: the title up to its first preposition or "and" ("Dashboards *for teams*").
  const head = title.split(/\s+(?:for|with|to|in|on|across|by|from|that|via|and|&|\+)\s+|,\s*/)[0];
  const specific = (ms: Match[]) => ms.filter((m) => m.rank < GENERIC_FROM);
  const generic = (ms: Match[]) => ms.filter((m) => m.rank >= GENERIC_FROM);
  // In an English compound the last noun is the head: later matches first, then the more specific keyword.
  const byHead = (ms: Match[]) => [...ms].sort((a, b) => b.pos - a.pos || a.rank - b.rank);
  const byOrder = (ms: Match[]) => [...ms].sort((a, b) => a.pos - b.pos || a.rank - b.rank);
  const inHead = matchesIn(head);
  const inTitle = matchesIn(title);
  const inDesc = matchesIn(desc.toLowerCase());
  const ordered = [...byHead(specific(inHead)), ...byHead(specific(inTitle)), ...byOrder(specific(inDesc)), ...byHead(generic(inTitle)), ...byOrder(generic(inDesc))].map((m) => m.icon);
  return [...new Set(ordered)];
}

/** Pick the icon for a label; `family` (the concept's icons) gives on-brand fallbacks. */
export function iconFor(label: string, i: number, family: string[] = DEFAULT_FAMILY): string {
  return candidates(label)[0] ?? family[i % family.length] ?? "Sparkles";
}

/**
 * Icons for a set of labels shown together (labels may be "Title — description"): the best match
 * for each tile's own words, never the same icon twice. A tile whose best icon is taken gets its
 * next match, then an icon related to its best one (another chart, another calendar), and only
 * then one from the product's icon family.
 */
export function iconsFor(labels: string[], family: string[] = DEFAULT_FAMILY): string[] {
  const used = new Set<string>();
  const pick = (icon: string) => {
    used.add(icon);
    return icon;
  };
  const wants = labels.map(candidates);
  return labels.map((_, i) => {
    const own = wants[i];
    // The best match, then a cousin of it (another chart, another calendar), before weaker matches.
    for (const icon of own) {
      if (!used.has(icon)) return pick(icon);
      const alt = (ALTERNATIVES[icon] ?? []).find((x) => !used.has(x) && hasIcon(x));
      if (alt) return pick(alt);
    }
    const f = family.find((x) => !used.has(x)) ?? DEFAULT_FAMILY.find((x) => !used.has(x)) ?? family[i % family.length];
    return pick(f);
  });
}

export const DEFAULT_FAMILY = ["Sparkles", "Zap", "ChartNoAxesCombined", "Layers", "ShieldCheck", "Users"];

/** Icons for pains being struck through. */
export const PAIN_ICONS = ["CircleX", "TriangleAlert", "Hourglass", "Frown"];
