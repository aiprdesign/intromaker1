/**
 * Which character style suits an intro, from its description. Two cases:
 *
 * - The description asks for characters (a cartoon, a mascot, stick figures, a video for kids…):
 *   the best-fitting Cartoon style, from the words used.
 * - It doesn't, but the theme works better with characters than with screens (a kids' app, a
 *   classroom, hiring and teams, a retro brand): the style made for that theme. The studio only
 *   applies this to words-only videos, never to ones built from a site's screenshots.
 */

/** The description asks for characters. */
export const WANTS_CHARACTERS = /\b(cartoons?|animated characters?|characters?|mascots?|kids?|children|preschool|animated explainer|abstract people|stick ?figures?|stickmen|stick ?people|blobs?|rubber ?hose|corporate memphis)\b/i;

/** The best Cartoon style for a description that asks for characters. */
export function cartoonStyleFor(prompt: string) {
  const p = prompt.toLowerCase();
  // The kind of character, when it's named.
  if (/\b(stick ?figures?|stickmen|stick ?people|whiteboard|sketch(?:ed|y)?)\b/.test(p)) return "whiteboard";
  if (/\b(blobs?|kawaii|cute (?:monsters?|creatures?)|monsters?|creatures?)\b/.test(p)) return "blobs";
  if (/\b(rubber ?hose|retro|vintage|classic cartoons?|old[- ]school|nostalgic|1920s|1930s)\b/.test(p)) return "rubberhose";
  if (/\b(corporate memphis|memphis|corporate|business|b2b|workplace|office|enterprise)\b/.test(p)) return "memphis";
  if (/\b(abstract|minimal|minimalist|geometric|shapes?)\b/.test(p)) return /\b(crowd|parade)\b/.test(p) ? "memphis" : "abstract";
  // The look.
  if (/\b(explainer|explains?|walkthrough|presenters?|hosts?|realistic|advanced characters?)\b/.test(p)) return "explainer";
  if (/\b(journey|adventure|together|community|friends)\b/.test(p) && /\b(outdoors?|parks?|nature|hills?|river)\b/.test(p)) return "storycast";
  if (/\b(comics?|superheroe?s?|funny|comedy|jokes?)\b/.test(p)) return "comic";
  if (/\b(story|stories|storybook|bedtime|fairy ?tales?|picture books?)\b/.test(p)) return "storybook";
  if (/\b(clay|plush|cuddly|squishy|toys?)\b/.test(p)) return "claybuddies";
  if (/\b(night|sleep|sleeping|dreams?|stars?|moon)\b/.test(p)) return "nightowls";
  if (/\b(outdoors?|outside|parks?|gardens?|gardening|farms?|nature|picnics?|camping|hiking|walks?)\b/.test(p)) return "sunnypark";
  // Who it's for.
  if (/\b(kids?|children|toddlers?|preschool|kindergarten|babies|baby)\b/.test(p)) return "blobs";
  if (/\b(school|classroom|teachers?|teaching|tutors?|tutoring|lessons?|homework|students?|course|courses|training)\b/.test(p)) return "whiteboard";
  if (/\b(hiring|recruit(?:ing|ment|ers?)?|hr|human resources|onboarding|employees?|teams?|remote work|collaboration)\b/.test(p)) return "memphis";
  return "cartoon";
}

/** A style for a theme that works better with characters, or undefined. */
export function themeCharacterStyle(prompt: string): string | undefined {
  const p = prompt.toLowerCase().replace(/\bmachine learning\b|\bdeep learning\b/g, "");
  if (/\b(kids?|children|child|toddlers?|preschool|kindergarten|parents?|parenting|families|family|babysit(?:ter|ting)?|daycare|nursery)\b/.test(p)) return "blobs";
  if (/\b(classroom|teachers?|teaching|tutors?|tutoring|homework|lessons?|school|schools|pupils|study buddy|flashcards?)\b/.test(p)) return "whiteboard";
  if (/\b(hiring|recruit(?:ing|ment|ers?)?|human resources|hr|onboarding new (?:hires|employees)|employee (?:wellbeing|engagement|experience)|team building|company culture|diversity|inclusion|volunteers?|volunteering|non-?profits?|charity|charities|community groups?)\b/.test(p)) return "memphis";
  if (/\b(retro|vintage|nostalgic|old[- ]school|classic diner|since 19\d\d|1920s|1930s|1950s)\b/.test(p)) return "rubberhose";
  return undefined;
}
