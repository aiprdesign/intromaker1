let ready: Promise<void> | null = null;

const brandFonts = new Map<string, Promise<boolean>>();
const loadedBrandFonts = new Set<string>();

/** Load a website's Google Font so headlines can use the brand's own typeface. */
export function loadBrandFont(name: string | undefined) {
  if (!name || typeof document === "undefined" || !/^[A-Za-z0-9 ]{2,40}$/.test(name)) return Promise.resolve(false);
  if (!brandFonts.has(name)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@600;700;800&display=swap`;
    document.head.appendChild(link);
    brandFonts.set(
      name,
      new Promise<boolean>((resolve) => {
        link.onload = () =>
          document.fonts
            .load(`700 100px "${name}"`)
            .then((faces) => {
              const ok = faces.length > 0;
              if (ok) loadedBrandFonts.add(name);
              resolve(ok);
            })
            .catch(() => resolve(false));
        link.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 8000);
      }),
    );
  }
  return brandFonts.get(name)!;
}

export function brandFontReady(name: string | undefined) {
  return !!name && loadedBrandFonts.has(name);
}

/** Canvas can't use a webfont until it's loaded; resolve once all faces are ready. */
export function ensureFonts() {
  if (typeof document === "undefined") return Promise.resolve();
  ready ??= Promise.all([
    document.fonts.load('400 100px "Anton"'),
    document.fonts.load('700 100px "Space Grotesk"'),
    document.fonts.load('500 40px "Inter"'),
    document.fonts.load('600 40px "Inter"'),
    document.fonts.load('700 40px "Inter"'),
    document.fonts.load('800 100px "Inter"'),
  ])
    .then(() => undefined)
    .catch(() => undefined);
  return ready;
}
