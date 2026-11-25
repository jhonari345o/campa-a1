"use client";

import { useEffect, useRef, useState } from "react";
import type { StackAdaptConnection } from "@/lib/ads/stackadapt";
import type { DeliveryCampaign, StackAdaptDashboard, StackAdaptBreakdowns } from "@/lib/ads/stackadapt-dashboard";
import { StackAdaptReport } from "./StackAdaptReport";
import styles from "./StackAdaptReport.module.css";

type ResponseData = { state?: "connected" | "unconfigured"; connection?: StackAdaptConnection; dashboard?: StackAdaptDashboard; breakdowns?: StackAdaptBreakdowns; error?: string };
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
async function query(params: URLSearchParams, signal: AbortSignal): Promise<ResponseData> {
  const response = await fetch(`/api/digital/dsp/stackadapt?${params}`, { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]) });
  const data: ResponseData = await response.json();
  if (!response.ok || data.error) throw new Error(data.error ?? "No se pudo consultar StackAdapt.");
  return data;
}
async function preparedQuery(params: URLSearchParams, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    const data = await query(params, signal);
    const processing = data.dashboard?.state === "processing" || data.breakdowns?.devices.state === "processing" || data.breakdowns?.regions.state === "processing";
    if (!processing || attempt === 2) return data;
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
      const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 1500 * (attempt + 1));
      signal.addEventListener("abort", abort, { once: true });
    });
  }
}
const message = (e: unknown) => e instanceof Error && e.name === "TimeoutError" ? "La consulta tardó demasiado. Vuelve a intentarlo." : e instanceof Error ? e.message : "No se pudo consultar StackAdapt.";

export function StackAdaptPanel() {
  const [connection, setConnection] = useState<StackAdaptConnection | null>(null);
  const [connectionState, setConnectionState] = useState("Verificando conexión…");
  const [connecting, setConnecting] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [advertiserId, setAdvertiserId] = useState(""), [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState<DeliveryCampaign[]>([]);
  const [report, setReport] = useState<StackAdaptDashboard | null>(null);
  const [breakdowns, setBreakdowns] = useState<StackAdaptBreakdowns | null>(null);
  const [breakdownBusy, setBreakdownBusy] = useState(false), [breakdownError, setBreakdownError] = useState("");
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`), [to, setTo] = useState(today);
  const generation = useRef(0), controller = useRef<AbortController | null>(null);
  function cancel() { generation.current++; controller.current?.abort(); setBusy(false); setBreakdownBusy(false); }
  function clearReport() { cancel(); setReport(null); setBreakdowns(null); setError(""); setBreakdownError(""); }
  async function verify() {
    cancel(); const run = generation.current;
    const abort = new AbortController(); controller.current = abort;
    setConnecting(true); setConnection(null); setReport(null); setBreakdowns(null); setCampaigns([]); setAdvertiserId(""); setCampaignId(""); setError(""); setConnectionState("Verificando conexión…");
    try {
      const data = await query(new URLSearchParams(), abort.signal);
      if (run !== generation.current) return;
      if (data.state === "unconfigured") { setConnectionState("Conexión pendiente de configuración"); return; }
      if (!data.connection) throw new Error("No se pudo verificar la conexión.");
      setConnection(data.connection); setConnectionState("Conectado · Solo consulta");
    } catch (e) { if (run === generation.current) { setError(message(e)); setConnectionState("No se pudo verificar"); } }
    finally { if (run === generation.current) setConnecting(false); }
  }
  useEffect(() => {
    const generationRef = generation, controllerRef = controller;
    void verify();
    return () => { generationRef.current++; controllerRef.current?.abort(); };
    // Verify once per mount. Explicit refreshes use the same cancellation gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function loadBreakdowns(id: string, campaign: string, run: number, signal: AbortSignal) {
    setBreakdownBusy(true); setBreakdownError(""); setBreakdowns(null);
    try {
      const params = new URLSearchParams({ mode: "breakdowns", advertiserId: id, from, to });
      if (campaign) params.set("campaignId", campaign);
      const data = await preparedQuery(params, signal);
      if (run !== generation.current) return;
      if (!data.breakdowns) throw new Error("No se pudieron cargar los desgloses.");
      setBreakdowns(data.breakdowns);
    } catch (e) { if (run === generation.current) setBreakdownError(message(e)); }
    finally { if (run === generation.current) setBreakdownBusy(false); }
  }
  async function load(id = advertiserId, campaign = campaignId) {
    clearReport(); if (!id || !from || !to) return;
    const run = generation.current, abort = new AbortController(); controller.current = abort;
    setBusy(true);
    void loadBreakdowns(id, campaign, run, abort.signal);
    try {
      const params = new URLSearchParams({ mode: "dashboard", advertiserId: id, from, to });
      if (campaign) params.set("campaignId", campaign);
      const data = await preparedQuery(params, abort.signal);
      if (run !== generation.current) return;
      if (!data.dashboard || !data.connection) throw new Error("No se pudo cargar el reporte.");
      setConnection(data.connection); setReport(data.dashboard);
      if (!campaign && data.dashboard.state === "ready") setCampaigns(data.dashboard.campaigns);
    } catch (e) { if (run === generation.current) setError(message(e)); }
    finally { if (run === generation.current) setBusy(false); }
  }
  const selected = connection?.advertisers.find(item => item.id === advertiserId);
  return <div className={styles.panel}>
    <section className={styles.connection} aria-label="Conexión StackAdapt"><div><strong>StackAdapt</strong><small>Campañas y reportes por anunciante</small></div><div className={styles.status}><span role="status">{connectionState}</span><button type="button" disabled={connecting} onClick={() => void verify()}>Verificar conexión</button></div></section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {connection && <>
      <form className={styles.filters} onSubmit={event => { event.preventDefault(); void load(); }}>
        <label>Anunciante<select value={advertiserId} onChange={event => { const id = event.target.value; clearReport(); setAdvertiserId(id); setCampaignId(""); setCampaigns([]); if (id) void load(id, ""); }}><option value="">Seleccionar anunciante</option>{connection.advertisers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Campaña<select value={campaignId} disabled={!selected} onChange={event => { const id = event.target.value; setCampaignId(id); void load(advertiserId, id); }}><option value="">Todas las campañas</option>{campaigns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Desde<input type="date" value={from} max={to || today()} required onChange={event => { clearReport(); setFrom(event.target.value); setCampaignId(""); setCampaigns([]); }}/></label>
        <label>Hasta<input type="date" value={to} min={from} max={today()} required onChange={event => { clearReport(); setTo(event.target.value); setCampaignId(""); setCampaigns([]); }}/></label>
        <button className={styles.primary} disabled={busy || !selected || !from || !to} type="submit">{busy ? "Cargando…" : "Actualizar reporte"}</button>
      </form>
      {!selected && <div className={styles.empty}><h3>Elige el anunciante para ver sus resultados</h3><p>Consulta inversión, alcance, evolución diaria y rendimiento de sus campañas.</p></div>}
      {busy && <div className={styles.loading} role="status">Preparando el reporte de {selected?.name}…</div>}
      {selected && report && <StackAdaptReport report={report} breakdowns={breakdowns} advertiserName={selected.name} currency={connection.currency} breakdownBusy={breakdownBusy} breakdownError={breakdownError} onRetryBreakdowns={() => { if (controller.current) void loadBreakdowns(advertiserId, campaignId, generation.current, controller.current.signal); }}/>}
      {selected && !busy && !report && !error && <p className={styles.notice}>Pulsa «Actualizar reporte» para consultar el período seleccionado.</p>}
    </>}
  </div>;
}
