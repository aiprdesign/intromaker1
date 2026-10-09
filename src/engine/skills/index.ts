import type { Skill, SkillId } from "../types";
import { cardSkills } from "./cards";
import { characterSkills } from "./characters";
import { charProSkills } from "./charpro";
import { abstractSkills } from "./abstract";
import { industrySkills } from "./industries";
import { devices3dSkills } from "./devices3d";
import { homes3dSkills } from "./homes3d";
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
import { processSkills } from "./process";
import { epicProcessSkills } from "./epicprocess";
import { creativeServiceSkills } from "./services2";
import { logo3dSkills } from "./logo3d";
import { logoCleanSkills } from "./logoclean";
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
  ...logoCleanSkills,
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
  beatSkills[4],
  ...processSkills,
  ...epicProcessSkills,
  ...creativeServiceSkills,
  ...characterSkills,
  ...charProSkills,
  ...abstractSkills,
  ...industrySkills,
  ...devices3dSkills,
  ...homes3dSkills,
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
  { name: "Clean logo", skills: logoCleanSkills },
  { name: "Editorial system", skills: [...editorialSkills, ...editorialMoreSkills] },
  { name: "Fast type", skills: [...fastTypeSkills, ...speedSkills, ...speedMoreSkills] },
  { name: "Product moments", skills: [...interactionSkills, ...momentSkills, ...launchSkills, ...beatSkills.slice(0, 3)] },
  { name: "Slides", skills: [...slideSkills, beatSkills[4]] },
  { name: "Process & services", skills: [...processSkills, ...epicProcessSkills, ...creativeServiceSkills] },
  { name: "Characters", skills: characterSkills },
  { name: "Advanced characters", skills: charProSkills },
  { name: "Abstract characters", skills: abstractSkills },
  { name: "Industries", skills: industrySkills },
  { name: "3D devices", skills: devices3dSkills },
  { name: "Homebuilders 3D", skills: homes3dSkills },
  { name: "Media & gallery", skills: [...productSkills, beatSkills[3], ...gallerySkills, ...cardSkills, ...componentSkills, ...mediaSkills] },
  { name: "Type & text", skills: [...typeFxSkills, ...typographySkills] },
  { name: "Epic screens", skills: [...epicSkills, ...iconicSkills] },
  { name: "Movie trailer", skills: movieSkills },
  { name: "Cinematic", skills: [...signatureSkills, ...energySkills, ...worldSkills] },
];

/** Slides drawn with the WebGL 3D engine (devices and homes): heavy to draw, so previews show them still. */
export const THREE_D_SKILLS = new Set<SkillId>([...devices3dSkills, ...homes3dSkills].map((s) => s.id));

/** Slides that show a picture or video of their own (`scene.media`), which can be changed per slide. */
export const MEDIA_SKILLS = new Set<SkillId>([
  "d3-popout",
  "d3-macro",
  "d3-split",
  "d3-wall",
  "d3-laptop",
  "d3-phone",
  "d3-lineup",
  "d3-dive",
  "d3-desk",
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
