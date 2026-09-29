import { clsx } from "@/lib/clsx";

/** Estado de dato: verificado (verde) o pendiente (ambar). "Datos honestos". */
export function StatusBadge({ status }: { status: "verificado" | "pendiente" }) {
  const verified = status === "verificado";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black",
        verified ? "bg-signal/15 text-signal-dark" : "bg-amber/20 text-[#9a6a00]",
      )}
    >
      <span aria-hidden>{verified ? "✓" : "•"}</span>
      {verified ? "Verificado" : "Pendiente"}
    </span>
  );
}
