"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { PostbuyPlacement, WarnerPostbuyCampaign } from "@/lib/warner-postbuy-data";

type Campaign = WarnerPostbuyCampaign;
type EvidenceFilter = "all" | "verified" | "pending";

type MovieTheme = { accent: string; accentSoft: string; ink: string; mood: string };

const MOVIE_THEMES: Record<string, MovieTheme> = {
  "wuthering heights": { accent: "#d74b45", accentSoft: "#f0b6aa", ink: "#291817", mood: "Romance · intensidad · atmósfera" },
  "the bride": { accent: "#9f70d9", accentSoft: "#d8c5ec", ink: "#201a29", mood: "Gótico · misterio · transformación" },
  "they will kill you": { accent: "#b8dc38", accentSoft: "#ddec9d", ink: "#141b10", mood: "Thriller · tensión · alto contraste" },
  "la momia": { accent: "#d7a23d", accentSoft: "#ead39d", ink: "#251c10", mood: "Aventura · arena · escala épica" },
  "mortal kombat 2": { accent: "#e33b31", accentSoft: "#ef9a8e", ink: "#230d0b", mood: "Acción · fuego · confrontación" },
  "supergirl": { accent: "#4f8fe8", accentSoft: "#abc9f0", ink: "#101a2d", mood: "Heroísmo · cielo · energía" },
  "oak street": { accent: "#dd8d3d", accentSoft: "#e8c18f", ink: "#21160e", mood: "Suspenso urbano · noche · proximidad" },
};

const DEFAULT_THEME: MovieTheme = {
  accent: "#e5443c", accentSoft: "#f1afa8", ink: "#181615", mood: "Ejecución · evidencia · resultados",
};

export function PostbuyDashboard({ campaigns }: { campaigns: readonly Campaign[] }) {
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("all");
  const [campaignId, setCampaignId] = useState<string>(campaigns[0]?.id ?? "");
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const active = campaigns.find((campaign) => campaign.id === campaignId) ?? campaigns[0];
  const placements = useMemo(() => {
    if (!active) return [];
    return active.placements.filter((placement) => evidenceFilter === "all" || placement.evidenceStatus === evidenceFilter);
  }, [active, evidenceFilter]);

  useEffect(() => {
    setEvidenceFilter("all");
    setSelectedPlacementId(null);
  }, [campaignId]);

  if (!active) return null;

  const theme = MOVIE_THEMES[active.campaignName.toLocaleLowerCase("es")] ?? DEFAULT_THEME;
  const heroEvidence = active.placements.find((placement) => placement.evidenceImageUrl?.trim())?.evidenceImageUrl ?? null;
  const selectedPlacement = active.placements.find((placement) => placement.id === selectedPlacementId) ?? null;
  const ready = active.placements.filter((placement) => placement.evidenceStatus === "verified").length;
  const pending = active.placements.length - ready;
  const totalImpacts = active.placements.reduce((total, placement) => total + Number(placement.monthlyImpacts ?? 0), 0);
  const completion = active.placements.length ? Math.round((ready / active.placements.length) * 100) : 0;
  const stageStyle = {
    "--warner-accent": theme.accent,
    "--warner-accent-soft": theme.accentSoft,
    "--warner-ink": theme.ink,
  } as CSSProperties;

  return (
    <section className="warner-stage mt-7" style={stageStyle} aria-labelledby="warner-report-title">
      <div className="warner-ruler" aria-hidden />
      <header
        className="warner-hero"
        style={heroEvidence ? { backgroundImage: `linear-gradient(90deg, rgba(13,12,12,.97) 0%, rgba(13,12,12,.89) 47%, rgba(13,12,12,.28) 100%), url(${heroEvidence})` } : undefined}
      >
        <div className="warner-hero-copy">
          <p className="warner-overline">Warner Bros. Discovery Ecuador · Post-buy 2026</p>
          <p className="warner-mood">{theme.mood}</p>
          <h2 id="warner-report-title">{active.campaignName}</h2>
          <p className="warner-hero-description">
            Léttera dirige la operación de medios para Warner. Ad Mavericks One es la herramienta de Léttera que organiza la ejecución, las evidencias y la lectura de resultados.
          </p>
          <div className="warner-relationship" aria-label="Relación del proyecto">
            <span className="warner-lettera-lockup">
              {/* Activo de marca entregado dentro de la presentación de Léttera. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/partners/lettera/lettera-logo.png" alt="Léttera" />
              <small>Agencia de medios</small>
            </span>
            <span className="warner-relationship-mark" aria-hidden>×</span>
            <span className="warner-tool-lockup">
              <strong>AD MAVERICKS <b>ONE</b></strong>
              <small>Plataforma de Léttera</small>
            </span>
          </div>
        </div>
        <div className="warner-hero-data" aria-label="Resumen de campaña">
          <span>{active.monthLabel}</span>
          <strong>{formatCompact(totalImpacts)}</strong>
          <small>impactos mensuales registrados</small>
          <div className="warner-progress" aria-label={`${completion}% de evidencias verificadas`}><i style={{ width: `${completion}%` }} /></div>
          <p>{ready} verificadas · {pending} pendientes</p>
        </div>
      </header>

      <div className="warner-campaign-nav" aria-label="Películas de Warner">
        <div className="warner-campaign-nav-heading"><span>Temporada 2026</span><strong>Selecciona una película</strong></div>
        <div className="warner-movie-tabs" role="tablist" aria-label="Cambiar película">
          {campaigns.map((campaign, index) => (
            <button key={campaign.id} type="button" role="tab" aria-selected={campaign.id === active.id} className={campaign.id === active.id ? "is-active" : ""} onClick={() => setCampaignId(campaign.id)}>
              <span>{String(index + 1).padStart(2, "0")}</span><strong>{campaign.campaignName}</strong><small>{campaign.monthLabel}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="warner-summary-grid" aria-label="Métricas de la película">
        <EditorialSummary index="01" label="Alcance OOH" value={formatPercent(active.oohReach)} />
        <EditorialSummary index="02" label="Alcance radio" value={formatPercent(active.radioReach)} />
        <EditorialSummary index="03" label="Alcance total" value={formatPercent(active.totalReach)} />
        <EditorialSummary index="04" label="Ubicaciones" value={formatNumber(active.placements.length)} />
      </div>

      <div className="warner-content">
        <div className="warner-content-heading">
          <div><p>Inventario ejecutado</p><h3>Fichas de ubicación</h3><span>{placements.length} de {active.placements.length} ubicaciones visibles</span></div>
          <div className="warner-evidence-filters" aria-label="Filtrar evidencias">
            {(["all", "verified", "pending"] as const).map((filter) => (
              <button key={filter} type="button" onClick={() => setEvidenceFilter(filter)} aria-pressed={evidenceFilter === filter} className={evidenceFilter === filter ? "is-active" : ""}>
                {filter === "all" ? "Todas" : filter === "verified" ? "Con evidencia" : "Pendientes"}
              </button>
            ))}
          </div>
        </div>

        {selectedPlacement && <PlacementDetail placement={selectedPlacement} onClose={() => setSelectedPlacementId(null)} />}

        <div className="warner-placement-grid" aria-live="polite">
          {placements.map((placement, index) => (
            <PlacementCard key={placement.id} placement={placement} index={index + 1} selected={placement.id === selectedPlacementId} onSelect={() => setSelectedPlacementId(placement.id)} />
          ))}
        </div>
        {placements.length === 0 && <p className="warner-empty">No hay ubicaciones en este estado.</p>}
        <p className="warner-source-note">Los impactos y alcances reproducen la fuente entregada por Warner. “Evidencia pendiente” significa que la foto final no consta en el archivo; no se sustituye con una referencia visual.</p>
      </div>
    </section>
  );
}

function PlacementCard({ placement, index, selected, onSelect }: { placement: PostbuyPlacement; index: number; selected: boolean; onSelect: () => void }) {
  const hasEvidence = Boolean(placement.evidenceImageUrl?.trim());
  return (
    <article className={`warner-placement-card ${selected ? "is-selected" : ""}`}>
      <div className="warner-placement-visual">
        <span className="warner-card-index">{String(index).padStart(2, "0")}</span>
        {hasEvidence ? (
          // La evidencia proviene de los archivos controlados del proyecto.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={placement.evidenceImageUrl!} alt={`Evidencia de ${placement.name}`} loading="lazy" />
        ) : (
          <div className="warner-evidence-pending bg-yellow-300"><span aria-hidden>◷</span><strong>Evidencia Pendiente</strong><small>La foto de ejecución aún no fue entregada.</small></div>
        )}
      </div>
      <div className="warner-placement-body">
        <div className="warner-placement-title"><MediaLogo placement={placement} /><div><span>{channelLabel(placement.channel)}</span><h4>{placement.name}</h4></div></div>
        <dl className="warner-metrics">
          <Metric label="Impactos mensuales" value={formatCompact(placement.monthlyImpacts)} />
          <Metric label="Elementos" value={placement.quantity == null ? "—" : formatNumber(placement.quantity)} />
          <Metric label="Derechos de medio" value={placement.mediaRights == null ? "—" : formatNumber(placement.mediaRights)} />
          <Metric label="Estado" value={hasEvidence ? "Verificada" : "Pendiente"} pending={!hasEvidence} />
        </dl>
        <button type="button" className="warner-detail-button" onClick={onSelect} aria-expanded={selected}>{selected ? "Ficha abierta" : "Ver ficha completa"}<span aria-hidden>↗</span></button>
      </div>
    </article>
  );
}

function PlacementDetail({ placement, onClose }: { placement: PostbuyPlacement; onClose: () => void }) {
  const hasEvidence = Boolean(placement.evidenceImageUrl?.trim());
  return (
    <aside className="warner-placement-detail" aria-label={`Detalle de ${placement.name}`}>
      <div className="warner-detail-media">
        {hasEvidence ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={placement.evidenceImageUrl!} alt={`Vista ampliada de ${placement.name}`} />
        ) : (
          <div className="warner-evidence-pending bg-yellow-300"><span aria-hidden>◷</span><strong>Evidencia Pendiente</strong></div>
        )}
      </div>
      <div className="warner-detail-copy">
        <button type="button" onClick={onClose} aria-label="Cerrar ficha ampliada">×</button>
        <p>Ficha seleccionada · {channelLabel(placement.channel)}</p><h4>{placement.name}</h4>
        <dl>
          <Metric label="Impactos mensuales" value={formatCompact(placement.monthlyImpacts)} />
          <Metric label="Cantidad" value={placement.quantity == null ? "—" : formatNumber(placement.quantity)} />
          <Metric label="Derechos de medio" value={placement.mediaRights == null ? "—" : formatNumber(placement.mediaRights)} />
        </dl>
        {placement.sourceNote && <p className="warner-detail-note">{placement.sourceNote}</p>}
      </div>
    </aside>
  );
}

function MediaLogo({ placement }: { placement: PostbuyPlacement }) {
  if (placement.mediaLogoUrl) {
    return (
      <span className="warner-media-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={placement.mediaLogoUrl} alt={`Logo de ${placement.mediaName}`} loading="lazy" />
      </span>
    );
  }
  const initials = placement.mediaName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className="warner-media-logo is-fallback">{initials || "AM"}</span>;
}

function EditorialSummary({ index, label, value }: { index: string; label: string; value: string }) {
  return <div><span>{index}</span><p>{label}</p><strong>{value}</strong></div>;
}

function Metric({ label, value, pending = false }: { label: string; value: string; pending?: boolean }) {
  return <div className={pending ? "is-pending" : ""}><dt>{label}</dt><dd>{value}</dd></div>;
}

function formatCompact(value: number | null) {
  if (value == null) return "—";
  if (Math.abs(value) >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (Math.abs(value) >= 1_000) return `${trim(value / 1_000)}K`;
  return formatNumber(value);
}

function trim(value: number) { return value.toFixed(1).replace(/\.0$/, ""); }
function formatNumber(value: number) { return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(value); }
function formatPercent(value: number | null) { return value == null ? "—" : new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 2 }).format(value); }
function channelLabel(channel: PostbuyPlacement["channel"]) { return channel === "ooh" ? "Vía pública" : channel === "radio" ? "Radio" : "BTL"; }
