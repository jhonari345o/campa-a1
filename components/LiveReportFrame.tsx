"use client";
import { useState } from "react";
import { lookerEmbedUrl, lookerViewUrl } from "@/lib/live-reports";
import styles from "./LiveReports.module.css";

export function LiveReportFrame({ url, title }: { url: string; title: string }) {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const embed = lookerEmbedUrl(url), view = lookerViewUrl(url);
  if (!embed || !view) return null;
  return <section className={styles.viewer} aria-label={title}>
    <div className={styles.viewerToolbar}><p><span className={styles.liveDot} /> Reporte conectado a Looker Studio</p><div>
      <button type="button" onClick={() => { setLoading(true); setVersion(v => v + 1); }}>Recargar reporte ↻</button>
      <a href={view} target="_blank" rel="noopener noreferrer">Abrir en otra pestaña ↗</a>
    </div></div>
    <p className={styles.viewerNote}>Se actualiza con el informe original. Si Google solicita ingreso, utiliza la cuenta que tiene acceso al reporte.</p>
    {loading && <p className={styles.loading} role="status">Cargando reporte…</p>}
    <iframe key={version} className={styles.frame} src={embed} title={title} allowFullScreen
      sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoading(false)} />
  </section>;
}
