/**
 * Random intros: a brief on a random topic, written the way a customer writes one (what the
 * business is, its features or services, how it works, who it's for, the tone, the button, the
 * contact details), and worded so the director reaches for the slides that topic shows off best:
 * 3D devices for an app, 3D homes for a homebuilder, cartoon characters for a kids' app, a
 * services showcase for an agency. Each brief carries a tagline the video opens on, and most a style
 * that shows the topic off (liquid, 3D, sci-fi…). Topics are designed intros, not trailer cuts: a
 * random intro has no footage or photos to cut a trailer from.
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
  /** Opening lines, one is picked: short, vivid and claim-free (the video opens on it). */
  taglines: string[];
  /** Styles that show this topic off (one is picked); none leaves the studio's own pick. */
  looks?: string[];
  /** Which contact details the brief gives. */
  contact: ("web" | "email" | "phone")[];
  /** A local business names its town. */
  local?: boolean;
};

const TOPICS: Topic[] = [
  {
    kind: "Analytics app",
    taglines: ["See the story behind your clicks", "Your data, finally talking back", "Less guessing, more knowing"],
    looks: ["keynote", "spatial", "horizon", "liquid"],
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
    taglines: ["Write less boilerplate, ship more ideas", "Your codebase, now on speaking terms", "A pair programmer on your schedule"],
    looks: ["aiglow", "quantum", "holo", "wormhole"],
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
    taglines: ["Built for the way you live", "Your porch light is waiting", "Room to grow, a place to belong"],
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
    taglines: ["Find the door that feels like yours", "Keys, coffee and a new street", "Your next chapter starts at the curb"],
    looks: ["luxe", "editorial", "daybreak"],
    ask: "an agency intro",
    name: [["Keystone", "Bluebird", "Golden Gate", "Oak", "Ridgeline"], [" Realty", " Real Estate", " Properties"]],
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
    taglines: ["Learning that feels like recess", "Tiny minds, big adventures", "Count, read and giggle"],
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
    taglines: ["Your gym fits in your pocket", "Sweat now, brag later", "Small steps, loud results"],
    looks: ["kinetic", "neon", "chrome", "liquid"],
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
    kind: "Coffee shop",
    taglines: ["Slow mornings, strong coffee", "Your cup is ready when you are", "Brewed by neighbours, for neighbours"],
    looks: ["ink", "bloom", "paper"],
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
    kind: "Developer platform",
    taglines: ["Push to deploy, then go to lunch", "From commit to live in one breath", "Ship on a Friday, sleep on Saturday"],
    looks: ["terminal", "datarain", "hud"],
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
    taglines: ["Know where your money goes", "Spend with a plan, not a sigh", "Payday, without the panic"],
    looks: ["flow", "bloom", "frosted"],
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
    taglines: ["Pack light, plan less, wander more", "Your next trip, sorted in a swipe", "Find the place that finds you"],
    looks: ["daybreak", "horizon", "aurora"],
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
    taglines: ["Smiles made comfortable", "Gentle care, bright smiles", "The friendliest chair in town"],
    looks: ["frosted", "enterprise", "bloom"],
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
    taglines: ["Pull up a chair, stay a while", "Made from scratch, served with heart", "Your table is set"],
    looks: ["ink", "luxe", "bloom"],
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
    taglines: ["Learn it tonight, use it tomorrow", "Skills that fit your evenings", "Curious beats clueless"],
    looks: ["pop", "kinetic", "flow"],
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
    taglines: ["Ordered, picked up, at your door", "From our kitchen to your couch", "Dinner, minus the dishes"],
    looks: ["kinetic", "pop", "warp"],
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
    taglines: ["Clear advice for complicated days", "Steady counsel, plain answers", "On your side of the table"],
    looks: ["swiss", "enterprise", "editorial"],
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
    taglines: ["Happy tails start here", "Walks, snacks and tummy rubs", "Your pet's favourite app"],
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
    taglines: ["Built right, built to last", "Blueprints to keys, on schedule", "Strong foundations, honest work"],
    looks: ["slab", "enterprise", "mono"],
    ask: "a strong intro",
    name: [["Granite", "Iron", "Cornerstone", "Keystone"], [" Builders", " Construction", " Contracting"]],
    pitch: "a construction company",
    list: "Services",
    items: ["commercial builds", "renovations", "new builds", "site planning", "on-time handovers"],
    steps: ["tell us about the project", "get a clear quote", "we build it"],
    audience: "property owners and developers",
    tones: ["strong and dependable", "bold and industrial"],
    ctas: ["Get a quote", "Talk to our team"],
    contact: ["web", "phone"],
    local: true,
  },
  {
    kind: "Team chat app",
    taglines: ["Less email, more getting done", "Your team, in one room", "Talk less about work, do more of it"],
    looks: ["frosted", "clay", "liquid", "pop"],
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
    taglines: ["Brands people remember", "Loud ideas, sharp execution", "We make the scroll stop"],
    looks: ["brutalist", "editorial", "kinetic", "chrome"],
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
    kind: "Smart home app",
    taglines: ["Your home, on speaking terms", "Lights, heat and locks in one tap", "Leave the house, take the controls"],
    looks: ["spatial", "holo", "frosted"],
    ask: "a sleek 3D launch video",
    name: [["Nest", "Haven", "Hearth", "Dwell", "Halo"], ["ly", "hub", "home", "sync"]],
    pitch: "a smart home app that runs your lights, heating and locks",
    list: "Features",
    items: ["one-tap scenes", "remote locks", "energy tracking", "voice control", "away mode"],
    steps: ["connect your devices", "set your scenes", "relax"],
    audience: "homeowners and renters",
    tones: ["sleek and futuristic", "calm and premium"],
    ctas: ["Download the app", "Get the app"],
    contact: ["web"],
  },
  {
    kind: "Cybersecurity platform",
    taglines: ["See threats before they see you", "Your network, under a watchful eye", "Calm on the surface, alert underneath"],
    looks: ["hud", "bridge", "datarain"],
    ask: "a mission-control style launch video",
    name: [["Sentry", "Bastion", "Aegis", "Vigil", "Ward"], ["ops", "grid", "shield", "core"]],
    pitch: "a security platform for IT teams",
    list: "Features",
    items: ["threat detection", "a live attack map", "zero-trust access", "automated alerts", "compliance reports"],
    steps: ["connect your cloud", "map your assets", "get alerts that matter"],
    audience: "IT and security teams",
    tones: ["dark, sci-fi and precise", "mission control"],
    ctas: ["Book a demo", "Talk to our team"],
    contact: ["web", "email"],
  },
  {
    kind: "EV charging app",
    taglines: ["Charge up, roll on", "The road trip just got quieter", "Plug in, power up, drive on"],
    looks: ["warp", "chrome", "horizon"],
    ask: "a fast, futuristic launch video",
    name: [["Volt", "Amp", "Spark", "Current", "Ion"], ["way", "go", "path", "hub"]],
    pitch: "an app for finding and paying for EV chargers",
    list: "Features",
    items: ["a live charger map", "tap to pay", "route planning", "charging alerts", "trip history"],
    steps: ["find a charger", "plug in", "pay in the app"],
    audience: "electric car drivers",
    tones: ["electric and fast", "sleek and futuristic"],
    ctas: ["Download the app", "Find a charger"],
    contact: ["web"],
  },
  {
    kind: "Language app",
    taglines: ["Say it like a local", "Your passport to small talk", "Learn a language between coffees"],
    looks: ["pop", "kinetic", "bloom"],
    ask: "a bright, playful app intro",
    name: [["Lingo", "Hola", "Parla", "Bon", "Ciao"], ["loop", "pal", "ly", "buddy"]],
    pitch: "a language learning app with quick daily lessons",
    list: "Features",
    items: ["bite-size lessons", "speaking practice", "streaks and badges", "travel phrases", "chat with tutors"],
    steps: ["pick a language", "learn a few words a day", "start a conversation"],
    audience: "travellers and curious learners",
    tones: ["bright and playful", "colourful and upbeat"],
    ctas: ["Start learning", "Download the app"],
    contact: ["web"],
  },
  {
    kind: "Plant shop",
    taglines: ["Bring the outside in", "Green thumbs not required", "A little jungle for your windowsill"],
    looks: ["bloom", "daybreak", "ink"],
    ask: "a fresh, leafy intro",
    name: [["Fern", "Leaf", "Moss", "Sprout", "Ivy"], [" & Pot", " House", " Lane", " Co"]],
    pitch: "a neighbourhood plant shop",
    list: "Services",
    items: ["indoor plants", "potting workshops", "gift bundles", "a pot and soil bar", "rare finds"],
    steps: ["visit or order online", "pick your plant", "we help it thrive"],
    audience: "new plant parents and apartment dwellers",
    tones: ["fresh and green", "calm and natural"],
    ctas: ["Visit the shop", "Book a workshop"],
    contact: ["web", "phone"],
    local: true,
  },
  {
    kind: "Event ticketing app",
    taglines: ["Your night out, one tap away", "Doors open, phones ready", "Skip the queue, keep the vibe"],
    looks: ["neon", "horizon", "kinetic"],
    ask: "a neon launch video",
    name: [["Gig", "Encore", "Stage", "Velvet", "Backstage"], ["pass", "ly", "door", "go"]],
    pitch: "an app for finding live events and booking seats",
    list: "Features",
    items: ["mobile passes", "seat maps", "friends' plans", "event alerts", "easy transfers"],
    steps: ["find a show", "pick your seats", "scan in at the door"],
    audience: "music fans and night owls",
    tones: ["neon and electric", "loud and glowing"],
    ctas: ["Get the app", "Find a show"],
    contact: ["web"],
  },
  {
    kind: "Recipe app",
    taglines: ["Dinner, figured out", "Cook tonight, smile tomorrow", "Your fridge has ideas"],
    looks: ["bloom", "pop", "clay"],
    ask: "a warm, colourful app intro",
    name: [["Basil", "Pepper", "Simmer", "Spoon", "Saffron"], ["ly", "box", "kit", "list"]],
    pitch: "a recipe app with weekly meal plans",
    list: "Features",
    items: ["weekly meal plans", "smart shopping lists", "step-by-step videos", "pantry search", "family favourites"],
    steps: ["pick your meals", "shop the list", "cook along"],
    audience: "busy home cooks",
    tones: ["warm and colourful", "fresh and friendly"],
    ctas: ["Download the app", "Start cooking"],
    contact: ["web"],
  },
];

const OPENERS = ["Make", "Create", "I need", "Can you make", "Please make"];
const TOWNS = ["Austin", "Denver", "Portland", "Raleigh", "Boise", "Nashville", "Tampa", "Madison"];
// (Area codes with 555-01xx, the range kept for fiction.)
const AREAS = ["512", "303", "503", "919", "208", "615", "813", "608"];

/**
 * A random intro idea: the topic, its brief and a style that shows it off (`look`, a template id,
 * or none to leave the studio's pick). `rand` is Math.random by default (pass a seeded one for
 * repeatable picks).
 */
export function randomIntro(rand: () => number = Math.random, avoid?: string): { kind: string; prompt: string; look?: string } {
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
    `Tagline: "${pick(t.taglines)}"`,
    `${t.list}: ${items.join(", ")}.`,
    ...(t.steps ? [`How it works: ${t.steps.join(", ")}.`] : []),
    `Audience: ${t.audience}.`,
    `Tone: ${pick(t.tones)}.`,
    `End with ${/^[aeiou]/i.test(cta) ? "an" : "a"} "${cta}" button.`,
    `Contact: ${contact.join(" · ")}`,
  ];
  return { kind: t.kind, prompt: lines.join("\n"), look: t.looks?.length ? pick(t.looks) : undefined };
}

/** The topics a random intro picks from. */
export const RANDOM_TOPICS = TOPICS.map((t) => t.kind);
