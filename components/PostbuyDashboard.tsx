"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { PostbuyPlacement, WarnerPostbuyCampaign } from "@/lib/warner-postbuy-data";

type Campaign = WarnerPostbuyCampaign;
type EvidenceFilter = "all" | "verified" | "pending";
type ReportLevel = "agency" | "studio" | "catalog" | "report";
type MovieTheme = { accent: string; accentSoft: string; ink: string; mood: string };

const MOVIE_THEMES: Record<string, MovieTheme> = {
  "wuthering heights": { accent: "#d74b45", accentSoft: "#f0b6aa", ink: "#291817", mood: "Romance · intensidad · atmósfera" },
  "the bride": { accent: "#ef6d22", accentSoft: "#f0b898", ink: "#071c25", mood: "Gótico · misterio · transformación" },
  "they will kill you": { accent: "#c3342f", accentSoft: "#e9a39f", ink: "#180b0b", mood: "Thriller · tensión · alto contraste" },
  "la momia": { accent: "#d7a23d", accentSoft: "#ead39d", ink: "#251c10", mood: "Aventura · arena · escala épica" },
  "mortal kombat 2": { accent: "#e33b31", accentSoft: "#71cfe8", ink: "#100c0c", mood: "Acción · fuego · confrontación" },
  "supergirl": { accent: "#e5362c", accentSoft: "#f4c735", ink: "#0c3b73", mood: "Heroísmo · cielo · energía" },
  "oak street": { accent: "#79b9d1", accentSoft: "#d8ecf2", ink: "#152831", mood: "Suspenso urbano · aventura · proximidad" },
};

const POSTERS: Record<string, string> = {
  "wuthering heights": "/postbuy/warner/posters/wuthering-heights.jpg",
  "the bride": "/postbuy/warner/posters/the-bride.jpg",
  "they will kill you": "/postbuy/warner/posters/they-will-kill-you.jpg",
  "la momia": "/postbuy/warner/posters/la-momia.jpg",
  "mortal kombat 2": "/postbuy/warner/posters/mortal-kombat-2.jpg",
  "supergirl": "/postbuy/warner/posters/supergirl.jpg",
  "oak street": "/postbuy/warner/posters/oak-street.jpg",
};

const DEFAULT_THEME: MovieTheme = {
  accent: "#e5443c", accentSoft: "#f1afa8", ink: "#181615", mood: "Ejecución · evidencia · resultados",
};

export function PostbuyDashboard({ campaigns }: { campaigns: readonly Campaign[] }) {
  const [level, setLevel] = useState<ReportLevel>("agency");
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

  const theme = movieTheme(active);
  const poster = moviePoster(active);
  const selectedPlacement = active.placements.find((placement) => placement.id === selectedPlacementId) ?? null;
  const ready = active.placements.filter((placement) => placement.evidenceStatus === "verified").length;
  const pending = active.placements.length - ready;
  const totalImpacts = campaignImpacts(active);
  const completion = active.placements.length ? Math.round((ready / active.placements.length) * 100) : 0;
  const stageStyle = {
    "--warner-accent": theme.accent,
    "--warner-accent-soft": theme.accentSoft,
    "--warner-ink": theme.ink,
  } as CSSProperties;

  const openCampaign = (campaign: Campaign) => {
    setCampaignId(campaign.id);
    setLevel("report");
  };

  return (
    <section className="warner-stage mt-7" style={stageStyle} aria-labelledby="warner-report-title">
      <div className="warner-ruler" aria-hidden />
      <ReportBreadcrumb level={level} setLevel={setLevel} />

      {level === "agency" && <AgencySelection onSelect={() => setLevel("studio")} />}
      {level === "studio" && <StudioSelection campaigns={campaigns} onBack={() => setLevel("agency")} onSelect={() => setLevel("catalog")} />}
      {level === "catalog" && <MovieCatalog campaigns={campaigns} onBack={() => setLevel("studio")} onSelect={openCampaign} />}

      {level === "report" && (
        <>
          <header className="warner-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(13,12,12,.97) 0%, rgba(13,12,12,.87) 48%, rgba(13,12,12,.18) 100%), url(${poster})` }}>
            <div className="warner-hero-copy">
              <p className="warner-overline">Warner Bros. Discovery Ecuador · Post-buy 2026</p>
              <p className="warner-mood">{theme.mood}</p>
              <h2 id="warner-report-title">{active.campaignName}</h2>
              <p className="warner-hero-description">
                Léttera dirige la operación de medios para Warner. Ad Mavericks One es la herramienta de Léttera que organiza la inversión, la ejecución, las evidencias y la lectura de resultados.
              </p>
              <BrandRelationship />
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
            <div className="warner-campaign-nav-heading"><span>Temporada 2026</span><strong>Cambiar película</strong></div>
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

          <WarnerReportCharts campaign={active} />

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
        </>
      )}
    </section>
  );
}

function ReportBreadcrumb({ level, setLevel }: { level: ReportLevel; setLevel: (level: ReportLevel) => void }) {
  const steps: Array<{ id: ReportLevel; label: string }> = [
    { id: "agency", label: "Agencia" }, { id: "studio", label: "Estudio" }, { id: "catalog", label: "Películas" }, { id: "report", label: "Reporte" },
  ];
  const current = steps.findIndex((step) => step.id === level);
  return (
    <nav className="warner-breadcrumb" aria-label="Navegación del reporte">
      <strong>Reportes de agencia</strong>
      <ol>
        {steps.map((step, index) => (
          <li key={step.id}>
            <button type="button" disabled={index > current} className={index === current ? "is-current" : ""} onClick={() => index <= current && setLevel(step.id)}>
              <span>{index + 1}</span>{step.label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function AgencySelection({ onSelect }: { onSelect: () => void }) {
  return (
    <div className="warner-selector-screen">
      <header><p>Biblioteca de reportería</p><h2 id="warner-report-title">Selecciona una agencia</h2><span>Ingresa a la agencia responsable para consultar sus estudios, campañas y resultados.</span></header>
      <button type="button" className="warner-entry-card is-lettera" onClick={onSelect}>
        <div><img src="/partners/lettera/lettera-logo.png" alt="Léttera" /></div>
        <span>Agencia de medios</span><strong>Léttera</strong><p>Planificación, ejecución y reportería administrada mediante Ad Mavericks One.</p><b>Explorar estudios <i aria-hidden>→</i></b>
      </button>
      <BrandRelationship />
    </div>
  );
}

function StudioSelection({ campaigns, onBack, onSelect }: { campaigns: readonly Campaign[]; onBack: () => void; onSelect: () => void }) {
  const totalImpacts = campaigns.reduce((sum, campaign) => sum + campaignImpacts(campaign), 0);
  return (
    <div className="warner-selector-screen">
      <header><p>Léttera · Estudios</p><h2 id="warner-report-title">Selecciona un estudio</h2><span>Cada estudio abre su propio catálogo histórico de campañas y post-buys.</span></header>
      <button type="button" className="warner-entry-card is-warner" onClick={onSelect}>
        <div className="warner-studio-mark" aria-hidden>WB</div><span>Estudio activo</span><strong>Warner Bros. Discovery</strong>
        <p>{campaigns.length} películas · {formatCompact(totalImpacts)} impactos documentados.</p><b>Ver catálogo <i aria-hidden>→</i></b>
      </button>
      <button type="button" className="warner-back-button" onClick={onBack}>← Volver a agencias</button>
    </div>
  );
}

function MovieCatalog({ campaigns, onBack, onSelect }: { campaigns: readonly Campaign[]; onBack: () => void; onSelect: (campaign: Campaign) => void }) {
  return (
    <div className="warner-catalog-screen">
      <header><div><p>Léttera · Warner Bros. Discovery</p><h2 id="warner-report-title">Catálogo de películas</h2><span>Selecciona una campaña para abrir sus gráficos, evidencias y lectura de resultados.</span></div><BrandRelationship /></header>
      <div className="warner-movie-catalog">
        {campaigns.map((campaign) => {
          const verified = campaign.placements.filter((placement) => placement.evidenceStatus === "verified").length;
          const theme = movieTheme(campaign);
          return (
            <article key={campaign.id} style={{ "--movie-accent": theme.accent } as CSSProperties}>
              <button type="button" onClick={() => onSelect(campaign)} aria-label={`Abrir reporte de ${campaign.campaignName}`}>
                {/* Arte social oficial almacenado dentro del proyecto. */}
                <img src={moviePoster(campaign)} alt={`Arte oficial de ${campaign.campaignName}`} loading="lazy" />
                <span>{campaign.monthLabel} 2026</span>
                <div><p>{campaign.status === "completed" ? "Reporte completo" : "Reporte parcial"}</p><h3>{campaign.campaignName}</h3><dl><Metric label="Impactos" value={formatCompact(campaignImpacts(campaign))} /><Metric label="Evidencias" value={`${verified}/${campaign.placements.length}`} /></dl><b>Abrir reporte <i aria-hidden>↗</i></b></div>
              </button>
            </article>
          );
        })}
      </div>
      <button type="button" className="warner-back-button" onClick={onBack}>← Volver a estudios</button>
    </div>
  );
}

function BrandRelationship() {
  return (
    <div className="warner-relationship" aria-label="Relación del proyecto">
      <span className="warner-lettera-lockup"><img src="/partners/lettera/lettera-logo.png" alt="Léttera" /><small>Agencia de medios</small></span>
      <span className="warner-relationship-mark" aria-hidden>×</span>
      <span className="warner-tool-lockup"><strong>AD MAVERICKS <b>ONE</b></strong><small>Plataforma de Léttera</small></span>
    </div>
  );
}

function WarnerReportCharts({ campaign }: { campaign: Campaign }) {
  const impactRows = campaign.placements.filter((placement) => Number(placement.monthlyImpacts ?? 0) > 0).sort((a, b) => Number(b.monthlyImpacts) - Number(a.monthlyImpacts)).slice(0, 7);
  const maxImpact = Math.max(...impactRows.map((placement) => Number(placement.monthlyImpacts)), 1);
  const channelTotals = (["ooh", "radio", "btl"] as const).map((channel) => ({
    channel,
    value: campaign.placements.filter((placement) => placement.channel === channel).reduce((sum, placement) => sum + Number(placement.monthlyImpacts ?? 0), 0),
    count: campaign.placements.filter((placement) => placement.channel === channel).length,
  }));
  const maxChannel = Math.max(...channelTotals.map((item) => item.value), 1);
  const verified = campaign.placements.filter((placement) => placement.evidenceStatus === "verified").length;
  const coverage = campaign.placements.length ? Math.round((verified / campaign.placements.length) * 100) : 0;
  return (
    <section className="warner-report-charts" aria-label="Gráficos del reporte">
      <header><p>Visualización de resultados</p><h3>Lectura gráfica</h3><span>Todos los gráficos se calculan con la información documentada en el post-buy.</span></header>
      <div className="warner-chart-grid">
        <article className="warner-bar-chart">
          <div><span>Impactos por ubicación</span><strong>Top {impactRows.length}</strong></div>
          <ol>{impactRows.map((placement) => <li key={placement.id}><p title={placement.name}>{placement.name}</p><div><i style={{ width: `${Math.max(4, (Number(placement.monthlyImpacts) / maxImpact) * 100)}%` }} /></div><b>{formatCompact(placement.monthlyImpacts)}</b></li>)}</ol>
        </article>
        <article className="warner-channel-chart">
          <div><span>Distribución por canal</span><strong>{formatCompact(campaignImpacts(campaign))}</strong></div>
          <ul>{channelTotals.map((item) => <li key={item.channel}><p><span>{channelLabel(item.channel)}</span><b>{item.count} ubicación{item.count === 1 ? "" : "es"}</b></p><div><i style={{ width: `${item.value ? Math.max(5, (item.value / maxChannel) * 100) : 0}%` }} /></div><strong>{formatCompact(item.value)}</strong></li>)}</ul>
        </article>
        <article className="warner-evidence-chart">
          <div className="warner-donut" style={{ background: `conic-gradient(var(--warner-accent) 0 ${coverage}%, #d7d0c4 ${coverage}% 100%)` }}><span><strong>{coverage}%</strong><small>verificado</small></span></div>
          <div><span>Cobertura de evidencias</span><strong>{verified} de {campaign.placements.length}</strong><p>Las piezas pendientes permanecen visibles y señalizadas; no se reemplazan con simulaciones.</p></div>
        </article>
      </div>
    </section>
  );
}

function PlacementCard({ placement, index, selected, onSelect }: { placement: PostbuyPlacement; index: number; selected: boolean; onSelect: () => void }) {
  const hasEvidence = Boolean(placement.evidenceImageUrl?.trim());
  return (
    <article className={`warner-placement-card ${selected ? "is-selected" : ""}`}>
      <div className="warner-placement-visual"><span className="warner-card-index">{String(index).padStart(2, "0")}</span>{hasEvidence ? (<img src={placement.evidenceImageUrl!} alt={`Evidencia de ${placement.name}`} loading="lazy" />) : (<div className="warner-evidence-pending bg-yellow-300"><span aria-hidden>◷</span><strong>Evidencia Pendiente</strong><small>La foto de ejecución aún no fue entregada.</small></div>)}</div>
      <div className="warner-placement-body"><div className="warner-placement-title"><MediaLogo placement={placement} /><div><span>{channelLabel(placement.channel)}</span><h4>{placement.name}</h4></div></div><dl className="warner-metrics"><Metric label="Impactos mensuales" value={formatCompact(placement.monthlyImpacts)} /><Metric label="Elementos" value={placement.quantity == null ? "—" : formatNumber(placement.quantity)} /><Metric label="Derechos / menciones" value={placement.mediaRights == null ? "—" : formatNumber(placement.mediaRights)} /><Metric label="Estado" value={hasEvidence ? "Verificada" : "Pendiente"} pending={!hasEvidence} /></dl><button type="button" className="warner-detail-button" onClick={onSelect} aria-expanded={selected}>{selected ? "Ficha abierta" : "Ver ficha completa"}<span aria-hidden>↗</span></button></div>
    </article>
  );
}

function PlacementDetail({ placement, onClose }: { placement: PostbuyPlacement; onClose: () => void }) {
  const hasEvidence = Boolean(placement.evidenceImageUrl?.trim());
  return (
    <aside className="warner-placement-detail" aria-label={`Detalle de ${placement.name}`}><div className="warner-detail-media">{hasEvidence ? (<img src={placement.evidenceImageUrl!} alt={`Vista ampliada de ${placement.name}`} />) : (<div className="warner-evidence-pending bg-yellow-300"><span aria-hidden>◷</span><strong>Evidencia Pendiente</strong></div>)}</div><div className="warner-detail-copy"><button type="button" onClick={onClose} aria-label="Cerrar ficha ampliada">×</button><p>Ficha seleccionada · {channelLabel(placement.channel)}</p><h4>{placement.name}</h4><dl><Metric label="Impactos mensuales" value={formatCompact(placement.monthlyImpacts)} /><Metric label="Cantidad" value={placement.quantity == null ? "—" : formatNumber(placement.quantity)} /><Metric label="Derechos / menciones" value={placement.mediaRights == null ? "—" : formatNumber(placement.mediaRights)} /></dl>{placement.sourceNote && <p className="warner-detail-note">{placement.sourceNote}</p>}</div></aside>
  );
}

function MediaLogo({ placement }: { placement: PostbuyPlacement }) {
  if (placement.mediaLogoUrl) return <span className="warner-media-logo"><img src={placement.mediaLogoUrl} alt={`Logo de ${placement.mediaName}`} loading="lazy" /></span>;
  const initials = placement.mediaName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className="warner-media-logo is-fallback">{initials || "AM"}</span>;
}

function EditorialSummary({ index, label, value }: { index: string; label: string; value: string }) { return <div><span>{index}</span><p>{label}</p><strong>{value}</strong></div>; }
function Metric({ label, value, pending = false }: { label: string; value: string; pending?: boolean }) { return <div className={pending ? "is-pending" : ""}><dt>{label}</dt><dd>{value}</dd></div>; }
function movieKey(campaign: Campaign) { return campaign.campaignName.toLocaleLowerCase("es"); }
function movieTheme(campaign: Campaign) { return MOVIE_THEMES[movieKey(campaign)] ?? DEFAULT_THEME; }
function moviePoster(campaign: Campaign) { return POSTERS[movieKey(campaign)] ?? campaign.placements.find((placement) => placement.evidenceImageUrl)?.evidenceImageUrl ?? ""; }
function campaignImpacts(campaign: Campaign) { return campaign.placements.reduce((total, placement) => total + Number(placement.monthlyImpacts ?? 0), 0); }
function formatCompact(value: number | null) { if (value == null) return "—"; if (Math.abs(value) >= 1_000_000) return `${trim(value / 1_000_000)}M`; if (Math.abs(value) >= 1_000) return `${trim(value / 1_000)}K`; return formatNumber(value); }
function trim(value: number) { return value.toFixed(1).replace(/\.0$/, ""); }
function formatNumber(value: number) { return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(value); }
function formatPercent(value: number | null) { return value == null ? "—" : new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 2 }).format(value); }
function channelLabel(channel: PostbuyPlacement["channel"]) { return channel === "ooh" ? "Vía pública" : channel === "radio" ? "Radio" : "BTL"; }
