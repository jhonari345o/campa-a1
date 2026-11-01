"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { metricDifference, metricValue, type CampaignLibrary, type LibraryDocument, type LibraryMetricValue } from "@/lib/campaign-library";

type View = "overview" | "plan" | "report" | "compare";
type Selection = { client: string; campaign: string; view: View };
const INITIAL: Selection = { client: "", campaign: "", view: "overview" };
const VIEWS: { id: View; label: string }[] = [{ id: "overview", label: "Resumen" }, { id: "report", label: "Ejecución y reportes" }, { id: "plan", label: "Plan de medios" }, { id: "compare", label: "Comparar" }];
const countLabel = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;
const STATUS = { planning: "Con plan", running: "En campaña", reported: "Con reportes" };

export function ClientCampaignLibrary({ library, workspaceName, brand = "one", available = true }: { library: CampaignLibrary; workspaceName: string; brand?: "one" | "lettera" | "ucsg"; available?: boolean }) {
  const [selection, setSelection] = useState<Selection>(INITIAL);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<"reported" | "planning">("reported");
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const read = () => {
      const p = new URLSearchParams(window.location.hash.slice(1));
      const view = p.get("view") as View;
      setSelection({ client: p.get("client") || "", campaign: p.get("campaign") || "", view: VIEWS.some(v => v.id === view) ? view : "overview" });
    };
    read(); window.addEventListener("popstate", read); window.addEventListener("hashchange", read);
    return () => { window.removeEventListener("popstate", read); window.removeEventListener("hashchange", read); };
  }, []);
  const client = library.clients.find(c => c.id === selection.client);
  const campaign = client && library.campaigns.find(c => c.id === selection.campaign && c.clientId === client.id);
  const campaigns = client ? library.campaigns.filter(c => c.clientId === client.id) : [];
  const documents = campaign ? library.documents.filter(d => d.campaignId === campaign.id) : [];
  const move = (next: Selection) => {
    setQuery(""); setCatalog("reported"); setSelection(next);
    const params = new URLSearchParams();
    if (next.client) params.set("client", next.client);
    if (next.campaign) { params.set("campaign", next.campaign); params.set("view", next.view); }
    window.history.pushState(null, "", window.location.pathname + window.location.search + (params.size ? "#" + params.toString() : ""));
    requestAnimationFrame(() => { title.current?.focus({ preventScroll: true }); title.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); });
  };
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const matches = (name: string) => normalize(name).includes(normalize(query));
  const films = client?.campaignKind === "film";
  const hasReport = (campaignId: string) => library.documents.some(d => d.campaignId === campaignId && d.kind === "report");
  const shownCampaigns = campaigns.filter(c => catalog === "reported" ? hasReport(c.id) : !hasReport(c.id));
  const latestReport = documents.find(d => d.kind === "report");
  return <section className="client-library">
    <nav className="library-breadcrumb" aria-label="Ruta de clientes">
      <button onClick={() => move(INITIAL)} aria-current={!client ? "page" : undefined}>Clientes</button>
      {client && <><span aria-hidden> / </span><button onClick={() => move({ client: client.id, campaign: "", view: "overview" })} aria-current={!campaign ? "page" : undefined}>{client.name}</button></>}
      {campaign && <><span aria-hidden> / </span><span aria-current="page">{campaign.name}</span></>}
    </nav>
    <header className={"library-hero " + (campaign ? "library-hero-film" : "")}>
      <div>
        <p className="library-kicker">{workspaceName} · {campaign ? "Campaña" : client ? films ? "Cine y entretenimiento" : "Campañas de medios" : "Espacio de trabajo"}</p>
        <h1 ref={title} tabIndex={-1}>{campaign?.name ?? client?.name ?? "Cada marca. Su historia."}</h1>
        <p className="library-description">{campaign?.summary ?? (client ? "Ejecución, respaldos y planes, reunidos por " + (films ? "película." : "campaña.") : "Consulta lo ejecutado por cliente y campaña, con sus reportes y planes de medios.")}</p>
        <div className="library-hero-bottom">
          <span>{campaign ? campaign.period : client ? countLabel(campaigns.length, films ? "película" : "campaña", films ? "películas" : "campañas") : library.clients.length + " clientes"}</span>
          {campaign ? <span className="library-pill">{STATUS[campaign.status]}</span> : <Link href="/planificador?view=planner">Crear un plan <span aria-hidden>↗</span></Link>}
        </div>
      </div>
      {campaign?.poster && /^\/postbuy\/warner\/posters\/[a-z0-9-]+\.jpg$/.test(campaign.poster) && <img src={campaign.poster} alt="" className="library-hero-poster" />}
      {!campaign && <div className="library-brand-art" aria-hidden>{brand === "lettera" ? <><img src="/partners/lettera/lettera-logo.png" alt="" /><i>Write your story.</i></> : <strong>Ad Mavericks One</strong>}</div>}
    </header>

    {!available ? <div className="library-empty"><h2>No pudimos cargar tus clientes.</h2><p>Vuelve a intentarlo en unos momentos.</p><button className="btn btn-secondary" onClick={() => window.location.reload()}>Volver a cargar</button></div> :
    !client ? <>
      <div className="library-section-heading"><div><p className="library-kicker">Tu portafolio</p><h2>Clientes</h2></div><label className="library-search"><span>Buscar cliente</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre del cliente" /></label></div>
      <div className="library-client-grid">{library.clients.filter(c => matches(c.name)).map((c, index) => {
        const count = library.campaigns.filter(item => item.clientId === c.id).length;
        return <button key={c.id} className="library-client-card" onClick={() => move({ client: c.id, campaign: "", view: "overview" })}>
          <span className="library-card-index">{String(index + 1).padStart(2, "0")} <span aria-hidden>↗</span></span>
          <span className="library-client-monogram" aria-hidden>{c.name === "Warner Bros." ? "WB" : c.name.split(" ").slice(0, 2).map(w => w[0]).join("")}</span>
          <strong>{c.name}</strong><small>{c.category}</small><span className="library-card-foot">{countLabel(count, c.campaignKind === "film" ? "película" : "campaña", c.campaignKind === "film" ? "películas" : "campañas")}</span>
        </button>;
      })}</div>
      {library.clients.filter(c => matches(c.name)).length === 0 && <p className="library-empty">{query ? "No encontramos ese cliente." : "Aquí aparecerán los clientes de tu espacio."}</p>}
    </> : !campaign ? <>
      <div className="library-section-heading"><div><p className="library-kicker">{client.name}</p><h2>{films ? "Películas" : "Campañas"}</h2></div><label className="library-search"><span>Buscar {films ? "película" : "campaña"}</span><input type="search" placeholder={films ? "Título de la película" : "Nombre de campaña"} value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      <nav className="library-tabs" aria-label="Tipo de campaña"><button aria-pressed={catalog === "reported"} onClick={() => setCatalog("reported")}>Con ejecución reportada ({campaigns.filter(c => hasReport(c.id)).length})</button><button aria-pressed={catalog === "planning"} onClick={() => setCatalog("planning")}>Solo planificación ({campaigns.filter(c => !hasReport(c.id)).length})</button></nav>
      <div className="library-campaign-grid">{shownCampaigns.filter(c => matches(c.name)).map(c => <button className="library-campaign-card" key={c.id} onClick={() => move({ client: client.id, campaign: c.id, view: "overview" })}>
        <span className="library-poster">{c.poster && /^\/postbuy\/warner\/posters\/[a-z0-9-]+\.jpg$/.test(c.poster) ? <img src={c.poster} alt="" loading="lazy" /> : <span aria-hidden>{c.name.slice(0, 1)}</span>}<span className="library-poster-status">{STATUS[c.status]}</span></span>
        <span className="library-campaign-copy"><small>{c.period}</small><strong>{c.name}</strong><span>{countLabel(library.documents.filter(d => d.campaignId === c.id && d.kind === "plan").length, "plan", "planes")} · {countLabel(library.documents.filter(d => d.campaignId === c.id && d.kind === "report").length, "reporte", "reportes")} <b aria-hidden>↗</b></span></span>
      </button>)}</div>
      {shownCampaigns.filter(c => matches(c.name)).length === 0 && <p className="library-empty">{query ? "No encontramos resultados." : catalog === "reported" ? "Todavía no hay ejecución reportada para este cliente." : "No hay campañas de solo planificación."}</p>}
    </> : <>
      <nav className="library-tabs" aria-label="Contenido de la campaña">{VIEWS.map(v => <button key={v.id} aria-pressed={selection.view === v.id} onClick={() => move({ ...selection, view: v.id })}>{v.label}</button>)}</nav>
      {selection.view === "overview" && <><section className="library-execution-summary"><p className="library-kicker">Ejecución reportada</p><h2>{latestReport?.title ?? "Sin reporte de ejecución"}</h2><p>{latestReport?.summary ?? "Esta campaña dispone de planificación. La ejecución aparecerá cuando exista un reporte."}</p>{latestReport && <button className="btn btn-secondary" onClick={() => move({ ...selection, view: "report" })}>Consultar ejecución →</button>}</section><div className="library-overview">
        {([{ kind: "report", title: "Ejecución y reportes", body: "Medios, ubicaciones y entregas registradas." }, { kind: "plan", title: "Plan de medios", body: "Propuesta y versiones originales para comparar con la ejecución." }] as const).map(item => <button key={item.kind} onClick={() => move({ ...selection, view: item.kind })}><span className="library-kicker">{countLabel(documents.filter(d => d.kind === item.kind).length, "documento", "documentos")}</span><h2>{item.title}</h2><p>{item.body}</p><strong>Abrir <span aria-hidden>↗</span></strong></button>)}
        <button className="library-compare-entry" onClick={() => move({ ...selection, view: "compare" })}><span className="library-kicker">Plan y resultados</span><h2>La campaña, lado a lado.</h2><p>Consulta la planificación y lo reportado en una misma vista.</p><strong>Comparar <span aria-hidden>↗</span></strong></button>
      </div></>}
      {(selection.view === "plan" || selection.view === "report") && <DocumentViewer key={campaign.id + selection.view} documents={documents.filter(d => d.kind === selection.view)} kind={selection.view} />}
      {selection.view === "compare" && <Comparison key={campaign.id} documents={documents} library={library} campaignId={campaign.id} />}
    </>}
  </section>;
}

function DocumentViewer({ documents, kind }: { documents: LibraryDocument[]; kind: "plan" | "report" }) {
  const [id, setId] = useState(documents[0]?.id ?? "");
  const active = documents.find(d => d.id === id) ?? documents[0];
  if (!active) return <p className="library-empty">Aún no hay {kind === "plan" ? "un plan" : "un reporte"} disponible para esta campaña.</p>;
  return <article className="library-document">
    <header><div><p className="library-kicker">{kind === "plan" ? "Plan de medios" : "Reporte de medios"} · {active.issuedOn ? date(active.issuedOn) : active.version}</p><h2>{active.title}</h2></div><label>Versión<select value={active.id} onChange={e => setId(e.target.value)}>{documents.map(d => <option key={d.id} value={d.id}>{d.version}{d.issuedOn ? " · " + date(d.issuedOn) : ""}</option>)}</select></label></header>
    {active.summary && <p className="library-document-summary">{active.summary}</p>}
    {active.sections.map((section, i) => <section key={i} className="library-document-section"><h3>{section.title}</h3><div className="library-table-scroll" tabIndex={0} role="region" aria-label={section.title}><table><thead><tr>{section.columns.map((c, j) => <th key={j} scope="col">{c}</th>)}</tr></thead><tbody>{section.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody></table></div></section>)}
    {active.downloadable && <a className="btn btn-secondary" href={"/api/library/documents/" + active.id}>Descargar documento ↓</a>}
  </article>;
}

function Comparison({ documents, library, campaignId }: { documents: LibraryDocument[]; library: CampaignLibrary; campaignId: string }) {
  const plans = documents.filter(d => d.kind === "plan"), reports = documents.filter(d => d.kind === "report");
  const [planId, setPlan] = useState(plans[0]?.id ?? ""), [reportId, setReport] = useState(reports[0]?.id ?? "");
  const metrics = library.metrics.filter(m => m.campaignId === campaignId && m.planDocumentId === (planId || null) && m.reportDocumentId === (reportId || null));
  return <section className="library-comparison"><div className="library-comparison-selectors">
    <label>Plan de medios<select value={planId} onChange={e => setPlan(e.target.value)}>{plans.length ? plans.map(d => <option value={d.id} key={d.id}>{d.title} · {d.version}</option>) : <option value="">Sin plan disponible</option>}</select></label>
    <label>Reporte de medios<select value={reportId} onChange={e => setReport(e.target.value)}>{reports.length ? reports.map(d => <option value={d.id} key={d.id}>{d.title} · {d.version}</option>) : <option value="">Sin reporte disponible</option>}</select></label>
    </div>
    <h2>Ejecución frente al plan</h2>
    {metrics.length ? <div className="library-table-scroll" tabIndex={0} role="region" aria-label="Comparación de medios"><table><thead><tr><th scope="col">Indicador</th><th scope="col">Ejecución reportada</th><th scope="col">Plan original</th><th scope="col">Diferencia</th></tr></thead><tbody>{metrics.map(m => {
      const difference = metricDifference(m);
      return <tr key={m.id}><th scope="row">{m.label}</th><td><strong>{metricValue(m.reported?.value, m.unit)}</strong><MetricBasis value={m.reported} /></td><td><strong>{metricValue(m.planned?.value, m.unit)}</strong><MetricBasis value={m.planned} /></td><td>{difference === null ? <span>—</span> : <strong>{difference > 0 ? "+" : ""}{metricValue(difference, m.unit)}</strong>}</td></tr>;
    })}</tbody></table><p className="library-comparison-key">Diferencia: reporte menos plan, para el mismo período, cobertura y base. — Dato no disponible o bases distintas.</p></div> : <p className="library-empty">Esta combinación todavía no tiene indicadores comparables. Puedes consultar los documentos en sus pestañas.</p>}
  </section>;
}
function MetricBasis({ value }: { value: LibraryMetricValue | null }) { return value ? <small className="library-metric-basis">{value.estimated ? "Estimado · " : ""}{value.period}<br />{value.scope}</small> : null; }
function date(value: string) { return new Date(value + "T12:00:00Z").toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); }

