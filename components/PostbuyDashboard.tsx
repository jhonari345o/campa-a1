"use client";

import { useMemo, useState } from "react";
import type { PostbuyPlacement, WarnerPostbuyCampaign } from "@/lib/warner-postbuy-data";

type Campaign = WarnerPostbuyCampaign;
type EvidenceFilter = "all" | "verified" | "pending";

export function PostbuyDashboard({ campaigns }: { campaigns: readonly Campaign[] }) {
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("all");
  const [campaignId, setCampaignId] = useState<string>(campaigns[0]?.id ?? "");
  const active = campaigns.find((campaign) => campaign.id === campaignId) ?? campaigns[0];
  const placements = useMemo(() => {
    if (!active) return [];
    return active.placements.filter((placement) => evidenceFilter === "all" || placement.evidenceStatus === evidenceFilter);
  }, [active, evidenceFilter]);

  if (!active) return null;
  const ready = active.placements.filter((placement) => placement.evidenceStatus === "verified").length;
  const totalImpacts = active.placements.reduce((total, placement) => total + Number(placement.monthlyImpacts ?? 0), 0);

  return (
    <section className="mt-7 rounded-panel border border-forest/15 bg-white p-5 shadow-panel sm:p-7">
      <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-signal-dark">Módulo de reportería y post-buys</p>
          <h2 className="mt-2 text-2xl font-black text-forest">Warner · ejecución 2026</h2>
          <p className="mt-1 text-sm text-muted">Evidencias, impactos y alcance por campaña, ubicación y medio.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Summary label="Campañas" value={formatNumber(campaigns.length)} />
          <Summary label="Impactos" value={formatCompact(totalImpacts)} />
          <Summary label="Evidencias" value={`${ready}/${active.placements.length}`} />
        </div>
      </header>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(230px,320px)_1fr]">
        <label className="text-xs font-black uppercase tracking-wide text-forest">
          Campaña
          <select
            value={active.id}
            onChange={(event) => setCampaignId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-fog px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-signal"
          >
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.monthLabel} · {campaign.campaignName}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-2 sm:grid-cols-4">
          <Summary label="Mes" value={active.monthLabel} />
          <Summary label="Alcance OOH" value={formatPercent(active.oohReach)} />
          <Summary label="Alcance radio" value={formatPercent(active.radioReach)} />
          <Summary label="Alcance total" value={formatPercent(active.totalReach)} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-forest">{active.campaignName}</h3>
          <p className="text-xs text-muted">{active.clientName} · {active.placements.length} ubicaciones</p>
        </div>
        <div className="flex rounded-xl border border-border bg-fog p-1" aria-label="Filtrar evidencias">
          {(["all", "verified", "pending"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setEvidenceFilter(filter)}
              className={`rounded-lg px-3 py-2 text-xs font-black ${evidenceFilter === filter ? "bg-forest text-white" : "text-muted"}`}
            >
              {filter === "all" ? "Todas" : filter === "verified" ? "Con evidencia" : "Pendientes"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {placements.map((placement) => <PlacementCard key={placement.id} placement={placement} />)}
      </div>
      {placements.length === 0 && <p className="mt-5 rounded-xl bg-fog p-8 text-center text-sm text-muted">No hay ubicaciones en este estado.</p>}

      <p className="mt-5 text-[11px] leading-relaxed text-muted">
        Los impactos y alcances reproducen la fuente entregada. “Evidencia pendiente” significa que la foto final no consta en el archivo; no se sustituye con una referencia visual.
      </p>
    </section>
  );
}

function PlacementCard({ placement }: { placement: PostbuyPlacement }) {
  const hasEvidence = Boolean(placement.evidenceImageUrl?.trim());
  return (
    <article className="overflow-hidden rounded-2xl border border-forest/15 bg-white shadow-sm">
      {hasEvidence ? (
        // La evidencia proviene de los archivos controlados del proyecto.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={placement.evidenceImageUrl!} alt={`Evidencia de ${placement.name}`} className="h-48 w-full bg-fog object-cover" loading="lazy" />
      ) : (
        <div className="grid h-48 place-items-center bg-yellow-300 px-5 text-center text-amber-950">
          <div><span className="text-3xl" aria-hidden>◷</span><strong className="mt-2 block text-sm uppercase tracking-wide">Evidencia Pendiente</strong><small className="mt-1 block">La foto de ejecución aún no fue entregada.</small></div>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <MediaLogo placement={placement} />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-[.14em] text-signal-dark">{channelLabel(placement.channel)}</span>
            <h4 className="mt-1 text-sm font-black leading-snug text-forest">{placement.name}</h4>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <Metric label="Impactos mensuales" value={formatCompact(placement.monthlyImpacts)} />
          <Metric label="Elementos" value={placement.quantity == null ? "—" : formatNumber(placement.quantity)} />
          <Metric label="Derechos de medio" value={placement.mediaRights == null ? "—" : formatNumber(placement.mediaRights)} />
          <Metric label="Estado" value={hasEvidence ? "Verificada" : "Pendiente"} pending={!hasEvidence} />
        </dl>
        {placement.sourceNote && <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">{placement.sourceNote}</p>}
      </div>
    </article>
  );
}

function MediaLogo({ placement }: { placement: PostbuyPlacement }) {
  if (placement.mediaLogoUrl) {
    return (
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={placement.mediaLogoUrl} alt={`Logo de ${placement.mediaName}`} className="max-h-full max-w-full object-contain" loading="lazy" />
      </span>
    );
  }
  const initials = placement.mediaName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-forest text-xs font-black text-white">{initials || "AM"}</span>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-fog px-3 py-2"><span className="block text-[9px] font-black uppercase tracking-wide text-muted">{label}</span><strong className="mt-1 block text-sm text-forest">{value}</strong></div>;
}

function Metric({ label, value, pending = false }: { label: string; value: string; pending?: boolean }) {
  return <div className={`rounded-xl p-3 ${pending ? "bg-yellow-100 text-amber-900" : "bg-fog text-forest"}`}><dt className="text-[9px] font-black uppercase tracking-wide opacity-65">{label}</dt><dd className="mt-1 text-sm font-black">{value}</dd></div>;
}

function formatCompact(value: number | null) {
  if (value == null) return "—";
  if (Math.abs(value) >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (Math.abs(value) >= 1_000) return `${trim(value / 1_000)}K`;
  return formatNumber(value);
}

function trim(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null) {
  return value == null ? "—" : new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 2 }).format(value);
}

function channelLabel(channel: PostbuyPlacement["channel"]) {
  return channel === "ooh" ? "Vía pública" : channel === "radio" ? "Radio" : "BTL";
}
