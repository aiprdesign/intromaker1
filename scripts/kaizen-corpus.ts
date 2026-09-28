/**
 * Kaizen test corpus: realistic website extracts across product categories plus edge cases
 * (sparse sites, wordy copy, no proof), and free-text prompts. Used by scripts/kaizen.ts.
 */
import type { SiteData } from "../src/engine/types";
import flowbaseJson from "./kaizen-flowbase.json";
import orbitJson from "./kaizen-orbit.json";

const flowbase = { ...(flowbaseJson as unknown as { site: SiteData }).site, shots: { hero: null, full: null, sections: [] } } as SiteData;
const media = { images: flowbase.images.slice(0, 4), videos: flowbase.videos, logo: flowbase.logo };
const logos = flowbase.clientLogos;
const q = (quote: string, author: string, role: string) => ({ quote, author, role, avatar: null });

const base = (over: Partial<SiteData>): SiteData => ({
  url: "https://example.com",
  domain: "example.com",
  name: "Example",
  tagline: "",
  description: "",
  headlines: [],
  features: [],
  stats: [],
  testimonials: [],
  clientLogos: [],
  steps: [],
  pains: [],
  font: null,
  shots: { hero: null, full: null, sections: [] },
  cta: null,
  logo: null,
  images: [],
  videos: [],
  themeColor: null,
  ...over,
});

// A live capture with the page's UI components cut out (hero + parts), no product images.
const orbit = (orbitJson as unknown as { site: SiteData }).site;

export const SITES: { id: string; site: SiteData }[] = [
  { id: "flowbase (sales)", site: flowbase },
  { id: "orbit (analytics, components)", site: orbit },
  {
    id: "nimbus (devtools)",
    site: base({
      ...media,
      url: "https://nimbus.dev",
      domain: "nimbus.dev",
      name: "Nimbus",
      tagline: "Deploy at the speed of git push",
      description: "Nimbus is the developer platform for shipping full-stack apps to the edge with zero config. Preview URLs, instant rollbacks and edge functions built in.",
      headlines: ["Zero-config deployments", "Preview every pull request", "Instant rollbacks", "Edge functions in 40 regions", "Built-in observability"],
      features: ["Push to git and your app is live in seconds.", "Every PR gets its own URL your team can review.", "Undo any deploy with one click.", "Run code close to your users.", "Logs, traces and metrics out of the box."],
      stats: ["99.99% uptime", "40 regions", "2M+ deploys a day"],
      testimonials: [q("We cut our release time from hours to minutes. Nimbus just works.", "Priya Shah", "CTO, Loop")],
      steps: ["Install the CLI", "Connect your repo", "Push to deploy"],
      pains: ["Slow builds", "Config files", "Broken staging"],
      cta: "Start deploying",
    }),
  },
  {
    id: "scribe (ai, no steps/pains/quotes)",
    site: base({
      ...media,
      url: "https://scribe.ai",
      domain: "scribe.ai",
      name: "Scribe",
      tagline: "Your AI writing partner",
      description: "Scribe drafts emails, docs and replies in your voice using AI that learns how your team writes.",
      headlines: ["Drafts in your voice", "Summaries in one click", "Works in every app", "Private by design", "Learns your style"],
      features: ["Scribe writes like you, not like a robot.", "Turn long threads into three bullet points.", "Gmail, Slack, Notion and 50 more.", "Your data never trains public models.", ""],
      clientLogos: logos,
      cta: "Try Scribe free",
    }),
  },
  {
    id: "ledgerly (fintech)",
    site: base({
      ...media,
      url: "https://ledgerly.com",
      domain: "ledgerly.com",
      name: "Ledgerly",
      tagline: "Business banking that runs itself",
      description: "Ledgerly gives startups a business account, corporate cards and automated expense reports in one place.",
      headlines: ["Corporate cards for every employee", "Receipts matched automatically", "Real-time spend controls"],
      features: ["Issue virtual and physical cards in seconds.", "Snap a photo and Ledgerly does the rest.", "Set limits by team, vendor or project."],
      stats: ["$4B+ processed", "30,000+ businesses"],
      testimonials: [q("Month-end close went from ten days to two.", "Marco Diaz", "Head of Finance, Brightline")],
      pains: ["Expense spreadsheets", "Lost receipts", "Surprise card bills"],
      cta: "Open an account",
    }),
  },
  {
    id: "sentinel (security, no quote)",
    site: base({
      ...media,
      url: "https://sentinel.io",
      domain: "sentinel.io",
      name: "Sentinel",
      tagline: "Stop threats before they spread",
      description: "Sentinel is the zero-trust security platform that detects attacks in real time and keeps you SOC 2 compliant.",
      headlines: ["Real-time threat detection", "Zero-trust access", "Automated compliance", "One-click incident response"],
      features: ["AI flags suspicious behaviour in milliseconds.", "Every login verified, every device checked.", "SOC 2 and ISO 27001 evidence collected for you.", "Contain a breach from a single screen."],
      stats: ["2.5B events a day", "99.9% detection rate", "5,000+ security teams"],
      clientLogos: logos,
      pains: ["Alert fatigue", "Manual audits"],
      cta: "Book a demo",
    }),
  },
  {
    id: "shopwave (ecommerce)",
    site: base({
      ...media,
      url: "https://shopwave.com",
      domain: "shopwave.com",
      name: "Shopwave",
      tagline: "Sell anywhere, grow everywhere",
      description: "Shopwave is the e-commerce platform for brands: beautiful stores, one-page checkout and shipping in one place.",
      headlines: ["Stunning storefronts", "One-page checkout", "Shipping made simple", "Inventory in sync", "Marketing built in", "Payments in 130 currencies"],
      features: ["Launch a store in minutes with themes that convert.", "Fewer clicks, more sales.", "Print labels and track every order.", "Every channel, one stock count.", "", ""],
      stats: ["1M+ merchants"],
      testimonials: [q("Our conversion rate doubled after we switched.", "Lena Park", "Founder, Kinfolk Goods"), q("Setup took an afternoon.", "Tom Reid", "CEO, Tidewear")],
      cta: "Start selling",
    }),
  },
  {
    id: "tiny (sparse site)",
    site: base({
      url: "https://tiny.app",
      domain: "tiny.app",
      name: "Tiny",
      tagline: "Notes that stay out of your way",
      description: "A minimal notes app.",
      headlines: ["Fast notes"],
    }),
  },
  {
    id: "verbose (long copy)",
    site: base({
      ...media,
      url: "https://verbose.co",
      domain: "verbose.co",
      name: "Verbose",
      tagline: "The all-in-one collaborative workspace platform that helps modern distributed teams plan, track and ship their most important projects together",
      description: "Verbose brings your team's projects, documents, tasks, meetings and conversations together into one beautifully designed collaborative workspace for everyone.",
      headlines: [
        "Plan every single project with flexible boards, timelines and calendars your whole team will love",
        "Keep all of your documents, notes and wikis in one searchable place",
        "Automate the repetitive busywork so your team can focus on what matters most",
        "Integrates seamlessly with the 200+ tools your team already uses every day",
      ],
      features: ["Boards, timelines and calendars.", "Docs and wikis.", "Automations.", "Integrations."],
      stats: ["25,000+ teams"],
      steps: ["Create your workspace and invite your whole team", "Import projects from your existing tools", "Start collaborating in real time"],
      cta: "Get started for free",
    }),
  },
  {
    // Marketing copy that is almost all claims: what's left in claim-safe mode must still carry a film.
    id: "rocketly (hype copy)",
    site: base({
      ...media,
      url: "https://rocketly.io",
      domain: "rocketly.io",
      name: "Rocketly",
      tagline: "The world's #1 AI sales platform",
      description: "Rocketly is the fastest way to find, engage and close your best leads. Our award-winning AI works 24/7 so you never miss a deal again.",
      headlines: [
        "10x your pipeline in minutes",
        "The most powerful lead scoring ever built",
        "Never miss a follow-up again",
        "Everything you need to close more deals",
        "Automatic email sequences",
        "Trusted by 50,000+ sales teams",
      ],
      features: [
        "Our AI finds your best leads instantly.",
        "Industry-leading accuracy scores every lead in real time.",
        "Rocketly reminds your reps when a deal goes quiet.",
        "Sequences, dialer, pipeline and reports in one place.",
        "Write once and Rocketly sends personalised follow-ups on schedule.",
        "",
      ],
      stats: ["50,000+ teams", "3x more meetings", "98% satisfaction"],
      testimonials: [q("Rocketly is hands down the best sales tool we've ever used.", "Sam Ortiz", "VP Sales, Brightline")],
      clientLogos: logos,
      steps: ["Connect your CRM", "Import your leads", "Launch your first sequence"],
      pains: ["Cold leads", "Manual follow-ups", "Messy spreadsheets"],
      cta: "Start your free trial",
    }),
  },
];

export const PROMPTS: string[] = [
  'Launch video for "Pulse", an analytics app for product teams: real-time dashboards, funnels, 10,000+ teams',
  "Nimbus is a developer platform with instant rollbacks, preview URLs and edge functions",
  "Ledgerly: business banking, corporate cards and automated expenses for startups",
  "Meet Harbor, the AI assistant that writes your emails and summarises your meetings",
  "Sentinel stops cyber threats in real time and keeps you SOC 2 compliant",
  "Shopwave helps brands sell online with beautiful stores, fast checkout and easy shipping",
  "Hirely: an applicant tracking system for fast-growing recruiting teams",
  "A productivity app",
];
