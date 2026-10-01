import type { Skill, SkillId } from "../types";
import { componentSkills } from "./components";
import { endingSkills } from "./endings";
import { energySkills } from "./energy";
import { interactionSkills } from "./interactions";
import { typeFxSkills } from "./typefx";
import { gallerySkills } from "./gallery";
import { mediaSkills } from "./media";
import { productSkills } from "./product";
import { momentSkills } from "./moments";
import { slideSkills } from "./slides";
import { saasSkills } from "./saas";
import { signatureSkills } from "./signature";
import { typographySkills } from "./typography";
import { worldSkills } from "./worlds";

export const SKILLS: Skill[] = [
  // Ordered for the showcase: SaaS launch toolkit first.
  ...saasSkills,
  ...endingSkills,
  ...interactionSkills,
  ...momentSkills,
  ...slideSkills,
  ...productSkills,
  ...typeFxSkills,
  ...gallerySkills,
  ...componentSkills,
  signatureSkills[0],
  signatureSkills[1],
  ...energySkills.slice(0, 2),
  typographySkills[0],
  typographySkills[1],
  energySkills[2],
  worldSkills[0],
  worldSkills[1],
  typographySkills[2],
  worldSkills[2],
  worldSkills[3],
  worldSkills[4],
  typographySkills[3],
  typographySkills[4],
  energySkills[3],
  worldSkills[5],
  signatureSkills[2],
  signatureSkills[3],
  ...mediaSkills,
];

export const SKILL_MAP = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, Skill>;

/** Slide styles grouped for the studio's picker. */
export const SKILL_GROUPS: { name: string; skills: Skill[] }[] = [
  { name: "SaaS essentials", skills: saasSkills },
  { name: "Openers & end cards", skills: endingSkills },
  { name: "Product moments", skills: [...interactionSkills, ...momentSkills] },
  { name: "Slides", skills: slideSkills },
  { name: "Media & gallery", skills: [...productSkills, ...gallerySkills, ...componentSkills, ...mediaSkills] },
  { name: "Type & text", skills: [...typeFxSkills, ...typographySkills] },
  { name: "Cinematic", skills: [...signatureSkills, ...energySkills, ...worldSkills] },
];
