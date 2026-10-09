import type { CharacterKind, VideoPlan } from "./types";

/**
 * Which Cartoon style, and which characters in it, suit an intro, from its description:
 *
 * - The description asks for characters (a cartoon, a mascot, stick figures, a video for kids…):
 *   the best-fitting style and characters from the words used.
 * - It doesn't, but the theme works better with characters than with screens (a kids' app, a
 *   classroom, hiring and teams, a retro brand): the pick made for that theme. The studio only
 *   applies this to words-only videos, never to ones built from a site's screenshots.
 *
 * Characters (plan.characters) are a choice inside the style, so the styles stay few: unset means
 * the style's own characters.
 */
export type CharacterPick = { template: string; characters?: CharacterKind };

/** The description asks for characters. */
export const WANTS_CHARACTERS = /\b(cartoons?|animated characters?|characters?|mascots?|kids?|children|preschool|animated explainer|abstract people|stick ?figures?|stickmen|stick ?people|blobs?|rubber ?hose|corporate memphis)\b/i;

/** The best style and characters for a description that asks for characters. */
export function cartoonPick(prompt: string): CharacterPick {
  const p = prompt.toLowerCase();
  // The kind of character, when it's named.
  if (/\b(stick ?figures?|stickmen|stick ?people|whiteboard|sketch(?:ed|y)?)\b/.test(p)) return { template: "cartoon", characters: "stick" };
  if (/\b(blobs?|kawaii|cute (?:monsters?|creatures?)|monsters?|creatures?)\b/.test(p)) return { template: "claybuddies", characters: "blob" };
  if (/\b(rubber ?hose|retro|vintage|classic cartoons?|old[- ]school|nostalgic|1920s|1930s)\b/.test(p)) return { template: "comic", characters: "classic" };
  if (/\b(corporate memphis|memphis|corporate|business|b2b|workplace|office|enterprise)\b/.test(p)) return { template: "memphis" };
  if (/\b(abstract|minimal|minimalist|geometric|shapes?)\b/.test(p)) return { template: /\b(crowd|parade)\b/.test(p) ? "memphis" : "abstract" };
  // The look.
  if (/\b(explainer|explains?|walkthrough|presenters?|hosts?|realistic|advanced characters?)\b/.test(p)) return { template: "explainer" };
  if (/\b(journey|adventure|together|community|friends)\b/.test(p) && /\b(outdoors?|parks?|nature|hills?|river)\b/.test(p)) return { template: "storycast" };
  if (/\b(comics?|superheroe?s?|funny|comedy|jokes?)\b/.test(p)) return { template: "comic" };
  if (/\b(story|stories|storybook|bedtime|fairy ?tales?|picture books?)\b/.test(p)) return { template: "storybook" };
  if (/\b(clay|plush|cuddly|squishy|toys?)\b/.test(p)) return { template: "claybuddies" };
  if (/\b(night|sleep|sleeping|dreams?|stars?|moon)\b/.test(p)) return { template: "nightowls" };
  if (/\b(outdoors?|outside|parks?|gardens?|gardening|farms?|nature|picnics?|camping|hiking|walks?)\b/.test(p)) return { template: "sunnypark" };
  // Who it's for.
  if (/\b(kids?|children|toddlers?|preschool|kindergarten|babies|baby)\b/.test(p)) return { template: "cartoon", characters: "blob" };
  if (/\b(school|classroom|teachers?|teaching|tutors?|tutoring|lessons?|homework|students?|course|courses|training)\b/.test(p)) return { template: "cartoon", characters: "stick" };
  if (/\b(hiring|recruit(?:ing|ment|ers?)?|hr|human resources|onboarding|employees?|teams?|remote work|collaboration)\b/.test(p)) return { template: "memphis" };
  return { template: "cartoon" };
}

/** A pick for a theme that works better with characters, or undefined. */
export function themePick(prompt: string): CharacterPick | undefined {
  const p = prompt.toLowerCase().replace(/\bmachine learning\b|\bdeep learning\b/g, "");
  if (/\b(kids?|children|child|toddlers?|preschool|kindergarten|parents?|parenting|families|family|babysit(?:ter|ting)?|daycare|nursery)\b/.test(p)) return { template: "cartoon", characters: "blob" };
  if (/\b(classroom|teachers?|teaching|tutors?|tutoring|homework|lessons?|school|schools|pupils|study buddy|flashcards?)\b/.test(p)) return { template: "cartoon", characters: "stick" };
  if (/\b(hiring|recruit(?:ing|ment|ers?)?|human resources|hr|onboarding new (?:hires|employees)|employee (?:wellbeing|engagement|experience)|team building|company culture|diversity|inclusion|volunteers?|volunteering|non-?profits?|charity|charities|community groups?)\b/.test(p)) return { template: "memphis" };
  if (/\b(home ?builders?|house ?builders?|custom homes?|new[- ]build homes?|real estate|realtors?|estate agents?|show ?homes?)\b/.test(p)) return { template: /\b(cartoons?|animated|characters?)\b/.test(p) ? "cartoon" : "editorial" };
  if (/\b(retro|vintage|nostalgic|old[- ]school|classic diner|since 19\d\d|1920s|1930s|1950s)\b/.test(p)) return { template: "comic", characters: "classic" };
  return undefined;
}

/**
 * Where an intro's characters belong, from its description: a construction site for builders, a
 * hospital for health care, a classroom for schools… Undefined keeps the style's own stage. It
 * applies to flat Cartoon styles (see templates.ts staged()).
 */
export function scenePick(prompt: string): VideoPlan["setting"] {
  const p = prompt.toLowerCase();
  // (An agency's own office before the homes it sells.)
  if (/\b(real estate agen\w*|realtors?|realty|estate agents?|brokerages?)\b/.test(p)) return "realty";
  if (/\b(home ?builders?|house ?builders?|custom homes?|new homes?|new[- ]build|real estate|realtors?|estate agents?|propert(?:y|ies) (?:listings?|developers?|management)|homes? for sale|house hunting|mortgages?|interior design(?:ers?)?|show ?homes?)\b/.test(p)) return "house";
  // Professional services, each in its own place (before the broader salon, garage, clinic and office rules).
  if (/\b(tattoos?|tattoo (?:studios?|shops?|artists?)|piercings?)\b/.test(p)) return "tattoo";
  if (/\b(pet grooming|dog grooming|(?:dog|cat|pet) and (?:dog|cat|pet) grooming|grooming salons?|groomers?|pet spa|dog wash)\b/.test(p)) return "petgroom";
  // (A body shop details cars too, but it's a garage.)
  if (/\b(collision|body shops?|auto repairs?|mechanics?)\b/.test(p)) return "garage";
  if (/\b(car wash(?:es)?|auto spa|detailing)\b/.test(p)) return "carwash";
  if (/\b(law (?:firms?|offices?|practices?)|lawyers?|attorneys?|solicitors?|legal (?:services?|advice|practice)|paralegals?|notar(?:y|ies)|estate planning|family law|personal injury)\b/.test(p)) return "law";
  if (/\b(dentists?|dental|orthodont\w*|teeth whitening|hygienists?)\b/.test(p)) return "dental";
  if (/\b(tax (?:prep\w*|preparers?|returns?|services?|offices?)|accountants?|accounting (?:firms?|offices?|practices?|services?)|bookkeepers?|bookkeeping (?:services?|offices?)|cpas?)\b/.test(p)) return "accounting";
  if (/\b(electricians?|electrical (?:contractors?|services?|work|repairs?)|rewir\w*|wiring|panel upgrades?|ev charger install\w*)\b/.test(p)) return "electrical";
  if (/\b(hvac|heating and (?:air|cooling)|heating|cooling|air condition\w*|furnaces?|heat pumps?|ac repairs?)\b/.test(p)) return "hvac";
  if (/\b(photographers?|photography (?:studios?|business(?:es)?|services?)|photo studios?|portrait studios?|headshots?|wedding photo\w*)\b/.test(p)) return "photo";
  if (/\b(movers?|moving (?:company|companies|services?|day|trucks?)|removals?|relocations?)\b/.test(p)) return "moving";
  if (/\b(opticians?|optical|optometr\w*|eye ?glasses|eyewear|spectacles|eye exams?|contact lenses|frames and lenses)\b/.test(p)) return "optical";
  if (/\b(family (?:doctors?|medicine|practices?|physicians?)|doctors?|physicians?|general practi\w*|p(?:a)?ediatric\w*|primary care|urgent care|walk-in clinics?|clinics?)\b/.test(p)) return "doctor";
  if (/\b(insurance|insurers?)\b/.test(p)) return "insurance";
  if (/\b(used cars?|pre-?owned|car lots?|used car (?:lots?|dealer\w*))\b/.test(p)) return "usedcars";
  if (/\b(car dealer\w*|dealerships?|new cars?|auto (?:dealer\w*|sales)|showrooms?|test drives?)\b/.test(p)) return "showroom";
  if (/\b(food banks?|food pantr(?:y|ies)|soup kitchens?|meal programs?|food drives?)\b/.test(p)) return "foodbank";
  if (/\b(farms?|farmers?|farm stands?|orchards?|ranch(?:es)?|farmers'? markets?|produce boxes)\b/.test(p)) return "farm";
  if (/\b(artists?|art (?:studios?|classes|galler(?:y|ies)|schools?|lessons)|paintings?|galler(?:y|ies)|ceramics|pottery|illustrators?)\b/.test(p)) return "art";
  if (/\b(dance (?:studios?|classes|schools?|lessons|academy)|ballet|dancers?|dance|salsa (?:classes|dancing)|hip-?hop classes|tap and jazz)\b/.test(p)) return "dance";
  if (/\b(barbers?|barbershops?|hair ?salons?|salons?|hairdress(?:ers?|ing)|stylists?|nail (?:salons?|bars?|studios?)|manicures?|beauty|tattoo(?:s| studios?| shops?)?|pet grooming|groomers?)\b/.test(p)) return "salon";
  if (/\b(auto repair|mechanics?|garages?|car wash(?:es)?|detailing|oil changes?|tire|tyre|body shop|auto care)\b/.test(p)) return "garage";
  if (/\b(gyms?|boxing|crossfit|personal train(?:ing|ers?)|fitness (?:club|studio|centre|center)|martial arts|weight ?lifting)\b/.test(p)) return "gym";
  if (/\b(yoga|pilates|dance (?:studio|classes|school)|dance|ballet|meditation studio|barre)\b/.test(p)) return "yoga";
  if (/\b(florists?|flower shops?|flowers?|bouquets?|plant shops?|garden cent(?:re|er)s?)\b/.test(p)) return "florist";
  if (/\b(thrift|second-?hand|consignment|resale|pre-?loved|op shops?|charity shops?)\b/.test(p)) return "thrift";
  if (/\b(bookstores?|bookshops?|books|used books|librar(?:y|ies)|book clubs?)\b/.test(p)) return "bookstore";
  if (/\b(hotels?|inns?|bed and breakfast|b&bs?|motels?|guest ?houses?|resorts?|lodges?|vacation rentals?)\b/.test(p)) return "hotel";
  if (/\b(roof(?:ers?|ing|s)?|shingles?|gutters?)\b/.test(p)) return "roofing";
  if (/\b(plumb(?:ers?|ing)|drains?|water heaters?|leaks?|pipes?)\b/.test(p)) return "plumbing";
  if (/\b(lawns?|lawn care|mowing|landscap(?:ing|ers?)|gardeners?|yard work|hedges?|tree trimming)\b/.test(p)) return "lawn";
  if (/\b(cleaning (?:company|service|services)|cleaners?|maid services?|janitorial|house ?keeping|deep cleans?|move-out cleans?)\b/.test(p)) return "cleaning";
  if (/\b(ice ?cream|gelato|frozen yogh?urt|creamer(?:y|ies)|sundaes?|scoops?)\b/.test(p)) return "icecream";
  if (/\b(churche?s?|chapels?|parish(?:es)?|congregations?|ministr(?:y|ies)|worship|sunday services?)\b/.test(p)) return "church";
  if (/\b(music (?:shops?|stores?|teachers?|schools?)|guitars?|instruments?|music lessons?|(?:piano|guitar|voice|singing|violin|drum) (?:teachers?|lessons?)|drums?|pianos?|vinyl|record (?:shops?|stores?))\b/.test(p)) return "music";
  if (/\b(phone repairs?|screen repairs?|cell ?phone|iphone|computer repairs?|laptop repairs?|electronics repairs?|device repairs?|tablet repairs?)\b/.test(p)) return "repair";
  if (/\b(chinese|sushi|thai|ramen|noodles?|dim sum|japanese|korean|vietnamese|pho|asian|buffets?|dumplings?)\b/.test(p)) return "asian";
  if (/\b(antiques?|vintage furniture|collectibles?|curiosit(?:y|ies))\b/.test(p)) return "antique";
  if (/\b(bakery|bakeries|bakers?|bakehouse|pastr(?:y|ies)|cakes?|cupcakes?|donuts?|doughnuts?)\b/.test(p)) return "bakery";
  if (/\b(restaurants?|bistros?|diners?|pizzerias?|pizza|steakhouses?|smokehouses?|bbq|barbecue|trattorias?|dining|dinner|tacos?|grill)\b/.test(p)) return "restaurant";
  if (/\b(construction|builders?|building sites?|contractors?|renovations?|remodel(?:ing)?|roofing|plumb(?:ers?|ing)|electricians?|handyman|architects?|engineering firms?|civil engineering)\b/.test(p)) return "construction";
  if (/\b(hospitals?|clinics?|clinical|doctors?|nurses?|nursing|patients?|medical|health ?care|telehealth|dentists?|dental|pharmac(?:y|ies|ists?)|physio(?:therapy)?|caregivers?|care homes?)\b/.test(p)) return "hospital";
  if (/\b(classrooms?|schools?|teachers?|teaching|tutors?|tutoring|homework|lessons?|pupils|students?|study|studying|flashcards?|kindergarten|universit(?:y|ies)|college)\b/.test(p)) return "classroom";
  if (/\b(caf[eé]s?|coffee|baristas?|bakery|bakeries|restaurants?|diners?|bistros?|food trucks?|takeaway|brunch|tea rooms?)\b/.test(p)) return "cafe";
  if (/\b(shops?|stores?|retail|boutiques?|grocer(?:y|ies)|supermarkets?|point of sale|pos|checkout|inventory|e-?commerce|shopping)\b/.test(p)) return "shop";
  if (/\b(propert(?:y|ies)|deliver(?:y|ies)|couriers?|rides?|ride-?sharing|taxis?|parking|city|cities|urban|commut(?:e|ing|ers?)|travel|tourism|local business(?:es)?)\b/.test(p)) return "city";
  if (/\b(homes?|households?|famil(?:y|ies)|parents?|parenting|chores|smart home|cleaning|cleaners|cooking|recipes?|pets?|babysit(?:ter|ting)?|elderly care|home care|furniture)\b/.test(p)) return "home";
  if (/\b(offices?|teams?|workplace|coworkers?|colleagues|employees?|hiring|recruit(?:ing|ment|ers?)?|hr|onboarding|meetings?|crm|accounting|bookkeeping|invoic(?:e|es|ing)|payroll|b2b|saas|productivity|project management|startups?|consult(?:ing|ants?)|legal|lawyers?|finance|insurance)\b/.test(p)) return "office";
  return undefined;
}

/**
 * The business's own icons for a prompt (Lucide names): a pizza place gets a pizza, a chef's hat
 * and a flame; a plumber a wrench, water drops and a shower head. They float behind its slides
 * (the "Business icons" background) and badge its pictures, so the trade reads at a glance.
 * Undefined when the prompt names no business these cover.
 */
const MOTIFS: [RegExp, string[]][] = [
  [/\b(ice ?cream|gelato|frozen yogh?urt|creamery|sundaes?|soft serve)\b/, ["IceCreamCone", "Candy", "CakeSlice", "Sun"]],
  [/\b(pizza|pizzeria)\b/, ["Pizza", "ChefHat", "Flame", "Utensils"]],
  [/\b(burgers?|diner|fries)\b/, ["Hamburger", "Beef", "Flame", "Utensils"]],
  [/\b(bbq|barbecue|smokehouse|brisket|steak ?house)\b/, ["Beef", "Flame", "ChefHat", "Utensils"]],
  [/\b(sushi|ramen|japanese|seafood|fish)\b/, ["Fish", "Soup", "ChefHat", "Utensils"]],
  [/\b(chinese|thai|indian|curry|buffet|dim sum|noodles?|vietnamese|korean|pho|tandoori|thali)\b/, ["Soup", "CookingPot", "ChefHat", "Flame", "Utensils"]],
  [/\b(taco|tacos|mexican|burrito|taqueria|food truck)\b/, ["Utensils", "Flame", "Sandwich", "ChefHat"]],
  [/\b(coffee|caf[eé]s?|espresso|roaster[sy]?|tea ?house)\b/, ["Coffee", "Croissant", "CakeSlice", "Heart"]],
  [/\b(bak(?:ery|eries|er)|pastr(?:y|ies)|patisserie|cupcakes?|donuts?|bread)\b/, ["Croissant", "CakeSlice", "ChefHat", "Coffee"]],
  [/\b(wine bar|winery|brewery|pub|cocktails?)\b/, ["Wine", "Utensils", "Music", "Star"]],
  [/\b(restaurants?|trattoria|bistro|eatery|kitchen|catering|grill)\b/, ["Utensils", "ChefHat", "Wine", "Soup"]],
  [/\b(barbers?|barbershops?)\b/, ["Scissors", "Sparkles", "Smile", "Star"]],
  [/\b(nail (?:salons?|bars?|studios?)|manicures?|pedicures?)\b/, ["Sparkles", "Hand", "Gem", "Brush"]],
  [/\b(tattoos?|piercing)\b/, ["PenTool", "Brush", "Palette", "Star"]],
  [/\b(hair ?salons?|salons?|hairdress(?:ers?|ing)|stylists?|beauty|spa|lashes|brows)\b/, ["Scissors", "Sparkles", "Brush", "Heart"]],
  [/\b(pet groom\w*|groomers?|dog walk\w*|pet sitt\w*|vets?|veterinar\w*|kennels?)\b/, ["PawPrint", "Dog", "Cat", "Bone", "Heart"]],
  [/\b(dent(?:al|ists?)|orthodont\w*)\b/, ["Smile", "Sparkles", "CalendarCheck", "ShieldCheck"]],
  [/\b(opticians?|optical|optometr\w*|eye ?glasses|eyewear|spectacles|eye exams?|contact lenses)\b/, ["Glasses", "Eye", "Sparkles", "CalendarCheck"]],
  [/\b(clinics?|doctors?|physicians?|p(?:a)?ediatric\w*|primary care|urgent care|physio\w*|chiropract\w*|pharmac(?:y|ies))\b/, ["Stethoscope", "HeartPulse", "CalendarCheck", "Pill"]],
  [/\b(insurance|insurers?)\b/, ["Umbrella", "ShieldCheck", "House", "CarFront"]],
  [/\b(car dealer\w*|dealerships?|used cars?|pre-?owned|new cars?|car lots?|auto (?:dealer\w*|sales)|test drives?|showrooms?)\b/, ["CarFront", "KeyRound", "Handshake", "BadgeCheck"]],
  [/\b(food banks?|food pantr(?:y|ies)|soup kitchens?|meal programs?|food drives?)\b/, ["HandHeart", "Apple", "Heart", "Users"]],
  [/\b(farms?|farmers?|farm stands?|orchards?|ranch(?:es)?|farmers'? markets?)\b/, ["Sprout", "Tractor", "Sun", "Apple"]],
  [/\b(artists?|art (?:studios?|classes|galler(?:y|ies)|schools?|lessons)|paintings?|galler(?:y|ies)|ceramics|pottery|illustrators?)\b/, ["Palette", "Brush", "PenTool", "Image"]],
  [/\b(car wash(?:es)?|detailing)\b/, ["CarFront", "Droplets", "SprayCan", "Sparkles"]],
  [/\b(auto repair|mechanics?|garages?|collision|body shop|oil changes?|tires?|tyres?|auto care|brakes?)\b/, ["Wrench", "CarFront", "Settings", "Gauge"]],
  [/\b(phones? (?:and \w+ )?repairs?|(?:screen|tablet|device|electronics|computer|laptop) repairs?|cell ?phones?)\b/, ["Smartphone", "Wrench", "Settings", "Zap"]],
  [/\b(plumb(?:ers?|ing)|drains?|leaks?|water heaters?|pipes?)\b/, ["Wrench", "Droplets", "ShowerHead", "Bath", "Toolbox"]],
  [/\b(electricians?|electrical|wiring|ev chargers?)\b/, ["PlugZap", "Zap", "Lightbulb", "Toolbox"]],
  [/\b(hvac|heating|cooling|air condition\w*|furnaces?|heat pumps?)\b/, ["Thermometer", "Snowflake", "Flame", "Fan"]],
  [/\b(roof(?:ers?|ing|s)?|shingles?|gutters?)\b/, ["House", "Hammer", "HardHat", "Construction"]],
  [/\b(landscap\w*|lawns?|mowing|gardens?|gardeners?|yards?|tree (?:care|service)|hedges?)\b/, ["Trees", "Shrub", "Sprout", "Shovel", "Sun"]],
  [/\b(clean(?:ers|ing)?|maids?|janitorial|housekeeping|carpet care)\b/, ["SprayCan", "Sparkles", "Droplets", "House"]],
  [/\b(movers?|moving)\b/, ["Truck", "Box", "Boxes", "House"]],
  [/\b(builders?|construction|contractors?|remodel\w*|renovat\w*|handyman|carpent\w*)\b/, ["HardHat", "Hammer", "Construction", "Toolbox"]],
  [/\b(florists?|flowers?|bouquets?)\b/, ["Flower2", "Flower", "Heart", "Gift"]],
  [/\b(plant shop|plants?|nurser(?:y|ies)|succulents?)\b/, ["Sprout", "Leaf", "Flower2", "Sun"]],
  [/\b(daycare|preschool|nurser(?:y|ies)|childcare|kids club)\b/, ["Baby", "Blocks", "Smile", "Heart"]],
  [/\b(yoga|pilates|meditation|barre)\b/, ["Sun", "Heart", "Leaf", "Waves"]],
  [/\b(dance|ballet|salsa)\b/, ["Music", "Sparkles", "Star", "Heart"]],
  [/\b(gyms?|boxing|crossfit|fitness|personal train\w*|martial arts|weight ?lifting)\b/, ["Dumbbell", "Flame", "Timer", "Trophy"]],
  [/\b(photograph\w*|photo studio)\b/, ["Camera", "Image", "Sparkles", "Star"]],
  [/\b(bookstores?|bookshops?|books|library)\b/, ["BookOpen", "Coffee", "Glasses", "Star"]],
  [/\b(antiques?|vintage furniture|collectibles?)\b/, ["Clock", "Watch", "Lamp", "Armchair", "Gem"]],
  [/\b(thrift|second-?hand|consignment|vintage|resale)\b/, ["Shirt", "Tag", "Recycle", "ShoppingBag"]],
  [/\b(music (?:shop|store|lessons?|school|teachers?)|(?:piano|guitar|voice|singing|violin) (?:teachers?|lessons?)|guitars?|instruments?|pianos?|drums?)\b/, ["Guitar", "Piano", "Drum", "Music"]],
  [/\b(church(?:es)?|parish|worship|congregation|ministr(?:y|ies)|chapel)\b/, ["Church", "Heart", "HandHeart", "Users"]],
  [/\b(bed and breakfast|b&b|hotels?|inns?|motels?|guest ?house|lodge)\b/, ["BedDouble", "Coffee", "KeyRound", "ConciergeBell"]],
  [/\b(tax(?:es)?|accountants?|accounting|bookkeep\w*|cpa)\b/, ["Calculator", "Receipt", "FileText", "Coins"]],
  [/\b(law firm|lawyers?|attorneys?|legal)\b/, ["Scale", "Gavel", "Briefcase", "FileText"]],
  [/\b(real estate|realtors?|estate agents?|homes? for sale|home ?builders?|new homes?)\b/, ["House", "KeyRound", "MapPin", "Handshake"]],
];

export function motifPick(prompt: string): string[] | undefined {
  // (Not the quoted name, which can say anything — "Masala Garden" isn't a garden — nor the
  // request's tone words: "a clean, modern intro for …".)
  const p = prompt
    .toLowerCase()
    .replace(/"[^"\n]*"|“[^”\n]*”/g, " ")
    .replace(/^[^\n]*?\b(?:intro|video)s? (?:for|about)\b/, " ");
  // The business named first wins ("a bakery … with coffee" is a bakery).
  let best: { at: number; icons: string[] } | undefined;
  for (const [re, icons] of MOTIFS) {
    const at = p.search(re);
    if (at >= 0 && (!best || at < best.at)) best = { at, icons };
  }
  return best?.icons;
}
