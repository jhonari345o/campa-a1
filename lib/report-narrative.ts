export function buildReportNarrative(input: {
  jobs: Array<{ platform: string; status: string; spec: { presupuesto_usd?: number; metrics?: { impresiones?: number; alcance?: number; clics?: number; gasto_usd?: number } | null } | null }>;
  orderCount: number;
}) {
  const measured = input.jobs.filter((job) => Number(job.spec?.metrics?.impresiones ?? 0) > 0);
  if (!input.jobs.length) return { headline: `${input.orderCount} orden${input.orderCount === 1 ? "" : "es"} en preparación`, summary: "Todavía no hay campañas con entrega conectada. La siguiente señal útil será la primera sincronización de la plataforma.", actions: ["Confirmar disponibilidad y aprobaciones de las órdenes.", "No presentar proyecciones como resultados reales."] };
  if (!measured.length) return { headline: "Campañas creadas, medición pendiente", summary: `Hay ${input.jobs.length} campaña${input.jobs.length === 1 ? "" : "s"}, pero ninguna ha entregado impresiones sincronizadas todavía.`, actions: ["Verificar publicación y estado del conector.", "Esperar una ventana mínima comparable antes de redistribuir presupuesto."] };
  const ranked = measured.map((job) => { const m = job.spec?.metrics; const impressions = Number(m?.impresiones ?? 0); const clicks = Number(m?.clics ?? 0); const spend = Number(m?.gasto_usd ?? 0); return { platform: job.platform, ctr: impressions ? clicks / impressions : 0, spend, budget: Number(job.spec?.presupuesto_usd ?? 0) }; }).sort((a, b) => b.ctr - a.ctr);
  const best = ranked[0]!;
  const overspend = ranked.find((item) => item.budget > 0 && item.spend > item.budget);
  return {
    headline: `${platformLabel(best.platform)} lidera la señal de respuesta`,
    summary: `Entre las campañas con datos, ${platformLabel(best.platform)} registra el CTR observado más alto (${(best.ctr * 100).toFixed(2)}%). Es una lectura de plataforma, no una comparación causal ni deduplicada.`,
    actions: [overspend ? `Revisar ${platformLabel(overspend.platform)}: el gasto reportado supera el presupuesto registrado.` : "Mantener límites y revisar tendencia antes de escalar.", measured.length < input.jobs.length ? `${input.jobs.length - measured.length} campaña(s) todavía no tienen métricas sincronizadas.` : "Todas las campañas visibles tienen alguna señal de entrega."],
  };
}

function platformLabel(platform: string) { return ({ meta: "Meta", instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", tiktok: "TikTok", google: "Google" } as Record<string, string>)[platform] ?? platform; }
