import type { Skill, SkillId } from "../types";
import { cardSkills } from "./cards";
import { componentSkills } from "./components";
import { endingSkills } from "./endings";
import { editorialSkills } from "./editorial";
import { editorialMoreSkills } from "./editorial2";
import { energySkills } from "./energy";
import { epicSkills } from "./epic";
import { iconicSkills } from "./iconic";
import { fastTypeSkills } from "./fastype";
import { speedSkills } from "./speed";
import { speedMoreSkills } from "./speed2";
import { launchSkills } from "./launch";
import { beatSkills } from "./beats";
import { logo3dSkills } from "./logo3d";
import { interactionSkills } from "./interactions";
import { typeFxSkills } from "./typefx";
import { gallerySkills } from "./gallery";
import { mediaSkills } from "./media";
import { movieSkills } from "./movie";
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
  ...logo3dSkills,
  ...editorialSkills,
  ...editorialMoreSkills,
  ...fastTypeSkills,
  ...speedSkills,
  ...speedMoreSkills,
  ...interactionSkills,
  ...momentSkills,
  ...launchSkills,
  ...beatSkills.slice(0, 3),
  ...slideSkills,
  ...productSkills,
  beatSkills[3],
  ...typeFxSkills,
  ...gallerySkills,
  ...cardSkills,
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
  ...epicSkills,
  ...iconicSkills,
  ...mediaSkills,
  ...movieSkills,
];

export const SKILL_MAP = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, Skill>;

/** Slide styles grouped for the studio's picker. */
export const SKILL_GROUPS: { name: string; skills: Skill[] }[] = [
  { name: "SaaS essentials", skills: saasSkills },
  { name: "Openers & end cards", skills: endingSkills },
  { name: "3D logo", skills: logo3dSkills },
  { name: "Editorial system", skills: [...editorialSkills, ...editorialMoreSkills] },
  { name: "Fast type", skills: [...fastTypeSkills, ...speedSkills, ...speedMoreSkills] },
  { name: "Product moments", skills: [...interactionSkills, ...momentSkills, ...launchSkills, ...beatSkills.slice(0, 3)] },
  { name: "Slides", skills: slideSkills },
  { name: "Media & gallery", skills: [...productSkills, beatSkills[3], ...gallerySkills, ...cardSkills, ...componentSkills, ...mediaSkills] },
  { name: "Type & text", skills: [...typeFxSkills, ...typographySkills] },
  { name: "Epic screens", skills: [...epicSkills, ...iconicSkills] },
  { name: "Movie trailer", skills: movieSkills },
  { name: "Cinematic", skills: [...signatureSkills, ...energySkills, ...worldSkills] },
];

/** Slides that show a picture or video of their own (`scene.media`), which can be changed per slide. */
export const MEDIA_SKILLS = new Set<SkillId>([
  "ui-tour",
  "ui-cards",
  "ui-assemble",
  "site-scroll",
  "testimonial",
  "type-mask",
  "gallery-flow",
  "carousel-3d",
  "tilt-wall",
  "before-after",
  "product-showcase",
  "photo-montage",
  "product-hero",
  "product-end",
  "product-spin",
  "product-zoom",
  "product-teaser",
  "showreel",
  "card-stack",
  "contact-sheet",
  "photo-fan",
  "card-spread",
  "photo-drop",
]);
