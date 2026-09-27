import type { Skill, SkillId } from "../types";
import { energySkills } from "./energy";
import { mediaSkills } from "./media";
import { signatureSkills } from "./signature";
import { typographySkills } from "./typography";
import { worldSkills } from "./worlds";

export const SKILLS: Skill[] = [
  // Ordered for the showcase.
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
