"use client";

import { useRef, useState } from "react";
import type { StackAdaptCampaignPage, StackAdaptConnection, StackAdaptReport } from "@/lib/ads/stackadapt";

type ResponseData = { state?: "connected" | "unconfigured"; connection?: StackAdaptConnection; page?: StackAdaptCampaignPage; report?: StackAdaptReport; error?: string };
const box = "rounded-2xl border border-border bg-white p-5 md:p-6";
const button = "rounded-xl bg-forest px-5 py-3 text-sm font-bold text-white disabled:opacity-50";
const input = "mt-2 w-full rounded-xl border border-border bg-white px-3 py-3 text-sm";
const states: Record<string, string> = { LIVE: "En entrega", PAUSED: "Pausada", DRAFT: "Borrador", PENDING: "En revisión", APPROVED: "Aprobada", ENDED: "Finalizada", ERROR: "Error", REJECTED: "Rechazada" };
const number = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 }).format(value);
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

export function StackAdaptPanel() {
  const [state, setState] = useState<"unchecked" | "unconfigured" | "connected" | "error">("unchecked");
  const [connection, setConnection] = useState<StackAdaptConnection | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [advertiserId, setAdvertiserId] = useState("");
  const [campaigns, setCampaigns] = useState<StackAdaptCampaignPage | null>(null);
  const [report, setReport] = useState<StackAdaptReport | null>(null);
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`), [to, setTo] = useState(today);
  const requestGeneration = useRef(0);

  async function query(params: URLSearchParams): Promise<ResponseData> {
    const response = await fetch(`/api/digital/dsp/stackadapt?${params}`, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
    const data: ResponseData = await response.json();
    if (!response.ok || data.error) throw new Error(data.error ?? "No se pudo consultar StackAdapt.");
    return data;
  }
  async function verify() {
    const generation = ++requestGeneration.current;
    setBusy(true); setError(""); setConnection(null); setCampaigns(null); setReport(null); setAdvertiserId(""); setState("unchecked");
    try {
      const data = await query(new URLSearchParams());
      if (requestGeneration.current !== generation) return;
      if (data.state === "unconfigured") { setState("unconfigured"); return; }
      if (!data.connection) throw new Error("StackAdapt no devolvió una conexión válida.");
      setConnection(data.connection); setState("connected");
      if (data.connection.advertisers.length === 1) setAdvertiserId(data.connection.advertisers[0].id);
    } catch (e) { if (requestGeneration.current === generation) { setState("error"); setError(e instanceof Error ? e.message : "No se pudo verificar la conexión."); } }
    finally { if (requestGeneration.current === generation) setBusy(false); }
  }
  async function load(mode: "campaigns" | "report", after?: string) {
    const generation = ++requestGeneration.current;
    setBusy(true); setError("");
    if (mode === "report") setReport(null);
    else if (!after) setCampaigns(null);
    try {
      const params = new URLSearchParams({ mode, advertiserId });
      if (after) params.set("after", after);
      if (mode === "report") { params.set("from", from); params.set("to", to); }
      const data = await query(params);
      if (requestGeneration.current !== generation) return;
      if (data.state === "unconfigured") { setState("unconfigured"); setConnection(null); setCampaigns(null); setReport(null); return; }
      if (!data.connection) throw new Error("StackAdapt no devolvió una conexión válida.");
      setConnection(data.connection);
      if (data.page) setCampaigns(previous => ({ ...data.page!, campaigns: after && previous ? [...new Map([...previous.campaigns, ...data.page!.campaigns].map(item => [item.id, item])).values()] : data.page!.campaigns }));
      if (data.report) setReport(data.report);
    } catch (e) {
      if (requestGeneration.current === generation) { setState("error"); setConnection(null); setCampaigns(null); setReport(null); setError(e instanceof Error ? e.message : "No se pudo completar la consulta."); }
    } finally { if (requestGeneration.current === generation) setBusy(false); }
  }
  const selected = connection?.advertisers.find(item => item.id === advertiserId);
  return <div className="space-y-5 pb-10">
    <section className={box} aria-labelledby="dsp-connection-title">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-xs font-black uppercase tracking-widest text-muted">Conexión DSP</p><h2 id="dsp-connection-title" className="mt-2 text-2xl font-black">StackAdapt</h2><p className="mt-2 text-sm text-muted">Anunciantes, campañas y resultados de tu cuenta.</p></div>
        <span className={`rounded-full px-4 py-2 text-xs font-bold ${state === "connected" ? "bg-signal/10 text-signal-dark" : "bg-fog text-forest"}`} role="status">{busy ? "Consultando…" : state === "connected" ? "Conectado · consulta" : state === "unconfigured" ? "Pendiente de credencial" : state === "error" ? "Conexión sin verificar" : "Pendiente de verificación"}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4"><button className={button} disabled={busy} onClick={verify}>{connection ? "Verificar de nuevo" : "Verificar conexión"}</button><a href="https://www.stackadapt.com/" target="_blank" rel="noreferrer" className="text-sm font-bold text-signal-dark">Abrir StackAdapt ↗</a></div>
      {connection && <p className="mt-4 text-xs text-muted">Cuenta {connection.accountId} · {connection.currency} · Verificada el {new Date(connection.checkedAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}{connection.expiresAt ? ` · Llave vigente hasta ${new Date(connection.expiresAt).toLocaleDateString("es-EC")}` : ""}</p>}
      {state === "unconfigured" && <div className="mt-5 rounded-xl bg-fog p-4 text-sm"><h3 className="font-bold">Completar el acceso API</h3><p className="mt-2">Un propietario o administrador de StackAdapt debe emitir una llave GraphQL con acceso a los anunciantes que se operarán desde One.</p><p className="mt-2">Configura la llave y el identificador de cuenta en el entorno privado del servidor y vuelve a verificar la conexión.</p><a href="https://support.stackadapt.com/hc/en-us/articles/32798717073175-Managing-API-Keys" target="_blank" rel="noreferrer" className="mt-3 inline-block font-bold text-signal-dark">Administrar llaves en StackAdapt ↗</a></div>}
      {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
    </section>

    {connection && <>
      <section className={box}>
        <h2 className="text-lg font-black">Anunciante</h2>
        {connection.advertisers.length ? <><label className="mt-4 block max-w-xl text-sm font-bold">Cuenta de campaña<select className={input} value={advertiserId} disabled={busy} onChange={event => { requestGeneration.current++; setAdvertiserId(event.target.value); setCampaigns(null); setReport(null); setError(""); }}><option value="">Seleccionar anunciante</option>{connection.advertisers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{selected && <p className="mt-3 text-xs text-muted">Permisos de la llave: {selected.canWrite ? "lectura y escritura" : "lectura"}. Este módulo consulta campañas y resultados.</p>}</> : <p className="mt-3 text-sm text-muted">La llave es válida, pero no tiene acceso de lectura a anunciantes no archivados.</p>}
      </section>
      {selected && <>
        <section className={box}>
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-black">Campañas</h2><p className="mt-1 text-sm text-muted">Campañas no archivadas de {selected.name}.</p></div><button className={button} disabled={busy} onClick={() => load("campaigns")}>Consultar campañas</button></div>
          {campaigns && <><p className="mt-4 text-xs text-muted">{campaigns.campaigns.length} de {campaigns.total} campañas</p>{campaigns.campaigns.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="py-3 pr-5">Campaña</th><th className="px-3 py-3">Formato</th><th className="px-3 py-3">Estado</th></tr></thead><tbody>{campaigns.campaigns.map(campaign => <tr key={campaign.id} className="border-b border-border"><td className="py-4 pr-5"><strong>{campaign.name}</strong><span className="mt-1 block text-xs text-muted">{campaign.id}</span></td><td className="px-3 py-4">{campaign.channel}</td><td className="px-3 py-4" title={campaign.status}>{states[campaign.state] ?? campaign.state}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-muted">StackAdapt no devolvió campañas para este anunciante.</p>}{campaigns.nextCursor && <button className={`${button} mt-4`} disabled={busy} onClick={() => load("campaigns", campaigns.nextCursor!)}>Cargar más campañas</button>}</>}
        </section>
        <section className={box}>
          <h2 className="text-lg font-black">Resultados del anunciante</h2><p className="mt-1 text-sm text-muted">Todas sus campañas, incluidas las archivadas, en el período seleccionado.</p>
          <div className="mt-4 flex flex-wrap items-end gap-4"><label className="text-sm font-bold">Desde<input className={input} type="date" value={from} max={to || today()} disabled={busy} onChange={event => { setFrom(event.target.value); setReport(null); }}/></label><label className="text-sm font-bold">Hasta<input className={input} type="date" value={to} min={from} max={today()} disabled={busy} onChange={event => { setTo(event.target.value); setReport(null); }}/></label><button className={button} disabled={busy || !from || !to} onClick={() => load("report")}>Consultar resultados</button></div>
          {report?.state === "processing" && <p className="mt-5 text-sm text-muted" role="status">StackAdapt está preparando el reporte. Consulta los resultados nuevamente en unos segundos.</p>}
          {report?.state === "ready" && (report.metrics ? <><p className="mt-5 text-xs text-muted">Período: {report.from} a {report.to} · Moneda: {connection.currency}</p><dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
            ["Inversión", report.metrics.cost == null ? "—" : `${connection.currency} ${number(report.metrics.cost)}`],
            ["Impresiones", number(report.metrics.impressions)], ["Clics", number(report.metrics.clicks)], ["Conversiones", number(report.metrics.conversions)], ["Videos completos", number(report.metrics.videoCompletions)],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-fog p-4"><dt className="text-xs font-bold text-muted">{label}</dt><dd className="mt-2 text-xl font-black">{value}</dd></div>)}</dl></> : <p className="mt-5 text-sm text-muted">StackAdapt no devolvió métricas para este período.</p>)}
        </section>
      </>}
    </>}
  </div>;
}
