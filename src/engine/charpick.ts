import type { CharacterKind } from "./types";

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
  if (/\b(retro|vintage|nostalgic|old[- ]school|classic diner|since 19\d\d|1920s|1930s|1950s)\b/.test(p)) return { template: "comic", characters: "classic" };
  return undefined;
}
