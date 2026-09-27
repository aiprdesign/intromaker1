/** Route a remote asset through the same-origin proxy so canvases stay exportable. */
export function assetUrl(src: string) {
  return src.startsWith("/api/asset") ? src : `/api/asset?url=${encodeURIComponent(src)}`;
}
