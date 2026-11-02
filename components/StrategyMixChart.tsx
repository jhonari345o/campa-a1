import type { MediaGroup } from "@/lib/media-groups";
import { mediaGroupLabel } from "@/lib/plan-optimizer";
import { mixSegments } from "@/lib/strategy-visuals";
import { formatBudgetInput } from "@/lib/brief-inputs";
import styles from "./MediaStrategyPanel.module.css";
const pct = (value: number) => new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 1 }).format(value);
const money = (value: number | null) => value == null ? "Sin presupuesto" : `$ ${formatBudgetInput(value)}`;
export function StrategyMixChart({ rows, budget, selected = null, compact = false, caption = "Mix recomendado" }: { rows: { medium: MediaGroup; pct: number; amountUsd: number | null }[]; budget: number | null; selected?: MediaGroup | null; compact?: boolean; caption?: string }) {
  const segments = mixSegments(rows, budget), active = selected ? rows.find(row => row.medium === selected) : null, radius = 78, circumference = Math.PI * 2 * radius;
  return <div className={`${styles.donut} ${compact ? styles.compactDonut : ""}`}>
    <svg viewBox="0 0 200 200" role="img" aria-label={`Distribución del presupuesto: ${segments.map(segment => `${segment.key === "unassigned" ? "Sin asignar" : mediaGroupLabel(segment.key)} ${pct(segment.share)}`).join(", ") || "sin distribución disponible"}`}>
      <circle cx="100" cy="100" r={radius} fill="none" stroke="#e1e9df" strokeWidth="25"/>
      {segments.map(segment => <circle key={segment.key} cx="100" cy="100" r={radius} fill="none" stroke={segment.color} strokeWidth={selected === segment.key ? "29" : "25"} strokeDasharray={`${segment.share * circumference} ${circumference}`} strokeDashoffset={-segment.offset * circumference} transform="rotate(-90 100 100)" opacity={selected && selected !== segment.key ? .38 : 1}/>) }
    </svg><div className={styles.donutCenter}><span>{active ? mediaGroupLabel(active.medium) : "Presupuesto"}</span><strong className={active ? undefined : styles.moneyInDonut}>{active ? pct(active.pct) : money(budget)}</strong><small>{active ? money(active.amountUsd) : caption}</small></div>
  </div>;
}
