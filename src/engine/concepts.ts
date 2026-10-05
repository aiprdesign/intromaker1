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
  | "reach"
  | "compare"
  | "solve"
  | "support"
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
  /**
   * What a product of this kind typically offers, in plain words (no claims): the feature cards
   * for a prompt that names none ("an intro for my bakery booking app"). The film says so in a
   * director's note, so the user can edit them to match.
   */
  starter?: string[];
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
    template: "ink",
    swap: "Your code, built|reviewed|shipped",
    starter: ["Deploy from Git", "Preview links", "Logs and monitoring", "Team workspaces"],
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
    starter: ["Ask in plain language", "First drafts", "Smart summaries", "Works with your tools"],
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
    template: "flow",
    swap: "Your spend, tracked|sorted|reported",
    starter: ["Cards and payments", "Invoices", "Expense tracking", "Finance reports"],
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
    starter: ["Threat detection", "Access control", "Audit logs", "Alerts"],
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
    template: "turntable",
    swap: "Your data, explored|measured|shared",
    starter: ["Dashboards", "Reports", "Data connectors", "Shared insights"],
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
    starter: ["Pipeline view", "Contact history", "Email follow-ups", "Forecasts"],
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
    starter: ["Email campaigns", "Audience segments", "Post scheduling", "Campaign reports"],
  },
  {
    id: "productivity",
    name: "Collaboration & productivity",
    keywords: /\b(collaborat(e|ion|ive)|projects?|tasks?|workspaces?|docs|notes|wiki|meetings?|kanban|productivity|remote|async|organi[sz]e)\b/g,
    icons: ["Users", "SquareKanban", "ListChecks", "MessagesSquare", "CalendarCheck", "FileText"],
    orbit: ["MessagesSquare", "CalendarCheck", "FileText", "Mail", "Video", "Folder", "GitBranch", "PenTool"],
    arc: ["hook", "pain", "reveal", "meet", "tour", "features", "how", "integrations", "quote", "logos", "cards", "bento", "cta"],
    eyebrows: { features: "In one place", integrations: "Works with your tools" },
    featuresTitle: "Your work, *in one place*",
    cta: ["Get started *free*", "Try it with your *team*", "Work with *{name}*"],
    template: "eclipse",
    swap: "Your work, planned|tracked|shared",
    starter: ["Tasks and projects", "Shared notes", "Team calendar", "Comments"],
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
    starter: ["Job posts", "Candidate tracking", "Interview scheduling", "New-starter checklists"],
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
    starter: ["Online store", "Checkout", "Order tracking", "Inventory"],
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
    starter: ["Online booking", "Appointment reminders", "Patient messaging", "Patient records"],
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
    template: "daybreak",
    swap: "Your courses, planned|published|tracked",
    starter: ["Courses", "Quizzes", "Progress tracking", "Certificates"],
  },
  {
    id: "creative",
    name: "Design & creative",
    keywords: /\b(design(ers)?|creative|video editing|photos?|photograph(y|ers?)|galler(y|ies)|editor|brand(ing)?|prototyp(e|ing)|canvas|illustrat(e|ion)|render(ing)?|animation|mockups?|figma)\b/g,
    icons: ["Palette", "PenTool", "Image", "Clapperboard", "Layers", "WandSparkles"],
    orbit: ["Image", "Video", "PenTool", "Palette", "Folder", "MessagesSquare", "Cloud", "Shapes"],
    arc: ["hook", "reveal", "tour", "features", "cards", "quote", "logos", "how", "integrations", "pain", "bento", "meet", "cta"],
    eyebrows: { features: "Create anything", tour: "See it in action" },
    featuresTitle: "Made for *creators*",
    cta: ["Start *creating*", "Try it *free*", "Create with *{name}*"],
    template: "holo",
    swap: "Your ideas, sketched|designed|shared",
    starter: ["Templates", "Brand kit", "Easy editing", "One-click export"],
  },
  {
    id: "communication",
    name: "Communication & support",
    keywords: /\b(chat|messaging|messages?|calls?|video calls?|inbox|support|help ?desk|customer (support|service)|tickets?|conversations?|live chat)\b/g,
    icons: ["MessagesSquare", "Headset", "Phone", "Video", "Mail", "Bell"],
    orbit: ["Mail", "Phone", "MessagesSquare", "Smartphone", "Globe", "Database", "Bot", "CalendarCheck"],
    arc: ["pain", "hook", "reveal", "tour", "features", "how", "integrations", "quote", "logos", "cards", "bento", "meet", "cta"],
    eyebrows: { features: "Conversations", integrations: "Channels" },
    featuresTitle: "Your conversations, *one inbox*",
    cta: ["Try it *free*", "Support customers with *{name}*", "Get *started*"],
    template: "neon",
    swap: "Your inbox, sorted|routed|answered",
    starter: ["Shared inbox", "Website chat", "Video calls", "Notifications"],
  },
  {
    id: "fitness",
    name: "Fitness & wellbeing",
    keywords: /\b(fitness|workouts?|gym|exercis(e|es|ing)|personal trainers?|yoga|pilates|runners?|cycling|calories|nutrition|meal plans?|cardio|hiit|meditat(e|ion)|mindful(ness)?|habits?|sleep)\b/g,
    icons: ["Dumbbell", "Activity", "Flame", "Timer", "Trophy", "Footprints"],
    orbit: ["Smartphone", "HeartPulse", "Footprints", "Salad", "Moon", "CalendarCheck", "Trophy", "Users"],
    arc: ["hook", "pain", "reveal", "tour", "features", "how", "quote", "cards", "logos", "integrations", "bento", "meet", "cta"],
    eyebrows: { features: "Your training", how: "How it works", tour: "In your pocket" },
    featuresTitle: "Your training, *sorted*",
    cta: ["Start *training*", "Get *moving*", "Train with *{name}*"],
    template: "kinetic",
    swap: "Your goals, planned|tracked|smashed",
    starter: ["Workout plans", "Progress tracking", "Goals and streaks", "Guided sessions"],
  },
  {
    id: "food",
    name: "Food & hospitality",
    keywords: /\b(restaurants?|food|online orders?|order ahead|recipes?|meals?|dining|diners?|chefs?|kitchens?|bakery|bakeries|bakers?|caf(e|é)s?|coffee|takeaway|take-out|cook(ing)?|grocer(y|ies)|hospitality|book a table|table bookings?)\b/g,
    icons: ["Utensils", "ChefHat", "Coffee", "Croissant", "Pizza", "Salad"],
    orbit: ["Smartphone", "CreditCard", "CalendarCheck", "Truck", "Star", "Receipt", "MapPin", "Bell"],
    arc: ["hook", "reveal", "tour", "features", "how", "quote", "cards", "logos", "integrations", "pain", "bento", "meet", "cta"],
    eyebrows: { features: "On the menu", how: "How it works", tour: "Take a look" },
    featuresTitle: "Made for *hungry* people",
    cta: ["Order *now*", "Book a *table*", "Try *{name}*"],
    template: "editorial",
    swap: "Your orders, placed|cooked|served",
    starter: ["Online ordering", "Table bookings", "Digital menu", "Order updates"],
  },
  {
    id: "booking",
    name: "Booking & scheduling",
    keywords: /\b(bookings?|book online|reservations?|appointments?|salons?|spas?|barbers?|beauty|stylists?|time slots?|no-shows?|walk-ins?|online scheduling)\b/g,
    icons: ["CalendarCheck", "Clock", "Bell", "ConciergeBell", "CreditCard", "Users"],
    orbit: ["CalendarCheck", "Mail", "Smartphone", "CreditCard", "MessagesSquare", "MapPin", "Bell", "Star"],
    arc: ["pain", "hook", "reveal", "tour", "features", "how", "quote", "cards", "logos", "integrations", "bento", "meet", "cta"],
    eyebrows: { features: "Booking made easy", how: "How it works", pain: "The old way" },
    featuresTitle: "Booking, *made easy*",
    cta: ["Book *now*", "Start taking *bookings*", "Book with *{name}*"],
    template: "studio",
    swap: "Your diary, booked|reminded|paid",
    starter: ["Online booking", "Reminders", "Easy rescheduling", "Payments"],
  },
  {
    id: "travel",
    name: "Travel",
    keywords: /\b(travel(l?ers?|l?ing)?|trips?|flights?|hotels?|vacations?|holidays?|itinerar(y|ies)|destinations?|getaways?|backpack(ing|ers)?|tourism|tourists?|adventures?)\b/g,
    icons: ["Plane", "MapPin", "Luggage", "Hotel", "Compass", "Map"],
    orbit: ["Plane", "Hotel", "MapPin", "CreditCard", "CalendarCheck", "Camera", "Globe", "Smartphone"],
    arc: ["hook", "reveal", "tour", "features", "how", "reach", "quote", "cards", "logos", "integrations", "bento", "meet", "cta"],
    eyebrows: { features: "Plan your trip", how: "How it works", tour: "Take a look" },
    featuresTitle: "Your trips, *sorted*",
    cta: ["Plan your *trip*", "Start *exploring*", "Travel with *{name}*"],
    template: "aurora",
    swap: "Your trip, planned|booked|shared",
    starter: ["Flights and stays", "Trip itinerary", "Travel updates", "Shared plans"],
  },
  {
    id: "realestate",
    name: "Real estate",
    keywords: /\b(real estate|propert(y|ies)|homes|houses?|home buyers?|listings?|rentals?|renters?|landlords?|tenants?|mortgages?|realtors?|estate agents?|apartments?|viewings?|leases?)\b/g,
    icons: ["House", "Building2", "KeyRound", "MapPin", "Handshake", "FileSignature"],
    orbit: ["House", "MapPin", "CalendarCheck", "FileSignature", "Landmark", "Camera", "Mail", "Smartphone"],
    arc: ["hook", "reveal", "tour", "features", "how", "quote", "cards", "logos", "integrations", "pain", "bento", "meet", "cta"],
    eyebrows: { features: "Find your place", how: "How it works", tour: "Take a look" },
    featuresTitle: "Home, *made simple*",
    cta: ["Find your *home*", "List your *property*", "Move with *{name}*"],
    template: "luxe",
    swap: "Your home, found|viewed|yours",
    starter: ["Property listings", "Viewing bookings", "Offers", "Documents in one place"],
  },
  {
    id: "music",
    name: "Music & audio",
    keywords: /\b(music|songs?|playlists?|albums?|artists?|musicians?|bands?|podcasts?|audio|producers?|record labels?|concerts?|djs?|lyrics|radio)\b/g,
    icons: ["Music", "Headphones", "Mic", "AudioLines", "ListMusic", "Radio"],
    orbit: ["Headphones", "Mic", "Smartphone", "Heart", "Share2", "Radio", "Users", "Disc3"],
    arc: ["hook", "reveal", "tour", "features", "how", "quote", "cards", "logos", "integrations", "pain", "bento", "meet", "cta"],
    eyebrows: { features: "Made for music", how: "How it works", tour: "Take a listen" },
    featuresTitle: "Music, *your way*",
    cta: ["Start *listening*", "Share your *sound*", "Listen on *{name}*"],
    template: "bloom",
    swap: "Your sound, recorded|released|heard",
    starter: ["Playlists", "Artist pages", "New releases", "Listening stats"],
  },
  {
    id: "events",
    name: "Events & ticketing",
    keywords: /\b(events?|ticket(s|ing)|conferences?|festivals?|gigs?|meetups?|venues?|rsvps?|attendees?|weddings?|parties|summits?)\b/g,
    icons: ["Ticket", "CalendarDays", "PartyPopper", "MapPin", "Users", "QrCode"],
    orbit: ["Ticket", "Mail", "Smartphone", "CreditCard", "MapPin", "QrCode", "Camera", "MessagesSquare"],
    arc: ["hook", "reveal", "tour", "features", "how", "quote", "cards", "logos", "integrations", "pain", "bento", "meet", "cta"],
    eyebrows: { features: "Run your event", how: "How it works" },
    featuresTitle: "Events, *made easy*",
    cta: ["Get your *tickets*", "Create your *event*", "Host with *{name}*"],
    template: "horizon",
    swap: "Your event, planned|sold|remembered",
    starter: ["Ticketing", "Guest check-in", "Event schedule", "Attendee updates"],
  },
  {
    id: "legal",
    name: "Legal",
    keywords: /\b(legal|law|lawyers?|attorneys?|law firms?|contracts?|clauses?|litigation|legal cases?|case management|court|paralegals?|e-?signatures?|agreements?|ndas?|notar(y|ies))\b/g,
    icons: ["Scale", "FileSignature", "Gavel", "Briefcase", "ShieldCheck", "FileText"],
    orbit: ["FileText", "Signature", "Mail", "CalendarCheck", "Folder", "ShieldCheck", "Landmark", "Users"],
    arc: ["pain", "hook", "reveal", "tour", "features", "how", "quote", "logos", "cards", "integrations", "bento", "meet", "cta"],
    eyebrows: { features: "Built for legal teams", how: "How it works", pain: "The paperwork" },
    featuresTitle: "Legal work, *simplified*",
    cta: ["Book a *demo*", "Get *started*", "Work with *{name}*"],
    template: "swiss",
    swap: "Your contracts, drafted|reviewed|signed",
    starter: ["Contract templates", "E-signatures", "Case tracking", "Shared documents"],
  },
  {
    id: "logistics",
    name: "Logistics & delivery",
    keywords: /\b(logistics|fleets?|freight|shipments?|deliver(y|ies)|couriers?|delivery drivers?|route planning|dispatch(ers?)?|supply chains?|last[- ]mile|parcels?|trucks?)\b/g,
    icons: ["Truck", "Package", "Route", "MapPin", "Warehouse", "Boxes"],
    orbit: ["Truck", "Package", "MapPin", "Smartphone", "Warehouse", "Receipt", "Bell", "Database"],
    arc: ["pain", "hook", "reveal", "tour", "features", "how", "reach", "cards", "quote", "logos", "integrations", "bento", "meet", "cta"],
    eyebrows: { features: "Built for operations", how: "How it works" },
    featuresTitle: "Your deliveries, *on track*",
    cta: ["Book a *demo*", "Start *shipping*", "Deliver with *{name}*"],
    template: "midnight",
    swap: "Your deliveries, planned|tracked|done",
    starter: ["Live tracking", "Route planning", "Proof of delivery", "Fleet view"],
  },
  {
    id: "nonprofit",
    name: "Nonprofit & community",
    keywords: /\b(nonprofits?|non-profits?|charit(y|ies|able)|donat(e|es|ions?|ors?)|fundrais(e|ing|ers?)|volunteers?|supporters?|good causes?)\b/g,
    icons: ["HandHeart", "Heart", "Users", "Gift", "Globe", "Sprout"],
    orbit: ["Mail", "HandHeart", "CreditCard", "Users", "Share2", "CalendarCheck", "Globe", "Megaphone"],
    arc: ["hook", "pain", "reveal", "tour", "features", "how", "reach", "quote", "cards", "logos", "integrations", "bento", "meet", "cta"],
    eyebrows: { features: "For your cause", how: "How it works" },
    featuresTitle: "Good causes, *well run*",
    cta: ["Support the *cause*", "Start *fundraising*", "Give with *{name}*"],
    template: "daybreak",
    swap: "Your cause, shared|funded|growing",
    starter: ["Online donations", "Volunteer sign-ups", "Campaign pages", "Supporter updates"],
  },
  {
    id: "pets",
    name: "Pet care",
    keywords: /\b(pets?|dogs?|cats?|pupp(y|ies)|kittens?|vets?|veterinar(y|ians?)|grooming|groomers?|dog walk(ing|ers?)|pet sitt(ing|ers?)|kennels?)\b/g,
    icons: ["PawPrint", "Dog", "Cat", "Bone", "Heart", "CalendarCheck"],
    orbit: ["PawPrint", "CalendarCheck", "MapPin", "Camera", "MessagesSquare", "CreditCard", "Bell", "Smartphone"],
    arc: ["hook", "reveal", "tour", "features", "how", "quote", "cards", "logos", "integrations", "pain", "bento", "meet", "cta"],
    eyebrows: { features: "For your pets", how: "How it works" },
    featuresTitle: "Happy pets, *happy owners*",
    cta: ["Book *now*", "Get *started*", "Care with *{name}*"],
    template: "clay",
    swap: "Your pet, walked|fed|loved",
    starter: ["Easy booking", "Pet profiles", "Photo updates", "Reminders"],
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
  template: "epic",
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
  reach: "Earth",
  compare: "ArrowLeftRight",
  solve: "CircleCheck",
  support: "LifeBuoy",
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
  skill: "command-k" | "ai-prompt" | "click-flow" | "notify-stack" | "code-deploy" | "kanban" | "live-cursors" | "chat-thread" | "keycaps" | "toggle-list" | "changelog" | "calendar-drop" | "inbox-sweep" | "comment-pins" | "table-fill" | "phone-tour" | "drop-zone";
  title: string;
  eyebrow: string;
  /** click-flow: the button label; phone-tour: a notification; drop-zone: the file's name; kanban: its columns ("A / B / C"); live-cursors: the comment; chat-thread: the product's card ("Title — detail"). */
  action?: string;
  /**
   * command-k: supporting commands; click-flow: tasks; notify-stack: "Event — detail"; ai-prompt: [prompt];
   * code-deploy: pipeline steps; kanban / live-cursors: cards; chat-thread: messages.
   */
  items: string[];
}

const PALETTE_CMDS = ["Search your workspace", "Invite a teammate", "Open settings"];

export const DEMOS: Record<string, DemoSpec> = {
  devtools: { skill: "command-k", title: "Your tools, one *keystroke* away", eyebrow: "Keyboard-first", items: ["View deploy logs", "Open preview URL", "Search docs"] },
  productivity: { skill: "command-k", title: "Your tools, one *keystroke* away", eyebrow: "Keyboard-first", items: PALETTE_CMDS },
  ai: { skill: "ai-prompt", title: "Just *ask*.", eyebrow: "AI built in", items: ["What can you do, {name}?"] },
  fintech: {
    skill: "click-flow", title: "Month-end, *handled*", eyebrow: "Automations", action: "Approve",
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
    skill: "notify-stack", title: "Your conversations, *one place*", eyebrow: "Live",
    items: ["New message — The team replied", "You were mentioned — In #launch", "Call starting — The team is joining", "Thread resolved — Marked done"],
  },
  pets: {
    skill: "click-flow", title: "Pet care, *sorted*", eyebrow: "In action", action: "Book",
    items: ["Pick a time", "Add your pet's details", "Confirm the booking", "Get photo updates"],
  },
  fitness: {
    skill: "click-flow", title: "Your plan, *ready*", eyebrow: "In action", action: "Start workout",
    items: ["Warm up", "Log your sets", "Track your progress", "Keep the streak going"],
  },
  booking: {
    skill: "click-flow", title: "Bookings, *handled*", eyebrow: "In action", action: "Confirm",
    items: ["Pick a time", "Confirm the booking", "Send a reminder", "Take payment"],
  },
  travel: {
    skill: "click-flow", title: "Your trip, *planned*", eyebrow: "In action", action: "Book trip",
    items: ["Choose flights", "Pick a place to stay", "Build the itinerary", "Share with friends"],
  },
  music: {
    skill: "click-flow", title: "From studio to *stream*", eyebrow: "In action", action: "Release",
    items: ["Upload the tracks", "Add the artwork", "Pick a release date", "Share the link"],
  },
  legal: {
    skill: "click-flow", title: "Paperwork, *handled*", eyebrow: "In action", action: "Send for signature",
    items: ["Draft the contract", "Review the clauses", "Collect approvals", "Send for e-signature"],
  },
  food: {
    skill: "notify-stack", title: "Your kitchen, *in sync*", eyebrow: "Live",
    items: ["New order — Two mains, one dessert", "Order ready — Out to the table", "Reservation — Party of four, 7:30", "New review — From a guest"],
  },
  realestate: {
    skill: "notify-stack", title: "Your listings, *live*", eyebrow: "Live",
    items: ["New enquiry — About a two-bed flat", "Viewing booked — Saturday, 11:00", "Offer received — Ready to review", "Documents signed — Ready to file"],
  },
  events: {
    skill: "notify-stack", title: "Your event, *live*", eyebrow: "Live",
    items: ["Ticket sold — General admission", "Guest checked in — At the door", "Schedule updated — Sent to attendees", "Feedback in — From a guest"],
  },
  logistics: {
    skill: "notify-stack", title: "Your deliveries, *tracked*", eyebrow: "Live",
    items: ["Order picked — Packed and ready", "Out for delivery — Driver on the way", "Delivered — Signed for at the door", "Route updated — Traffic avoided"],
  },
  nonprofit: {
    skill: "notify-stack", title: "Your cause, *moving*", eyebrow: "Live",
    items: ["New donation — Thank-you sent", "Volunteer signed up — For Saturday", "Campaign shared — By a supporter", "Update posted — Sent to supporters"],
  },
};

/** Other moments a category's films also stage (candidates for the fit ranking below). */
export const DEMO_ALTS: Record<string, DemoSpec[]> = {
  devtools: [{ skill: "code-deploy", title: "From commit to *live*", eyebrow: "Ship it", items: ["Build started", "Checks passed", "Preview ready", "Deployed to production"] }],
  productivity: [
    { skill: "kanban", title: "Work that *moves*", eyebrow: "In action", action: "To do / In progress / Done", items: ["Plan the launch", "Design the homepage", "Write release notes", "Review with the team"] },
  ],
  sales: [
    { skill: "kanban", title: "Your deals, *moving forward*", eyebrow: "Pipeline", action: "Lead / Demo / Won", items: ["New inbound lead", "Discovery call", "Proposal sent", "Contract review"] },
  ],
  hr: [
    { skill: "kanban", title: "Hiring, *in one view*", eyebrow: "Pipeline", action: "Applied / Interview / Hired", items: ["Product designer", "Frontend engineer", "Account executive", "Support lead"] },
  ],
  communication: [
    {
      skill: "chat-thread", title: "Your conversations, *one place*", eyebrow: "In action", action: "Launch checklist — Tasks complete",
      items: ["Is the launch page ready to go?", "Final copy is in, checking the visuals now", "Looks great, let's ship it"],
    },
  ],
  creative: [
    { skill: "live-cursors", title: "Create it *together*", eyebrow: "Multiplayer", action: "Love this direction", items: ["Moodboard", "Homepage hero", "Brand colours", "Launch visuals"] },
  ],
};

/** A board every teammate works on at once: the live-cursors moment. */
export const COLLAB_DEMO: DemoSpec = {
  skill: "live-cursors", title: "Build it *together*", eyebrow: "Multiplayer", action: "Looks great, let's ship it",
  items: ["Launch plan", "Homepage design", "Customer research", "Release notes"],
};

/* ───────── Which moment suits this product best ───────── */

type MomentSkill = DemoSpec["skill"];

/** What each moment shows, as the words a site uses when that's what its product does. */
const MOMENT_SIGNALS: Record<MomentSkill, RegExp> = {
  "command-k": /\b(keyboard|shortcuts?|command (menu|palette|bar)|cmd ?\+? ?k|⌘ ?k|launcher|power users?|hotkeys?|keystrokes?)\b/gi,
  "ai-prompt": /\b(ai|a\.i\.|artificial intelligence|assistants?|copilots?|gpt|llms?|chatbots?|ask (it )?(anything|questions?)|prompts?|generative)\b/gi,
  "click-flow": /\b(automat\w*|autopilot|workflows?|one[- ]click|busywork|reconcil\w*|approvals?|approve|scheduling|no[- ]code|hands[- ]free)\b/gi,
  "notify-stack": /\b(alerts?|notifications?|notify|real[- ]time|monitor\w*|orders?|incidents?|instant(ly)?|as it happens|stay on top)\b/gi,
  // (Not "developers": that's who a product is for, and a design tool hands off to developers.)
  "code-deploy": /\b(deploy\w*|git(hub|lab)?|commits?|ci\/cd|build (logs|pipelines?)|preview (urls?|deployments?)|hosting|serverless|edge functions?|rollbacks?|apis?|sdks?|cli|repos?|codebase)\b/gi,
  // (Bare "deals" and "stages" aren't boards: "hotel deals", "early-stage".)
  kanban: /\b(kanban|boards?|tasks?|to-?dos?|projects?|sprints?|roadmaps?|backlogs?|issues?|tickets?|pipelines?|deal (flow|stages?)|candidates?|applicants?|hiring|recruit\w*)\b/gi,
  "live-cursors": /\b(collaborat\w*|multiplayer|whiteboards?|canvas(es)?|co-?edit\w*|brainstorm\w*|together|design (files?|tools?|teams?)|mood ?boards?|prototyp\w*|comment(s|ing)?|feedback|hand ?off|figma|wireframes?)\b/gi,
  "chat-thread": /\b(chat|messag\w*|channels?|conversations?|threads?|dms?|inbox(es)?|help ?desk|live chat|team communication|support tickets?)\b/gi,
  // Launch-film moments (see skills/launch.ts).
  keycaps: /\b(keyboard[- ]first|keyboard shortcuts?|shortcuts?|hotkeys?|keystrokes?|keybindings?|power users?)\b/gi,
  "toggle-list": /\b(settings?|preferences?|permissions?|customi[sz]\w*|configur\w*|toggles?|controls?|privacy controls?|admin controls?)\b/gi,
  changelog: /\b(changelog|release notes?|what'?s new|new releases?|product updates?|version history|roadmaps?|ship(s|ping)? (weekly|often|every week))\b/gi,
  "calendar-drop": /\b(calendars?|schedul\w*|meetings?|bookings?|book (a|your)|appointments?|availability|time[- ]?blocking|agendas?|week view)\b/gi,
  "inbox-sweep": /\b(e-?mails?|inbox(es)?|newsletters?|triage|mail ?box|follow[- ]ups?|unread)\b/gi,
  "comment-pins": /\b(comments?|annotat\w*|feedback|proofing|markups?|mentions?|review (cycles?|rounds?)|design reviews?|approve designs?)\b/gi,
  // Story beats (see skills/beats.ts): the product on a phone; a file in, a result out.
  "phone-tour": /\b(mobile apps?|ios|android|iphone|app store|google play|on the go|on your phone|download the app)\b/gi,
  // (Not bare "files" or "docs": a workspace has those without anyone dropping a file in.)
  "drop-zone": /\b(upload\w*|drag (and|&) drop|pdfs?|(your|any) (files?|documents?)|convert\w*|transcri\w*|summari[sz]\w*|extract\w*|resiz\w*|compress\w*)\b/gi,
  "table-fill": /\b(spreadsheets?|tables?|databases?|records?|rows?|columns?|csv|data(sets?| entry| grid)|crm|trackers?|inventory|catalogs?)\b/gi,
};

/** The copy each moment falls back on when the product's own category has none for it. */
const GENERIC_MOMENT: Record<MomentSkill, DemoSpec> = {
  "command-k": { skill: "command-k", title: "Your tools, one *keystroke* away", eyebrow: "Keyboard-first", items: ["Search your workspace", "Invite a teammate", "Open settings"] },
  "ai-prompt": { skill: "ai-prompt", title: "Just *ask*.", eyebrow: "AI built in", items: ["What can you do, {name}?"] },
  "click-flow": { skill: "click-flow", title: "Busywork, *handled*", eyebrow: "In action", action: "Run", items: ["Sync your data", "Update the records", "Notify the team", "Share the summary"] },
  "notify-stack": {
    skill: "notify-stack", title: "Updates, *as they happen*", eyebrow: "Live",
    items: ["New update — The team made changes", "Task completed — Marked done", "Report ready — This week's summary", "You were mentioned — In a comment"],
  },
  "code-deploy": { skill: "code-deploy", title: "From commit to *live*", eyebrow: "Ship it", items: ["Build started", "Checks passed", "Preview ready", "Deployed to production"] },
  kanban: { skill: "kanban", title: "Work that *moves*", eyebrow: "In action", action: "To do / In progress / Done", items: ["Plan the launch", "Design the homepage", "Write release notes", "Review with the team"] },
  "live-cursors": COLLAB_DEMO,
  "chat-thread": {
    skill: "chat-thread", title: "Your conversations, *one place*", eyebrow: "In action", action: "Update — Tasks complete",
    items: ["Is the launch page ready to go?", "Final copy is in, checking the visuals now", "Looks great, let's ship it"],
  },  keycaps: { skill: "keycaps", title: "Do it from the *keyboard*", eyebrow: "Keyboard-first", items: ["⌘ K — Open the command menu", "C — Create a task", "⌘ ↵ — Send it"] },
  "toggle-list": { skill: "toggle-list", title: "Make it *yours*", eyebrow: "Settings", items: ["Smart reminders", "Shared workspaces", "Weekly summaries", "Dark mode"] },
  changelog: { skill: "changelog", title: "What's *new*", eyebrow: "Changelog", items: ["Shared views", "Calendar sync", "A new search", "Dark mode"] },
  "calendar-drop": { skill: "calendar-drop", title: "Your week, *planned*", eyebrow: "In action", items: ["Team standup", "Design review", "Launch planning", "Customer call", "Focus time"] },
  "inbox-sweep": { skill: "inbox-sweep", title: "Clear your *inbox*", eyebrow: "In action", items: ["Weekly summary is ready", "Notes from the design review", "Your invite to the launch", "Feedback on the new homepage"] },
  "comment-pins": { skill: "comment-pins", title: "Feedback, *in context*", eyebrow: "Collaboration", items: ["Love this direction", "@Leo can we try a lighter header?", "The new copy reads well"] },
  "phone-tour": { skill: "phone-tour", title: "Your work, *in your pocket*", eyebrow: "Mobile app", action: "New update — Your summary is ready", items: ["Your day at a glance", "Updates as they happen", "Share in a tap"] },
  "drop-zone": { skill: "drop-zone", title: "Drop it in, *get it back*", eyebrow: "In action", action: "meeting-notes.pdf", items: ["Summary", "Key points", "Next steps"] },
  "table-fill": { skill: "table-fill", title: "Your data, *organised*", eyebrow: "In action", items: ["Launch plan", "Homepage refresh", "Customer research", "Release notes", "Onboarding emails"] },
};

/** A moment's own stock copy (title, eyebrow, items), for a moment slide added to a film by hand. */
export function momentCopy(skill: string): DemoSpec | undefined {
  return (GENERIC_MOMENT as Record<string, DemoSpec>)[skill];
}

const CHAT_SUPPORT: DemoSpec = {
  skill: "chat-thread", title: "Questions in, *answers out*", eyebrow: "In action", action: "Conversation resolved — Marked done",
  items: ["Hi, where can I find my invoice?", "It's in Billing, I've sent you the link", "Found it, thank you!"],
};
const CHAT_CARE: DemoSpec = {
  skill: "chat-thread", title: "Care, *a message away*", eyebrow: "In action", action: "Appointment updated — Reminder sent",
  items: ["Can I move my appointment to Friday?", "Of course, Friday morning works", "Great, thank you!"],
};

export interface MomentFit {
  spec: DemoSpec;
  score: number;
  /** The site's own words that point to this moment (for the director's note). */
  because: string[];
}

/**
 * Rank the interaction moments for a product by how well each suits it: the words the site
 * itself uses (its tagline and description count double), the moment its category's films
 * typically stage, and what the site has to show. The director uses the best fit; nothing is
 * left to chance.
 */
export function rankMoments(lead: string, body: string, conceptId: string, opts: { aiLed?: boolean; spareFeatures?: number } = {}): MomentFit[] {
  const main = DEMOS[conceptId] ?? DEMOS.general;
  const alts = DEMO_ALTS[conceptId] ?? [];
  const pick = (skill: MomentSkill): DemoSpec => {
    // Pipelines: a sales or hiring board when that's what the words describe.
    if (skill === "kanban") {
      if (/\b(deals?|leads?|prospects?|crm|sales pipeline)\b/i.test(`${lead} ${body}`)) return DEMO_ALTS.sales[0];
      if (/\b(candidates?|applicants?|hiring|recruit\w*|talent)\b/i.test(`${lead} ${body}`)) return DEMO_ALTS.hr[0];
    }
    // Conversations in the product's own world: patients and a care team, customers and support.
    if (skill === "chat-thread") {
      if (conceptId === "health") return CHAT_CARE;
      if (/\b(customers?|help ?desk|support (team|tickets?)|live chat|tickets?)\b/i.test(`${lead} ${body}`)) return CHAT_SUPPORT;
    }
    return main.skill === skill ? main : alts.find((a) => a.skill === skill) ?? GENERIC_MOMENT[skill];
  };
  const out = (Object.keys(MOMENT_SIGNALS) as MomentSkill[]).map((skill) => {
    const re = MOMENT_SIGNALS[skill];
    const hits = [...lead.matchAll(re)].map((m) => m[0].toLowerCase());
    const more = [...body.matchAll(re)].map((m) => m[0].toLowerCase());
    // Distinct words count, repeats count less: one page saying "tasks" ten times isn't ten signals.
    const words = new Set([...hits, ...more]);
    let score = Math.min(8, hits.length * 2 + Math.min(more.length, 4) + words.size * 0.5);
    if (main.skill === skill) score += 3;
    else if (alts.some((a) => a.skill === skill)) score += 2;
    if (skill === "ai-prompt" && opts.aiLed) score += 3;
    // A shared board shows the product's own features as its cards: better with enough of them.
    if (skill === "live-cursors" && (opts.spareFeatures ?? 0) >= 3) score += 0.5;
    // The words behind it, once each ("pipeline" and "pipelines", "real time" and "real-time").
    const stems = new Map<string, string>();
    for (const wd of words) {
      const stem = wd.replace(/[-\s]+/g, " ").replace(/s$/, "").replace(/e$/, "");
      if (!stems.has(stem)) stems.set(stem, wd);
    }
    return { spec: pick(skill), score, because: [...stems.values()].slice(0, 4) };
  });
  // Ties go to the category's own moment, then to its alternates, then to the list order.
  const order = (x: MomentFit) => (x.spec.skill === main.skill ? 0 : alts.some((a) => a.skill === x.spec.skill) ? 1 : 2);
  return out.sort((a, b) => b.score - a.score || order(a) - order(b));
}

