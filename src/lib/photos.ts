/**
 * Product photos, uploaded from the browser for a product video (the homepage's Product video
 * tab and the studio's "Add product photos"). Each photo is re-encoded here first: at most 2000px,
 * a plain JPEG on white (transparent PNGs land on a studio-white background), so camera metadata
 * such as location never leaves the device. Returns the stored photos' same-origin URLs.
 */
export const MAX_PHOTOS = 12;

/** /api/shot ids of uploaded photos, for passing them in a link (?photos=…). */
export const PHOTO_ID = /^[a-f0-9]{16}-u\d{1,2}$/;

export async function uploadPhotos(files: FileList | File[] | null, room = MAX_PHOTOS): Promise<string[]> {
  const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
  if (!list.length) return [];
  const form = new FormData();
  for (const f of list) {
    const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read that photo."))), "image/jpeg", 0.9));
    form.append("photo", blob, "photo.jpg");
  }
  const res = await fetch("/api/photos", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't upload the photos. Try again.");
  return data.photos as string[];
}
