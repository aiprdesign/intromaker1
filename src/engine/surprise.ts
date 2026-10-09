/**
 * Random intros: a brief on a random topic, written the way a customer writes one (what the
 * business is, its features or services, how it works, who it's for, the tone, the button, the
 * contact details), and worded so the director reaches for the slides that topic shows off best:
 * 3D devices for an app, 3D homes for a homebuilder, cartoon characters for a kids' app, product
 * shots for a launch, trailer screens for a game, a services showcase for an agency.
 *
 * Every name and contact detail is made up: brands from word parts, websites and emails on the
 * reserved ".example" domain, phone numbers in the 555-0100 to 555-0199 range set aside for
 * fiction, so the intro never points at a real business.
 */

type Topic = {
  /** Short label for the topic. */
  kind: string;
  /** How the brief asks for the video ("an intro video", "an epic game trailer"). */
  ask: string;
  /** Word parts for the made-up name: one from each list. */
  name: [string[], string[]];
  /** What it is, after its name ("an analytics app for product teams"). */
  pitch: string;
  /** "Features" or "Services": four of `items` are listed. */
  list: "Features" | "Services";
  items: string[];
  /** How it works, in three steps (optional). */
  steps?: string[];
  audience: string;
  tones: string[];
  ctas: string[];
  /** Which contact details the brief gives. */
  contact: ("web" | "email" | "phone")[];
  /** A local business names its town. */
  local?: boolean;
};

const TOPICS: Topic[] = [
  {
    kind: "Analytics app",
    ask: "a launch video",
    name: [["Lumen", "Cobalt", "Vela", "Prism", "Orbit"], ["metrics", "board", "scope", "pulse"]],
    pitch: "an analytics app for product teams",
    list: "Features",
    items: ["live dashboards", "AI insights", "cohort funnels", "team sharing", "custom reports", "alerts in Slack"],
    steps: ["connect your data", "build a dashboard", "share it with your team"],
    audience: "product managers and founders at growing startups",
    tones: ["modern and confident", "clean and premium"],
    ctas: ["Start free trial", "Book a demo"],
    contact: ["web", "email"],
  },
  {
    kind: "AI copilot",
    ask: "a product intro",
    name: [["Nexa", "Vektor", "Synth", "Quill", "Atlas"], ["AI", "pilot", "mind", "assist"]],
    pitch: "an AI copilot for developers",
    list: "Features",
    items: ["code suggestions", "pull request reviews", "chat with your codebase", "test generation", "one-click deploys"],
    steps: ["install the extension", "open your project", "ask it anything"],
    audience: "software teams who ship every week",
    tones: ["futuristic and sleek", "dark with a glowing AI look"],
    ctas: ["Try it free", "Join the waitlist"],
    contact: ["web"],
  },
  {
    kind: "Homebuilder",
    ask: "a homebuilder video",
    name: [["Harbor", "Maple", "Willow", "Cedar", "Stone"], [" Homes", " Ridge Homes", " Creek Builders", " Lane Homes"]],
    pitch: "building new homes in a walkable community with model homes and floor plans",
    list: "Features",
    items: ["an open-plan kitchen", "a spa bathroom", "a finished basement", "a bonus room", "a backyard with a pool", "a covered front porch"],
    steps: ["tour a model home", "choose your floor plan", "make it yours"],
    audience: "first-time buyers and growing households",
    tones: ["warm and welcoming", "elegant, golden hour"],
    ctas: ["Book a tour", "Schedule a visit"],
    contact: ["web", "phone"],
    local: true,
  },
  {
    kind: "Real estate agency",
    ask: "an agency intro",
    name: [["Keystone", "Bluebird", "Golden Gate", "Oak", "Summit"], [" Realty", " Real Estate", " Properties"]],
    pitch: "a real estate agency helping buyers find a home in the community",
    list: "Services",
    items: ["homes for sale", "virtual tours", "neighbourhood guides", "first-time buyer help", "local agents", "home valuations"],
    steps: ["tell us what you need", "tour homes you love", "get the keys"],
    audience: "buyers and sellers in town",
    tones: ["trustworthy and warm", "polished and calm"],
    ctas: ["Find your home", "Talk to an agent"],
    contact: ["web", "phone", "email"],
    local: true,
  },
  {
    kind: "Kids learning app",
    ask: "a cheerful cartoon intro",
    name: [["Bumble", "Tiny", "Sunny", "Giggle", "Pip"], ["learn", "words", "math", "ABC"]],
    pitch: "a learning app for kids with friendly characters",
    list: "Features",
    items: ["reading games", "counting songs", "stickers after lessons", "parent progress reports", "offline play"],
    steps: ["pick a world", "play a short lesson", "collect a sticker"],
    audience: "kids aged four to eight and their parents",
    tones: ["playful and bright", "soft and friendly"],
    ctas: ["Download the app", "Start learning"],
    contact: ["web"],
  },
  {
    kind: "Fitness app",
    ask: "an energetic launch video",
    name: [["Stride", "Pulse", "Flex", "Peak", "Motion"], ["fit", "coach", "go", "move"]],
    pitch: "a fitness app on your phone",
    list: "Features",
    items: ["guided workouts", "a step tracker", "meal plans", "streak badges", "a coach in your pocket"],
    steps: ["set your goal", "follow the plan", "watch your progress"],
    audience: "busy people who want to train at home",
    tones: ["bold and energetic", "fast and punchy"],
    ctas: ["Download the app", "Start free trial"],
    contact: ["web"],
  },
  {
    kind: "Game trailer",
    ask: "an epic game trailer",
    name: [["SHADOW", "IRON", "NEON", "STORM", "VOID"], ["STRIKE", "RAIDERS", "FALL", "LEGION"]],
    pitch: "a sci-fi shooter",
    list: "Features",
    items: ["squad battles", "giant mechs", "a ruined city to explore", "ranked seasons", "boss raids"],
    audience: "competitive players",
    tones: ["dark, cinematic and intense", "neon and glitchy"],
    ctas: ["Wishlist now", "Coming soon"],
    contact: ["web"],
  },
  {
    kind: "Watch launch",
    ask: "a gold luxury launch",
    name: [["AUR", "LUX", "VER", "ORO"], ["UM", "IS", "ANO", "ELLE"]],
    pitch: "a watch brand",
    list: "Features",
    items: ["Swiss made", "sapphire crystal", "hand-finished movement", "craftsmanship", "a limited edition"],
    audience: "collectors",
    tones: ["elegant and cinematic", "black and gold"],
    ctas: ["Discover the collection", "Visit the boutique"],
    contact: ["web"],
  },
  {
    kind: "Sneaker drop",
    ask: "a hype product drop",
    name: [["Volt", "Aero", "Kick", "Glide"], ["Runner", "One", "Max", "Lite"]],
    pitch: "a new running sneaker",
    list: "Features",
    items: ["a featherweight foam sole", "a knit upper", "a reflective heel", "three colourways", "a launch event"],
    audience: "runners and sneaker fans",
    tones: ["loud and energetic", "street style"],
    ctas: ["Shop the drop", "Drops Friday"],
    contact: ["web"],
  },
  {
    kind: "Coffee shop",
    ask: "a warm intro video",
    name: [["Bean", "Ember", "Copper", "Little"], [" & Co", " Roasters", " Coffee", " Café"]],
    pitch: "a neighbourhood coffee shop",
    list: "Features",
    items: ["single-origin espresso", "fresh pastries", "a cosy reading nook", "order ahead on the app", "a loyalty card"],
    steps: ["order ahead", "skip the line", "enjoy it warm"],
    audience: "locals and remote workers",
    tones: ["cosy and warm", "earthy and handmade"],
    ctas: ["Order ahead", "Visit us"],
    contact: ["web", "phone"],
    local: true,
  },
  {
    kind: "Music festival",
    ask: "a retro 80s synthwave teaser",
    name: [["NEON", "SOLAR", "MIDNIGHT", "ECHO"], [" NIGHTS", " WAVES", " PARADE", " SKY"]],
    pitch: "a music festival",
    list: "Features",
    items: ["live DJs through the night", "a lakeside stage", "food trucks", "laser shows", "a sunrise set"],
    audience: "music lovers",
    tones: ["neon and retro", "loud and glowing"],
    ctas: ["Get tickets", "Join the lineup"],
    contact: ["web"],
  },
  {
    kind: "Space documentary",
    ask: "a space documentary opener",
    name: [["BEYOND", "PAST", "INTO", "ACROSS"], [" ORBIT", " THE RED PLANET", " THE STARS", " THE DARK"]],
    pitch: "a film about a mission to Mars",
    list: "Features",
    items: ["the launch", "the long journey", "a landing on red dust", "the crew", "the first footprints"],
    audience: "science fans",
    tones: ["cinematic and awe-struck", "quiet and vast"],
    ctas: ["Watch the premiere", "Coming soon"],
    contact: ["web"],
  },
  {
    kind: "Developer platform",
    ask: "a developer platform launch",
    name: [["Ship", "Deploy", "Edge", "Stack"], ["yard", "kit", "base", "ops"]],
    pitch: "a platform that takes your code from commit to live",
    list: "Features",
    items: ["git push to deploy", "preview links", "edge functions", "live logs", "rollbacks"],
    steps: ["connect your repo", "push a commit", "share the preview link"],
    audience: "frontend teams",
    tones: ["technical and crisp", "dark terminal look"],
    ctas: ["Start building", "Deploy now"],
    contact: ["web"],
  },
  {
    kind: "Budget app",
    ask: "a friendly product video",
    name: [["Penny", "Nest", "Coin", "Clover"], ["wise", "egg", "plan", "path"]],
    pitch: "a budgeting app for less time on spreadsheets and more time saving",
    list: "Features",
    items: ["spending by category", "savings goals", "bill reminders", "shared budgets", "bank sync"],
    steps: ["link your accounts", "set a goal", "watch your savings grow"],
    audience: "young couples saving together",
    tones: ["friendly and calm", "fresh and clear"],
    ctas: ["Download the app", "Get started"],
    contact: ["web", "email"],
  },
  {
    kind: "Travel app",
    ask: "a travel app launch",
    name: [["Wander", "Roam", "Atlas", "Compass"], ["ly", "trip", "go", "way"]],
    pitch: "a trip planner for friends who travel together",
    list: "Features",
    items: ["trip planning on a map", "offline guides", "local food picks", "shared itineraries", "flight alerts"],
    steps: ["pick a destination", "plan it together", "go"],
    audience: "friends planning trips abroad",
    tones: ["sunny and adventurous", "light and airy"],
    ctas: ["Plan your trip", "Download the app"],
    contact: ["web"],
  },
  {
    kind: "Dental clinic",
    ask: "a welcoming intro",
    name: [["Bright", "Gentle", "Smile", "Pearl"], [" Dental", " Smiles", " Dental Studio"]],
    pitch: "a family dental clinic",
    list: "Services",
    items: ["check-ups", "gentle care for kids", "whitening", "evening appointments", "a friendly team"],
    steps: ["book online", "meet your dentist", "leave smiling"],
    audience: "families in the neighbourhood",
    tones: ["calm and reassuring", "bright and clean"],
    ctas: ["Book a visit", "Book now"],
    contact: ["web", "phone"],
    local: true,
  },
  {
    kind: "Restaurant",
    ask: "a mouth-watering intro",
    name: [["Olive", "Saffron", "Basil", "Fig"], [" Kitchen", " Table", " & Vine", " House"]],
    pitch: "a Mediterranean restaurant",
    list: "Features",
    items: ["wood-fired flatbreads", "fresh mezze", "a sunny terrace", "weekend brunch", "takeaway"],
    audience: "foodies and friends",
    tones: ["warm and rustic", "sunny and fresh"],
    ctas: ["Book a table", "Order online"],
    contact: ["web", "phone"],
    local: true,
  },
  {
    kind: "Online course",
    ask: "an explainer intro",
    name: [["Skill", "Learn", "Bright", "Mentor"], ["path", "lab", "class", "loop"]],
    pitch: "an online design course",
    list: "Features",
    items: ["video lessons", "real projects", "mentor feedback", "a community", "a certificate"],
    steps: ["enroll", "build real projects", "share your portfolio"],
    audience: "career changers learning UX and UI design",
    tones: ["inspiring and clear", "creative and colourful"],
    ctas: ["Start learning", "Enroll now"],
    contact: ["web", "email"],
  },
  {
    kind: "Delivery service",
    ask: "a product video",
    name: [["Swift", "Zip", "Dash", "Parcel"], ["post", "drop", "route", "box"]],
    pitch: "same-day local delivery for small shops",
    list: "Features",
    items: ["live tracking on a map", "same-day drop-offs", "proof of delivery", "a driver app", "simple pricing"],
    steps: ["book a pickup", "track it live", "get proof of delivery"],
    audience: "small shops and online sellers",
    tones: ["fast and efficient", "bold and clear"],
    ctas: ["Book a pickup", "Get started"],
    contact: ["web", "phone"],
  },
  {
    kind: "Law firm",
    ask: "a professional intro",
    name: [["Hartwell", "Ashford", "Kendall", "Whitmore"], [" & Partners", " Law", " Legal"]],
    pitch: "a law firm for small businesses",
    list: "Services",
    items: ["contracts", "business setup", "employment advice", "disputes", "trademarks"],
    steps: ["book a first call", "get a clear plan", "we handle the paperwork"],
    audience: "founders and small business owners",
    tones: ["calm, clean and professional", "trustworthy and minimal"],
    ctas: ["Book a consultation", "Get in touch"],
    contact: ["web", "phone", "email"],
    local: true,
  },
  {
    kind: "Pet care app",
    ask: "a playful cartoon intro",
    name: [["Paw", "Woof", "Purr", "Fetch"], ["pal", "buddy", "care", "path"]],
    pitch: "a pet care app",
    list: "Features",
    items: ["walk booking", "vet reminders", "a pet profile", "trusted sitters", "photo updates"],
    steps: ["add your pet", "book a walk", "get photo updates"],
    audience: "busy pet owners",
    tones: ["playful and sunny", "cute and colourful"],
    ctas: ["Download the app", "Book a walk"],
    contact: ["web"],
  },
  {
    kind: "Construction company",
    ask: "a strong intro",
    name: [["Granite", "Iron", "Summit", "Keystone"], [" Builders", " Construction", " Contracting"]],
    pitch: "a construction company",
    list: "Services",
    items: ["commercial builds", "renovations", "project management", "site planning", "on-time handovers"],
    steps: ["tell us about the project", "get a clear quote", "we build it"],
    audience: "property owners and developers",
    tones: ["strong and dependable", "bold and industrial"],
    ctas: ["Get a quote", "Talk to our team"],
    contact: ["web", "phone"],
    local: true,
  },
  {
    kind: "Team chat app",
    ask: "a SaaS launch video",
    name: [["Huddle", "Relay", "Chorus", "Thread"], ["ly", "hq", "up", "space"]],
    pitch: "a team chat app, instead of endless email threads",
    list: "Features",
    items: ["threaded channels", "video huddles", "shared docs", "integrations", "quick search"],
    steps: ["invite your team", "open a channel", "decide faster together"],
    audience: "remote teams",
    tones: ["bright and modern", "friendly and fast"],
    ctas: ["Start free trial", "Try it free"],
    contact: ["web"],
  },
  {
    kind: "Marketing agency",
    ask: "an agency showreel intro",
    name: [["Bold", "North", "Spark", "Mint"], [" Studio", " & Co", " Creative", " Agency"]],
    pitch: "a creative agency for growing brands",
    list: "Services",
    items: ["brand identity", "web design", "social media", "video production", "SEO"],
    steps: ["discovery call", "strategy", "launch"],
    audience: "startups and growing brands",
    tones: ["bold and editorial", "creative and colourful"],
    ctas: ["Work with us", "Get in touch"],
    contact: ["web", "email"],
  },
  {
    kind: "Podcast",
    ask: "a podcast intro",
    name: [["Late", "Deep", "Signal", "Open"], [" Night Talks", " Dive", " & Noise", " Mic"]],
    pitch: "conversations about tech and culture",
    list: "Features",
    items: ["weekly episodes", "guest interviews", "listener questions", "behind the scenes", "live shows"],
    audience: "curious listeners",
    tones: ["warm and cinematic", "moody and late-night"],
    ctas: ["Listen now", "Subscribe"],
    contact: ["web"],
  },
];

const OPENERS = ["Make", "Create", "I need", "Can you make", "Please make"];
const TOWNS = ["Austin", "Denver", "Portland", "Raleigh", "Boise", "Nashville", "Tampa", "Madison"];
// (Area codes with 555-01xx, the range kept for fiction.)
const AREAS = ["512", "303", "503", "919", "208", "615", "813", "608"];

/** A random intro idea: the topic and its brief. `rand` is Math.random by default (pass a seeded one for repeatable picks). */
export function randomIntro(rand: () => number = Math.random, avoid?: string): { kind: string; prompt: string } {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length) % xs.length];
  // (Not the same topic twice in a row.)
  const pool = TOPICS.filter((t) => t.kind !== avoid);
  const t = pick(pool.length ? pool : TOPICS);
  const name = pick(t.name[0]) + pick(t.name[1]);
  const slug = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  const items = [...t.items].sort(() => rand() - 0.5).slice(0, 4);
  const town = t.local ? pick(TOWNS) : undefined;
  const area = town ? AREAS[TOWNS.indexOf(town)] : pick(AREAS);
  const phone = `(${area}) 555-01${String(Math.floor(rand() * 100)).padStart(2, "0")}`;
  const contact = [
    t.contact.includes("web") ? `Website: ${slug}.example` : "",
    t.contact.includes("email") ? `Email: hello@${slug}.example` : "",
    t.contact.includes("phone") ? `Phone: ${phone}` : "",
  ].filter(Boolean);
  const cta = pick(t.ctas);
  const lines = [
    `${pick(OPENERS)} ${t.ask} for "${name}", ${t.pitch}${town ? ` in ${town}` : ""}.`,
    `${t.list}: ${items.join(", ")}.`,
    ...(t.steps ? [`How it works: ${t.steps.join(", ")}.`] : []),
    `Audience: ${t.audience}.`,
    `Tone: ${pick(t.tones)}.`,
    `End with ${/^[aeiou]/i.test(cta) ? "an" : "a"} "${cta}" button.`,
    `Contact: ${contact.join(" · ")}`,
  ];
  return { kind: t.kind, prompt: lines.join("\n") };
}

/** The topics a random intro picks from. */
export const RANDOM_TOPICS = TOPICS.map((t) => t.kind);
