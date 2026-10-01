"use client";

import { useRef, useState } from "react";
import { assetUrl } from "@/engine/assets";
import type { Media } from "@/engine/types";
import { uploadPhotos } from "@/lib/photos";

const VIDEO = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/** Does the (proxied) image or video load? Rejects with a friendly message if not. */
function probe(m: Media): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = () =>
      reject(new Error(m.kind === "video" ? "Couldn't play that video. Check the link points straight to the file (.mp4, .webm)." : "Couldn't load that image. Check the link points straight to the image (.jpg, .png, .webp…)."));
    const timer = setTimeout(fail, 20_000);
    if (m.kind === "video") {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.onloadedmetadata = () => (clearTimeout(timer), resolve());
      v.onerror = () => (clearTimeout(timer), fail());
      v.src = m.src;
    } else {
      const img = new Image();
      img.onload = () => (clearTimeout(timer), img.naturalWidth ? resolve() : fail());
      img.onerror = () => (clearTimeout(timer), fail());
      img.src = m.src;
    }
  });
}

function Thumb({ m }: { m: Media }) {
  return m.kind === "video" ? <video src={m.src} muted preload="metadata" /> : <img src={m.src} alt="" loading="lazy" />;
}

/**
 * The picture a slide shows: automatic (what the director chose), one of the site's images and
 * screenshots, an image or video link, or an uploaded image. New links and uploads join the list
 * so other slides can use them too.
 */
export default function SlideMedia({
  value,
  library,
  onChange,
  onAdd,
}: {
  value?: Media;
  /** Images and videos to choose from (the site's, uploads, links added before). */
  library: Media[];
  /** undefined = automatic. */
  onChange: (m: Media | undefined) => void;
  /** A new link or upload, to keep in the list. */
  onAdd: (m: Media) => void;
}) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement | null>(null);

  const use = (m: Media) => {
    setError(null);
    onChange(m);
  };
  const addLink = async () => {
    const raw = link.trim();
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      setError("That doesn't look like a link. Paste the image's address, starting with https://");
      return;
    }
    if (!/^https?:$/.test(url.protocol)) {
      setError("Only http and https links work.");
      return;
    }
    const m: Media = { src: assetUrl(url.toString()), kind: VIDEO.test(url.pathname) ? "video" : "image" };
    setBusy("Checking the link…");
    setError(null);
    try {
      await probe(m);
      onAdd(m);
      use(m);
      setLink("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("Uploading…");
    setError(null);
    try {
      const [src] = await uploadPhotos(files, 1);
      if (!src) throw new Error("Pick an image file (JPEG, PNG, WebP…).");
      const m: Media = { src, kind: "image" };
      onAdd(m);
      use(m);
    } catch (e) {
      setError((e as Error).message || "Couldn't upload that image.");
    } finally {
      setBusy(null);
      if (file.current) file.current.value = "";
    }
  };

  return (
    <div className="fld slide-media">
      <span className="fld-cap">
        Image <em>shown in this slide</em>
      </span>
      <div className="media-current">
        <span className="media-thumb">{value ? <Thumb m={value} /> : <span className="media-auto">Auto</span>}</span>
        <span className="media-what">
          <strong>{value ? (value.kind === "video" ? "Chosen video" : "Chosen image") : "Automatic"}</strong>
          <small>{value ? "Shown in this slide" : "The director's pick for this slide"}</small>
        </span>
        <button type="button" className="btn btn-ghost sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Done" : "Change"}
        </button>
      </div>
      {open && (
        <div className="media-picker">
          {library.length ? (
            <div className="media-grid" role="listbox" aria-label="Images from your site">
              {library.map((m) => (
                <button
                  type="button"
                  key={m.src}
                  role="option"
                  aria-selected={value?.src === m.src}
                  className={`media-option${value?.src === m.src ? " active" : ""}`}
                  onClick={() => use(m)}
                  title={m.kind === "video" ? "Video" : "Image"}
                >
                  <Thumb m={m} />
                  {m.kind === "video" && <span className="media-badge">▶</span>}
                </button>
              ))}
            </div>
          ) : (
            <p className="hint">No images from a website yet. Paste a link or upload one.</p>
          )}
          <form
            className="media-link"
            onSubmit={(e) => {
              e.preventDefault();
              void addLink();
            }}
          >
            <input
              className="input"
              type="text"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste an image or video link (https://…)"
              aria-label="Image link"
            />
            <button className="btn btn-ghost sm" type="submit" disabled={!link.trim() || !!busy}>
              Use link
            </button>
          </form>
          <div className="media-actions">
            <button type="button" className="btn btn-ghost sm" onClick={() => file.current?.click()} disabled={!!busy}>
              ＋ Upload an image
            </button>
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files)} />
            {value && (
              <button type="button" className="link-btn" onClick={() => onChange(undefined)}>
                Use automatic
              </button>
            )}
          </div>
          {busy && <p className="hint">{busy}</p>}
          {error && <p className="hint warn">{error}</p>}
          <p className="hint">Use images you own or have the right to use.</p>
        </div>
      )}
    </div>
  );
}
