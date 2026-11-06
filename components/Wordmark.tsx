import Image from "next/image";
import { clsx } from "@/lib/clsx";
import styles from "./Wordmark.module.css";

type WordmarkProps = {
  /** Muestra el distintivo One del producto de plataforma. */
  one?: boolean;
  className?: string;
  invert?: boolean;
};

/**
 * La marca One usa la composición vectorial aprobada, sin eslogan.
 * La marca institucional conserva su versión original.
 */
export function Wordmark({ one = false, className, invert = false }: WordmarkProps) {
  return (
    <span
      aria-label={one ? "Ad Mavericks One" : "Ad Mavericks"}
      className={clsx(styles.wordmark, className)}
    >
      {one ? (
        <Image
          src={invert ? "/brand/ad-mavericks-one-light.svg" : "/brand/ad-mavericks-one-dark.svg"}
          width={2469.212}
          height={639.564}
          alt=""
          className={styles.one}
        />
      ) : (
        <Image
          src={invert ? "/brand/ad-mavericks-logo-light.png" : "/brand/ad-mavericks-logo.png"}
          width={1675}
          height={679}
          alt=""
          className={styles.logo}
        />
      )}
    </span>
  );
}
