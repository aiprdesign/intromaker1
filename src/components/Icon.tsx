"use client";

import { LUCIDE } from "@/engine/lucide-set";

/** Inline SVG of a Lucide icon (ISC) by name, for the studio UI. */
export default function Icon({ name, size = 14, className }: { name: string; size?: number; className?: string }) {
  const node = LUCIDE[name] ?? LUCIDE.Sparkles;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {node.map(([tag, attrs], i) => {
        const Tag = tag as "path";
        return <Tag key={i} {...(attrs as Record<string, string>)} />;
      })}
    </svg>
  );
}
