let ready: Promise<void> | null = null;

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
