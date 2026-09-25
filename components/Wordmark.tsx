import { clsx } from "@/lib/clsx";

type WordmarkProps = {
  /** Muestra la capsula "ONE" del producto de plataforma. */
  one?: boolean;
  className?: string;
  invert?: boolean;
};

/**
 * Logotipo textual de Ad Mavericks.
 * "Ad Mavericks" es la marca madre; "One" identifica la plataforma unificada.
 */
export function Wordmark({ one = false, className, invert = false }: WordmarkProps) {
  return (
    <span
      aria-label={one ? "Ad Mavericks One" : "Ad Mavericks"}
      className={clsx(
        "inline-flex items-center gap-2.5 whitespace-nowrap font-black tracking-[0.055em]",
        invert ? "text-white" : "text-forest",
        className,
      )}
    >
      AD MAVERICKS
      {one && (
        <span className="rounded-[11px] bg-signal px-2.5 py-1 text-[0.55em] tracking-[0.08em] text-[#07140e]">
          ONE
        </span>
      )}
    </span>
  );
}
