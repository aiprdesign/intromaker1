/** Route a remote asset through the same-origin proxy so canvases stay exportable. */
export function assetUrl(src: string) {
  // Already same-origin: proxied assets and captured screenshots/logos.
  return src.startsWith("/api/asset") || src.startsWith("/api/shot") ? src : `/api/asset?url=${encodeURIComponent(src)}`;
}
