/**
 * Lip-sync: what the narrator's mouth is doing right now, for characters who speak the story.
 * The renderer sets it once per frame from the voice-over (see voice.ts speechAt); character
 * drawing reads it. Null when there's no voice-over playing.
 */

/** Mouth shapes: wide open (a), wide and narrow (e, i, s, t…), round (o, u, w), closed (m, b, p), at rest. */
export type Viseme = "a" | "e" | "o" | "m" | "rest";

export interface Speech {
  /** How open the mouth is (0 closed → 1 wide), from the voice's loudness. */
  open: number;
  /** The shape, from the letter being said. */
  shape: Viseme;
  /** Which of the slide's characters is speaking (0 = the first speaker). */
  speaker?: number;
}

/** The speech for character `who` (any speaker when undefined): null while someone else talks. */
export const speechFor = (who?: number) => (current && (who === undefined || current.speaker === undefined || current.speaker === who) ? current : null);

let current: Speech | null = null;
export const setSpeech = (s: Speech | null) => void (current = s);
export const speechNow = () => current;

/** The mouth shape for a letter. */
export function visemeOf(ch: string | undefined): Viseme {
  if (!ch) return "rest";
  if ("mbp".includes(ch)) return "m";
  if ("ouwq".includes(ch)) return "o";
  if ("ah".includes(ch)) return "a";
  return "e";
}
