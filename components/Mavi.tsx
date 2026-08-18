import { clsx } from "@/lib/clsx";

/**
 * Mavi — la iguana de Guayaquil, mascota de Ad Mavericks One.
 * Usa la ilustracion oficial (public/mavi). La animacion "flotar" respeta
 * prefers-reduced-motion (desactivada globalmente en globals.css).
 */

/** Carita de Mavi para avatares (chat, encabezados). */
export function MaviAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/mavi/mavi-cara.png"
      alt="Mavi"
      className={clsx("rounded-full bg-signal/10 object-cover object-top", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Mavi de cuerpo completo, con flotacion opcional. */
export function MaviFull({
  height = 120,
  className,
  float = true,
}: {
  height?: number;
  className?: string;
  float?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/mavi/mavi.png"
      alt="Mavi, la iguana de Ad Mavericks"
      className={clsx("select-none", float && "mavi-float", className)}
      style={{ height, width: "auto" }}
      draggable={false}
    />
  );
}
