/**
 * Random intros: a prompt on a random topic, written so the director reaches for the slides that
 * topic shows off best (3D devices for an app, 3D homes for a homebuilder, cartoon characters for
 * a kids' app, product shots for a launch, trailer screens for a game, an icon story for a café…).
 * The brand names are made up from word parts, so the intro never borrows a real company's name.
 * It's a way to see what the studio can do before writing a prompt of your own.
 */

type Topic = {
  /** Short label for the topic, shown with the prompt. */
  kind: string;
  /** Word parts for the made-up name: one from each list. */
  name: [string[], string[]];
  /** The prompt, with {name} and {features} (three of `features`, joined) to fill in. */
  prompt: string;
  features: string[];
};

const TOPICS: Topic[] = [
  {
    kind: "Analytics app",
    name: [["Lumen", "Cobalt", "Vela", "Prism", "Orbit"], ["metrics", "board", "scope", "pulse"]],
    prompt: 'Launch video for "{name}", an analytics app for product teams: {features}. Show it on a laptop and a phone',
    features: ["live dashboards", "AI insights", "funnels and cohorts", "team sharing", "custom reports", "alerts in Slack"],
  },
  {
    kind: "AI copilot",
    name: [["Nexa", "Vektor", "Synth", "Quill", "Atlas"], ["AI", "pilot", "mind", "assist"]],
    prompt: 'Product intro for "{name}", an AI copilot for developers: {features}',
    features: ["code suggestions", "pull request reviews", "chat with your codebase", "test generation", "one-click deploys"],
  },
  {
    kind: "Homebuilder",
    name: [["Harbor", "Maple", "Willow", "Cedar", "Stone"], [" Homes", " Ridge Homes", " Creek Builders", " Lane Homes"]],
    prompt: 'Homebuilder video for "{name}", new homes in a walkable community with model homes and floor plans: {features}. Book a tour',
    features: ["an open kitchen and great room", "a spa bathroom", "a finished basement", "a bonus room", "a backyard with a pool", "a covered front porch"],
  },
  {
    kind: "Real estate agency",
    name: [["Keystone", "Bluebird", "Golden Gate", "Oak", "Summit"], [" Realty", " Real Estate", " Properties"]],
    prompt: 'Real estate agency intro for "{name}", helping buyers find a home in the community: {features}',
    features: ["homes for sale", "virtual tours", "neighbourhood guides", "first-time buyer help", "local agents"],
  },
  {
    kind: "Kids learning app",
    name: [["Bumble", "Tiny", "Sunny", "Giggle", "Pip"], ["learn", "words", "math", "ABC"]],
    prompt: 'Cheerful cartoon intro for "{name}", a learning app for kids: {features}. Friendly characters',
    features: ["reading games", "counting songs", "stickers after lessons", "parent progress reports", "offline play"],
  },
  {
    kind: "Fitness app",
    name: [["Stride", "Pulse", "Flex", "Peak", "Motion"], ["fit", "coach", "go", "move"]],
    prompt: 'Energetic launch for "{name}", a fitness app on your phone: {features}',
    features: ["guided workouts", "a step tracker", "meal plans", "streaks and badges", "a coach in your pocket"],
  },
  {
    kind: "Game trailer",
    name: [["SHADOW", "IRON", "NEON", "STORM", "VOID"], ["STRIKE", "RAIDERS", "FALL", "LEGION"]],
    prompt: "Epic game trailer for {name}, a sci-fi shooter: {features}. Coming soon",
    features: ["squad battles", "giant mechs", "a ruined city to explore", "ranked seasons", "boss raids"],
  },
  {
    kind: "Watch launch",
    name: [["AUR", "LUX", "VER", "ORO"], ["UM", "IS", "ANO", "ELLE"]],
    prompt: 'Gold luxury launch for a watch brand called "{name}": {features}',
    features: ["Swiss made", "sapphire crystal", "hand-finished movement", "craftsmanship", "a limited edition"],
  },
  {
    kind: "Sneaker drop",
    name: [["Volt", "Aero", "Kick", "Glide"], ["Runner", "One", "Max", "Lite"]],
    prompt: 'Hype product drop for the "{name}" sneaker: {features}. Drops Friday',
    features: ["a featherweight foam sole", "a knit upper", "a reflective heel", "three colourways", "a launch event"],
  },
  {
    kind: "Coffee shop",
    name: [["Bean", "Ember", "Copper", "Little"], [" & Co", " Roasters", " Coffee", " Café"]],
    prompt: 'Warm intro for "{name}", a neighbourhood coffee shop: {features}',
    features: ["single-origin espresso", "fresh pastries", "a cosy reading nook", "order ahead on the app", "a loyalty card"],
  },
  {
    kind: "Music festival",
    name: [["NEON", "SOLAR", "MIDNIGHT", "ECHO"], [" NIGHTS", " WAVES", " PARADE", " SKY"]],
    prompt: "Retro 80s synthwave teaser for the {name} music festival: {features}",
    features: ["live DJs through the night", "a lakeside stage", "food trucks", "laser shows", "a sunrise set"],
  },
  {
    kind: "Space documentary",
    name: [["BEYOND", "PAST", "INTO", "ACROSS"], [" ORBIT", " THE RED PLANET", " THE STARS", " THE DARK"]],
    prompt: 'Space documentary opener "{name}" about a mission to Mars: {features}',
    features: ["the launch", "the long journey", "a landing on red dust", "the crew", "the first footprints"],
  },
  {
    kind: "Developer platform",
    name: [["Ship", "Deploy", "Edge", "Stack"], ["yard", "kit", "base", "ops"]],
    prompt: 'Developer platform launch for "{name}": {features}. From commit to live',
    features: ["git push to deploy", "preview links", "edge functions", "logs and metrics", "rollbacks"],
  },
  {
    kind: "Budget app",
    name: [["Penny", "Nest", "Coin", "Clover"], ["wise", "egg", "plan", "path"]],
    prompt: 'Friendly product video for "{name}", a budgeting app: {features}. Less time on spreadsheets, more time saving',
    features: ["spending by category", "savings goals", "bill reminders", "shared budgets", "bank sync"],
  },
  {
    kind: "Travel app",
    name: [["Wander", "Roam", "Atlas", "Compass"], ["ly", "trip", "go", "way"]],
    prompt: 'Travel app launch for "{name}": {features}. Explore the world',
    features: ["trip planning on a map", "offline guides", "local food picks", "shared itineraries", "flight alerts"],
  },
  {
    kind: "Dental clinic",
    name: [["Bright", "Gentle", "Smile", "Pearl"], [" Dental", " Smiles", " Dental Studio"]],
    prompt: 'Welcoming intro for "{name}", a family dental clinic: {features}. Book a visit',
    features: ["check-ups and cleaning", "gentle care for kids", "whitening", "evening appointments", "a friendly team"],
  },
  {
    kind: "Restaurant",
    name: [["Olive", "Saffron", "Basil", "Fig"], [" Kitchen", " Table", " & Vine", " House"]],
    prompt: 'Mouth-watering intro for "{name}", a Mediterranean restaurant: {features}',
    features: ["wood-fired flatbreads", "fresh mezze", "a sunny terrace", "weekend brunch", "takeaway and delivery"],
  },
  {
    kind: "Online course",
    name: [["Skill", "Learn", "Bright", "Mentor"], ["path", "lab", "class", "loop"]],
    prompt: 'Explainer intro for "{name}", an online design course: {features}',
    features: ["video lessons", "real projects", "mentor feedback", "a community", "a certificate"],
  },
  {
    kind: "Delivery service",
    name: [["Swift", "Zip", "Dash", "Parcel"], ["post", "drop", "route", "box"]],
    prompt: 'Product video for "{name}", same-day local delivery: {features}',
    features: ["live tracking on a map", "same-day drop-offs", "proof of delivery", "a driver app", "simple pricing"],
  },
  {
    kind: "Law firm",
    name: [["Hartwell", "Ashford", "Kendall", "Whitmore"], [" & Partners", " Law", " Legal"]],
    prompt: 'Professional intro for "{name}", a law firm for small businesses: {features}',
    features: ["contracts", "business setup", "employment advice", "disputes", "a first call to talk it through"],
  },
  {
    kind: "Pet care app",
    name: [["Paw", "Woof", "Purr", "Fetch"], ["pal", "buddy", "care", "path"]],
    prompt: 'Playful cartoon intro for "{name}", a pet care app: {features}',
    features: ["walk booking", "vet reminders", "a pet profile", "trusted sitters", "photo updates"],
  },
  {
    kind: "Construction company",
    name: [["Granite", "Iron", "Summit", "Keystone"], [" Builders", " Construction", " Contracting"]],
    prompt: 'Strong intro for "{name}", a construction company: {features}. Get a quote',
    features: ["commercial builds", "renovations", "project management", "on-time handovers"],
  },
  {
    kind: "Team chat app",
    name: [["Huddle", "Relay", "Chorus", "Thread"], ["ly", "hq", "up", "space"]],
    prompt: 'SaaS launch video for "{name}", a team chat app: {features}. Instead of endless email threads',
    features: ["channels and threads", "video huddles", "shared docs", "integrations", "quick search"],
  },
  {
    kind: "Podcast",
    name: [["Late", "Deep", "Signal", "Open"], [" Night Talks", " Dive", " & Noise", " Mic"]],
    prompt: 'Podcast intro for "{name}", conversations about tech and culture: {features}',
    features: ["weekly episodes", "guest interviews", "listener questions", "behind the scenes", "live shows"],
  },
];

/** A random intro idea: the topic and its prompt. `rand` is Math.random by default (pass a seeded one for repeatable picks). */
export function randomIntro(rand: () => number = Math.random, avoid?: string): { kind: string; prompt: string } {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length) % xs.length];
  // (Not the same topic twice in a row.)
  const pool = TOPICS.filter((t) => t.kind !== avoid);
  const t = pick(pool.length ? pool : TOPICS);
  const name = pick(t.name[0]) + pick(t.name[1]);
  const feats = [...t.features].sort(() => rand() - 0.5).slice(0, 3);
  const features = `${feats[0]}, ${feats[1]} and ${feats[2]}`;
  return { kind: t.kind, prompt: t.prompt.replace("{name}", name).replace("{features}", features) };
}

/** The topics a random intro picks from. */
export const RANDOM_TOPICS = TOPICS.map((t) => t.kind);
