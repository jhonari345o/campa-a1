import Image from "next/image";
import { clsx } from "@/lib/clsx";

type WordmarkProps = {
  /** Muestra la capsula "ONE" del producto de plataforma. */
  one?: boolean;
  className?: string;
  invert?: boolean;
};

/**
 * Logotipo oficial de Ad Mavericks extraido del manual de marca.
 * "One" identifica la plataforma unificada sin alterar la marca madre.
 */
export function Wordmark({ one = false, className, invert = false }: WordmarkProps) {
  return (
    <span
      aria-label={one ? "Ad Mavericks One" : "Ad Mavericks"}
      className={clsx(
        "inline-flex items-center gap-2.5 whitespace-nowrap",
        className,
      )}
    >
      <Image
        src={invert ? "/brand/ad-mavericks-logo-light.png" : "/brand/ad-mavericks-logo.png"}
        width={1675}
        height={679}
        alt=""
        className="h-[2.45em] w-auto max-w-none object-contain"
      />
      {one && (
        <span className="rounded-[11px] bg-signal px-2.5 py-1 text-[0.55em] font-black tracking-[0.08em] text-[#07140e]">
          ONE
        </span>
      )}
    </span>
  );
}
