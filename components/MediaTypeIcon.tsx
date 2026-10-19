import type { ReactNode } from "react";

export type MediaType = "television" | "radio" | "ooh" | "press" | "digital" | "influencers";

const artwork: Record<MediaType, ReactNode> = {
  television: <>
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <path d="M12 18v3M8 21h8M10 8l5 3-5 3Z" />
  </>,
  radio: <>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="m5 8 13-5M14 12h4M14 16h1M18 16h.01" />
    <circle cx="8" cy="14" r="2.5" />
  </>,
  ooh: <>
    <rect x="2" y="4" width="20" height="12" rx="1.5" />
    <path d="M7 16v5M17 16v5M5 21h14M6 12l4-4 4 4 4-4" />
  </>,
  press: <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M6 7h5v4H6ZM14 7h4M14 11h4M6 14h12M6 17h8" />
  </>,
  digital: <>
    <rect x="2" y="3" width="20" height="16" rx="2" />
    <path d="M2 7h20M5 5h.01M8 5h.01M11 10l7 5-4 1-1 4Z" />
  </>,
  influencers: <>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 21v-2a6 6 0 0 1 12 0v2M18 3l1.2 3.8L23 8l-3.8 1.2L18 13l-1.2-3.8L13 8l3.8-1.2Z" />
  </>,
};

/** Decorative artwork; the adjacent label names the medium. */
export function MediaTypeIcon({ type, className }: { type: MediaType; className?: string }) {
  return (
    <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {artwork[type]}
    </svg>
  );
}
