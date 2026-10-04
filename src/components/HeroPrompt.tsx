"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import Icon from "./Icon";
import { EXAMPLE_PROMPTS } from "@/engine/demos";
import { MAX_PHOTOS, uploadPhotos } from "@/lib/photos";

/** A bare domain or a full http(s) address. */
const isUrl = (s: string) => /^https?:\/\/\S+\.\S+$/i.test(s.trim()) || /^([\w-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(s.trim());

/** Marketplaces whose listing links import as a product (see src/lib/listing.ts). */
const MARKETS = ["Amazon", "eBay", "Etsy", "Walmart", "AliExpress", "Shopify stores"];

/**
 * The homepage hero: a SaaS launch video from the product's website (the default), from a
 * written prompt, or a product video from a marketplace listing or product photos. All open the
 * studio, which imports the site or listing, or directs the prompt and photos.
 */
export default function HeroPrompt() {
  const router = useRouter();
  const [mode, setMode] = useState<"url" | "prompt" | "product">("url");
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Product video: a listing link, or uploaded photos with a short description.
  const [listing, setListing] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  // The studio takes a moment to open: the button says so straight away.
  const [opening, startOpening] = useTransition();
  const [openingFor, setOpeningFor] = useState<"url" | "prompt" | "product" | null>(null);
  const go = (href: string, from: "url" | "prompt" | "product") => {
    setOpeningFor(from);
    startOpening(() => router.push(href));
  };
  const pending = (from: "url" | "prompt" | "product") => opening && openingFor === from;
  const busyLabel = (label: string) => (
    <>
      <span className="spinner sm" aria-hidden /> {label}
    </>
  );

  // /#product (the nav's Product videos link) opens this tab.
  useEffect(() => {
    const open = () => {
      if (window.location.hash === "#product") setMode("product");
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  const fromListing = (raw: string) => {
    const u = raw.trim();
    // A bare Amazon product code (ASIN, 10 characters) works too.
    if (!isUrl(u) && !(/^[A-Z0-9]{10}$/i.test(u) && /\d/.test(u))) {
      setProductError("Paste the product's link (like amazon.com/dp/B0…, ebay.com/itm/… or yourstore.com/products/…) or its 10-character Amazon code.");
      return;
    }
    // The format (9:16, 16:9, 1:1) and the look are chosen in the studio.
    go(`/studio?url=${encodeURIComponent(/^[A-Z0-9]{10}$/i.test(u) ? `amazon.com/dp/${u.toUpperCase()}` : u)}`, "product");
  };
  const addPhotos = async (files: FileList | File[] | null) => {
    if (!Array.from(files ?? []).some((f) => f.type.startsWith("image/"))) return;
    setBusy(true);
    setProductError(null);
    try {
      const urls = await uploadPhotos(files, MAX_PHOTOS - photos.length);
      setPhotos((cur) => [...cur, ...urls].slice(0, MAX_PHOTOS));
    } catch (e) {
      setProductError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const fromPhotos = () => {
    const ids = photos.map((p) => p.split("id=")[1]).filter(Boolean);
    const text = about.trim();
    go(`/studio?photos=${ids.join(",")}${text ? `&prompt=${encodeURIComponent(text)}` : ""}`, "product");
  };

  const fromUrl = (raw: string) => {
    const u = raw.trim();
    if (!isUrl(u)) {
      setError("Enter your website's address, like yourproduct.com");
      return;
    }
    go(`/studio?url=${encodeURIComponent(u)}`, "url");
  };
  const fromPrompt = (p: string) => {
    // A URL typed into the prompt box still imports the site.
    const text = p.trim() || EXAMPLE_PROMPTS[0];
    go(isUrl(text) ? `/studio?url=${encodeURIComponent(text)}` : `/studio?prompt=${encodeURIComponent(text)}`, "prompt");
  };

  const product = mode === "product";
  return (
    <>
      <span className="eyebrow">{product ? "✦ Product video from your listing" : "✦ SaaS video from your URL"}</span>
      <h1>
        {product ? "Product videos," : "SaaS launch videos,"}
        <br />
        <span className="grad">{product ? "from your listing." : "from your URL."}</span>
      </h1>
      <p className="lede">
        {product
          ? "Paste your Amazon, eBay, Etsy or Shopify listing, or upload product photos. IntroMaker cuts your product out of its photos and directs it in the format that sells: product first, benefits on screen (they read with the sound off), its angles, one clear call to action."
          : "Enter your website below. IntroMaker reads your logo, brand colours, screenshots, UI and copy, picks the scenes that suit your product, and directs a beat-synced launch video you can edit and export in 1080p."}
      </p>
    <div className="hero-prompt">
      <div className="mode-tabs" role="tablist" aria-label="Start from">
        <button role="tab" aria-selected={mode === "url"} className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}>
          <Icon name="Globe" size={14} /> From your website
        </button>
        <button role="tab" aria-selected={mode === "prompt"} className={mode === "prompt" ? "active" : ""} onClick={() => setMode("prompt")}>
          <Icon name="Sparkles" size={14} /> From a prompt
        </button>
        <button role="tab" aria-selected={mode === "product"} className={mode === "product" ? "active" : ""} onClick={() => setMode("product")}>
          <Icon name="Package" size={14} /> Product video
        </button>
      </div>

      {mode === "product" ? (
        <div
          className="product-start"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void addPhotos(e.dataTransfer.files);
          }}
        >
          <form
            className={`prompt-bar url-bar${productError && !photos.length ? " invalid" : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              fromListing(listing);
            }}
            noValidate
          >
            <span className="url-prefix" aria-hidden>
              <Icon name="ShoppingBag" size={18} />
            </span>
            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              value={listing}
              onChange={(e) => {
                setListing(e.target.value);
                if (productError) setProductError(null);
              }}
              placeholder="Paste a product listing link"
              aria-label="Product listing link"
            />
            <button className="btn btn-primary btn-lg" type="submit" disabled={pending("product")} aria-busy={pending("product")}>
              {pending("product") ? busyLabel("Opening the studio…") : "Make product video ✦"}
            </button>
          </form>
          <div className="product-or">
            <span>or</span>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void addPhotos(e.target.files);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn btn-ghost" onClick={() => fileInput.current?.click()} disabled={busy || photos.length >= MAX_PHOTOS}>
              <Icon name="ImagePlus" size={16} /> {busy ? "Adding photos…" : photos.length ? "Add more photos" : "Upload product photos"}
            </button>
          </div>
          {photos.length > 0 && (
            <form
              className="product-photos"
              onSubmit={(e) => {
                e.preventDefault();
                fromPhotos();
              }}
            >
              <div className="product-thumbs">
                {photos.map((src) => (
                  <span key={src}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" />
                    <button type="button" aria-label="Remove photo" onClick={() => setPhotos((cur) => cur.filter((x) => x !== src))}>
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="prompt-bar">
                <input
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Name and a few features, e.g. Aero Buds: wireless earbuds with noise cancelling"
                  aria-label="Product name and features"
                />
                <button className="btn btn-primary btn-lg" type="submit" disabled={pending("product")} aria-busy={pending("product")}>
                  {pending("product") ? busyLabel("Opening the studio…") : "Make product video ✦"}
                </button>
              </div>
            </form>
          )}
          <p className={`hero-note${productError ? " error" : ""}`} role={productError ? "alert" : undefined}>
            {productError ?? (
              <>
                Works with {MARKETS.join(", ")}: we read the title, bullet points and photos (not prices or reviews). Or drop in your own product
                photos. Use listings and photos you have the right to use. <Link href="/privacy">What we keep</Link>
              </>
            )}
          </p>
        </div>
      ) : mode === "url" ? (
        <>
          <form
            className={`prompt-bar url-bar${error ? " invalid" : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              fromUrl(url);
            }}
            noValidate
          >
            <span className="url-prefix" aria-hidden>
              <Icon name="Globe" size={18} />
            </span>
            <input
              type="url"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="yourproduct.com"
              aria-label="Your website address"
              aria-invalid={!!error}
              aria-describedby="url-help"
            />
            <button className="btn btn-primary btn-lg" type="submit" disabled={pending("url")} aria-busy={pending("url")}>
              {pending("url") ? busyLabel("Starting your import…") : "Make my video ✦"}
            </button>
          </form>
          <p id="url-help" className={`hero-note${error ? " error" : ""}`} role={error ? "alert" : "status"}>
            {error ?? (pending("url") ? (
              <>Opening the studio: your import starts there, with progress on the preview. It usually takes 15–60 seconds.</>
            ) : (
              <>
                We read your public homepage (logo, brand colours, screenshots, UI and copy) and direct a launch video from it.{" "}
                <Link href="/privacy">What we keep</Link>
              </>
            ))}
          </p>
        </>
      ) : (
        <>
          <form
            className="prompt-bar"
            onSubmit={(e) => {
              e.preventDefault();
              fromPrompt(prompt);
            }}
          >
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your product and the video you want" aria-label="Video prompt" autoFocus />
            <button className="btn btn-primary btn-lg" type="submit" disabled={pending("prompt")} aria-busy={pending("prompt")}>
              {pending("prompt") ? busyLabel("Opening the studio…") : "Generate ✦"}
            </button>
          </form>
          <div className="examples">
            {EXAMPLE_PROMPTS.slice(0, 4).map((p) => (
              <button key={p} className="chip" onClick={() => fromPrompt(p)}>
                {p.length > 52 ? `${p.slice(0, 50)}…` : p}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
    </>
  );
}
