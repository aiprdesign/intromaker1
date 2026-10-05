/**
 * Draws the sample product photos used by the homepage's sample product video: "Kelvo", an
 * imaginary smart water bottle, from three angles on a white studio background. Original artwork
 * made for Prodintro.com (plain SVG shapes and gradients, no third-party images; the lettering is set
 * in the system sans-serif), so it is covered by the project's own licence.
 *
 *   node scripts/sample-art.mjs     # writes public/samples/kelvo-{front,angle,back}.jpg
 *
 * Needs a Chromium for rendering: playwright-core's (PLAYWRIGHT_BROWSERS_PATH) or CHROMIUM_PATH.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = join(dirname(new URL(import.meta.url).pathname), "..", "public", "samples");

const bottle = ({ hi = 0.32, logo = true, logoX = 0, logoScale = 1, display = true, dispX = 0, view = 'front' }) => {
  // Body silhouette (x centred at 600).
  const body = 'M480 420 C480 360 520 330 545 318 L545 290 L655 290 L655 318 C680 330 720 360 720 420 L720 1010 C720 1050 695 1068 655 1068 L545 1068 C505 1068 480 1050 480 1010 Z';
  const h = (hi * 240 + 480).toFixed(0);
  return `
  <defs>
    <linearGradient id="steel" x1="480" x2="720" y1="0" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0c1430"/>
      <stop offset="${Math.max(0.02, hi - 0.2)}" stop-color="#1b2a63"/>
      <stop offset="${hi - 0.05}" stop-color="#3048a6"/>
      <stop offset="${hi}" stop-color="#8a9df0"/>
      <stop offset="${hi + 0.05}" stop-color="#3048a6"/>
      <stop offset="${Math.min(0.9, hi + 0.35)}" stop-color="#16224f"/>
      <stop offset="0.93" stop-color="#2c3f8f"/>
      <stop offset="1" stop-color="#0a1128"/>
    </linearGradient>
    <linearGradient id="alu" x1="530" x2="670" y1="0" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8e949f"/>
      <stop offset="${hi}" stop-color="#f4f6fa"/>
      <stop offset="${Math.min(0.95, hi + 0.25)}" stop-color="#b9bec8"/>
      <stop offset="1" stop-color="#6f7580"/>
    </linearGradient>
    <linearGradient id="vshade" x1="0" x2="0" y1="290" y2="1068" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity="0.10"/>
      <stop offset="0.15" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.9" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.35"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" x2="1">
      <stop offset="0" stop-color="#38e1ff" stop-opacity="0.2"/>
      <stop offset="0.5" stop-color="#7cf0ff"/>
      <stop offset="1" stop-color="#38e1ff" stop-opacity="0.2"/>
    </linearGradient>
    <clipPath id="bodyClip"><path d="${body}"/></clipPath>
  </defs>
  <path d="${body}" fill="url(#steel)"/>
  <path d="${body}" fill="url(#vshade)"/>
  <!-- base band -->
  <rect x="480" y="1000" width="240" height="6" fill="#000" opacity="0.25" clip-path="url(#bodyClip)"/>
  <!-- soft reflected edge light on the right -->
  <rect x="700" y="400" width="10" height="620" rx="5" fill="#6f86ff" opacity="0.12" clip-path="url(#bodyClip)"/>
  ${logo ? `<g transform="translate(${600 + logoX} 760) scale(${logoScale} 1)">
     <text x="0" y="0" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="300" font-size="38" letter-spacing="12" fill="#c9d4ff" opacity="0.85">KELVO</text>
     <circle cx="0" cy="-90" r="22" fill="none" stroke="#c9d4ff" stroke-width="3" opacity="0.8"/>
   </g>` : ''}
  <!-- cap: brushed aluminium with a display band -->
  <rect x="532" y="150" width="136" height="150" rx="26" fill="url(#alu)"/>
  <rect x="532" y="150" width="136" height="22" rx="11" fill="#fff" opacity="0.35"/>
  ${Array.from({ length: 12 }, (_, i) => `<line x1="532" x2="668" y1="${180 + i * 9}" y2="${180 + i * 9}" stroke="#fff" stroke-opacity="0.07"/>`).join('')}
  <rect x="532" y="276" width="136" height="16" fill="#000" opacity="0.18"/>
  ${display ? `<g transform="translate(${dispX} 0)">
    <rect x="560" y="196" width="80" height="40" rx="10" fill="#05070d"/>
    <rect x="566" y="230" width="68" height="3" rx="1.5" fill="url(#ring)"/>
    <text x="600" y="223" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="22" fill="#7cf0ff">6°C</text>
  </g>` : ''}
  <!-- loop handle -->
  <path d="M556 150 C556 96 644 96 644 150" fill="none" stroke="#9aa0ab" stroke-width="12" stroke-linecap="round"/>
  <path d="M556 150 C556 96 644 96 644 150" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="3" stroke-linecap="round" transform="translate(-3 -3)"/>`;
};
const views = {
  front: bottle({ hi: 0.3 }),
  angle: bottle({ hi: 0.55, logoX: 42, logoScale: 0.7, dispX: 26 }),
  back: bottle({ hi: 0.18, logo: false, display: false }),
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
for (const [name, inner] of Object.entries(views)) {
  await page.setContent(`<body style="margin:0;background:#fff"><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 40 1200 1100">${inner}</svg></body>`);
  await page.screenshot({ path: join(OUT, `kelvo-${name}.jpg`), type: "jpeg", quality: 90 });
}
await browser.close();
console.log("Wrote public/samples/kelvo-{front,angle,back}.jpg");
