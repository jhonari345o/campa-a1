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

export type MaviMotion = "float" | "bounce" | "peek" | "still";

const MOTION_CLASS: Record<MaviMotion, string | false> = {
  float: "mavi-float",
  bounce: "mavi-bounce",
  peek: "mavi-peek",
  still: false,
};

/**
 * Mavi "en accion": su ilustracion + un accesorio (emoji) que sugiere lo que
 * esta haciendo (revisando datos, esperando, lanzando...) y un globo de
 * dialogo opcional. Le da protagonismo en cada pantalla.
 */
export function MaviScene({
  height = 120,
  motion = "float",
  prop,
  says,
  className,
  bubbleClassName,
}: {
  height?: number;
  motion?: MaviMotion;
  prop?: string;
  says?: string;
  className?: string;
  bubbleClassName?: string;
}) {
  const figure = (
    <div className="relative inline-block" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mavi/mavi.png"
        alt="Mavi, la iguana de Ad Mavericks"
        className={clsx("select-none", MOTION_CLASS[motion])}
        style={{ height, width: "auto" }}
        draggable={false}
      />
      {prop && (
        <span className="mavi-prop" aria-hidden>
          {prop}
        </span>
      )}
    </div>
  );

  if (!says) return <div className={className}>{figure}</div>;

  return (
    <div className={clsx("flex items-center gap-3", className)}>
      {figure}
      <p className={clsx("mavi-bubble max-w-xs text-sm font-medium text-forest", bubbleClassName)}>
        {says}
      </p>
    </div>
  );
}
