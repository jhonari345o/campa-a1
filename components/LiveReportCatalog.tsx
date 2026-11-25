/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { LiveReportFrame } from "./LiveReportFrame";
import { liveReportHref, reportPeriodLabel, resolveLiveReportSelection, type LiveReport, type LiveReportSelection } from "@/lib/live-reports";
import styles from "./LiveReports.module.css";

export function LiveReportCatalog({ reports, selection = {}, base = "/reportes" }: { reports: LiveReport[]; selection?: LiveReportSelection; base?: string }) {
  const state = resolveLiveReportSelection(reports, selection);
  const { client, channel, report } = state;
  if (!reports.length && !selection.client && !selection.channel && !selection.report) return null;
  const clients = [...new Map(reports.map(r => [r.client_key, r])).values()].sort((a, b) => a.client_name.localeCompare(b.client_name, "es"));
  const channels = [...new Map(state.clientReports.map(r => [r.channel_key, r])).values()];
  return <section className={styles.catalog}>
    <nav className={styles.breadcrumb} aria-label="Ruta de reportes">
      <Link prefetch={true} href={liveReportHref(base, {})}>Reportes</Link>
      {client && <><span aria-hidden>/</span><Link prefetch={true} href={liveReportHref(base, { client: client.client_key })}>{client.client_name}</Link></>}
      {channel && <><span aria-hidden>/</span><Link prefetch={true} href={liveReportHref(base, { client: client.client_key, channel: channel.channel_key })}>{channel.channel_name}</Link></>}
      {report && <><span aria-hidden>/</span><span aria-current="page">{reportPeriodLabel(report.period)}</span></>}
    </nav>
    {state.invalid ? <div className={styles.empty}><h1>Reporte no disponible</h1><p>Elige uno de los reportes disponibles para tu cuenta.</p><Link prefetch={true} href={liveReportHref(base, {})}>Volver a Reportes →</Link></div> : <>
      <header className={styles.heading}><div><p>{client ? client.client_name : "Resultados por cliente"}</p><h1>{report ? `${channel.channel_name} · ${reportPeriodLabel(report.period)}` : channel ? channel.channel_name : client ? client.client_name : "Reportes conectados"}</h1><span>{report ? report.title : channel ? "Selecciona el período que quieres consultar." : client ? "Elige el medio para ver sus resultados." : "Cada cliente, sus campañas y sus resultados."}</span></div>{client?.client_logo && <img className={styles.headerLogo} src={client.client_logo} alt={client.client_name} width={180} height={58} />}</header>
      {!client ? <div className={styles.grid}>{clients.map(c => <Link prefetch={true} key={c.client_key} className={styles.card} href={liveReportHref(base, { client: c.client_key })}>
        <div className={styles.logo}>{c.client_logo ? <img src={c.client_logo} alt={`Logo de ${c.client_name}`} width={180} height={64} /> : <span>{c.client_name.slice(0, 2)}</span>}</div>
        <h2>{c.client_name}</h2><p>{reports.filter(r => r.client_key === c.client_key).length} reporte{reports.filter(r => r.client_key === c.client_key).length === 1 ? "" : "s"}</p><strong>Ver medios <span aria-hidden>→</span></strong>
      </Link>)}</div> : !channel ? <div className={styles.grid}>{channels.map(c => <Link prefetch={true} key={c.channel_key} className={styles.card} href={liveReportHref(base, { client: client.client_key, channel: c.channel_key })}>
        <span className={styles.icon} aria-hidden>▥</span><h2>{c.channel_name}</h2><p>Resultados de campaña por período</p><strong>Ver períodos <span aria-hidden>→</span></strong>
      </Link>)}</div> : !report ? <div className={styles.grid}>{state.channelReports.map(r => <Link prefetch={true} key={r.id} className={styles.card} href={liveReportHref(base, { client: client.client_key, channel: channel.channel_key, report: r.id })}>
        <span className={styles.period}>REPORTE DE CAMPAÑA</span><h2>{reportPeriodLabel(r.period)}</h2><p>{r.title}</p><strong>Abrir reporte <span aria-hidden>→</span></strong>
      </Link>)}</div> : <LiveReportFrame url={report.embed_url} title={`${report.client_name} · ${report.channel_name} · ${reportPeriodLabel(report.period)}`} />}
    </>}
  </section>;
}
