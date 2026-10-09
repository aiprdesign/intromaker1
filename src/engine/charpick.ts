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
  if (/\b(home ?builders?|house ?builders?|custom homes?|new homes?|new[- ]build|real estate|realtors?|estate agents?|propert(?:y|ies) (?:listings?|developers?|management)|homes? for sale|house hunting|mortgages?|interior design(?:ers?)?|show ?homes?)\b/.test(p)) return "house";
  if (/\b(barbers?|barbershops?|hair ?salons?|salons?|hairdress(?:ers?|ing)|stylists?|nail (?:salons?|bars?|studios?)|manicures?|beauty|tattoo(?:s| studios?| shops?)?|pet grooming|groomers?)\b/.test(p)) return "salon";
  if (/\b(auto repair|mechanics?|garages?|car wash(?:es)?|detailing|oil changes?|tire|tyre|body shop|auto care)\b/.test(p)) return "garage";
  if (/\b(gyms?|boxing|crossfit|personal train(?:ing|ers?)|fitness (?:club|studio|centre|center)|martial arts|weight ?lifting)\b/.test(p)) return "gym";
  if (/\b(yoga|pilates|dance (?:studio|classes|school)|dance|ballet|meditation studio|barre)\b/.test(p)) return "yoga";
  if (/\b(florists?|flower shops?|flowers?|bouquets?|plant shops?|garden cent(?:re|er)s?)\b/.test(p)) return "florist";
  if (/\b(bookstores?|bookshops?|books|used books|librar(?:y|ies)|book clubs?)\b/.test(p)) return "bookstore";
  if (/\b(hotels?|inns?|bed and breakfast|b&bs?|motels?|guest ?houses?|resorts?|lodges?|vacation rentals?)\b/.test(p)) return "hotel";
  if (/\b(bakery|bakeries|bakers?|bakehouse|pastr(?:y|ies)|cakes?|cupcakes?|donuts?|doughnuts?)\b/.test(p)) return "bakery";
  if (/\b(restaurants?|bistros?|diners?|pizzerias?|pizza|steakhouses?|trattorias?|dining|dinner|tacos?|grill)\b/.test(p)) return "restaurant";
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
