"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { PlanApproval, PlanComment, SavedMediaPlan, SavedPlanVersion } from "@/lib/media-workspace";
import { comentarPlan, decidirPlan } from "./workspace-actions";

export function PlanVersions({ plan, versions, comments, approvals }: { plan: SavedMediaPlan | null; versions: SavedPlanVersion[]; comments: PlanComment[]; approvals: PlanApproval[] }) {
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [decisionNote, setDecisionNote] = useState("");
  const comparison = useMemo(() => compareVersions(versions[0], versions[1]), [versions]);

  if (!plan) return <section className="rounded-panel border border-border bg-white p-8 shadow-panel"><h1 className="text-2xl font-black">Plan no encontrado</h1><p className="mt-2 text-sm text-muted">El plan no existe o no pertenece a tu cuenta.</p><Link href="/planificador?view=plans" className="btn btn-primary mt-5">Volver a mis planes</Link></section>;
  const continueHref = `/planificador?view=${plan.mode === "manual" ? "diy" : "planner"}&plan=${plan.id}`;

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-border bg-white p-6 shadow-panel sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-signal-dark">Trazabilidad privada</p><h1 className="mt-2 text-3xl font-black">{plan.name}</h1><p className="mt-2 text-sm text-muted">Cada guardado conserva una instantánea para revisión y auditoría.</p></div><Link href={continueHref} className="btn btn-primary">Abrir versión actual →</Link></div>
        {comparison.length > 0 && <div className="mt-6 rounded-card border border-sky/30 bg-sky/10 p-4"><strong className="text-sm">Últimos cambios detectados</strong><ul className="mt-2 grid gap-1 text-sm text-muted sm:grid-cols-2">{comparison.map((item) => <li key={item}>• {item}</li>)}</ul></div>}
      </section>
      <section className="rounded-panel border border-border bg-white p-6 shadow-panel">
        <h2 className="text-xl font-black">Versiones ({versions.length})</h2>
        {versions.length === 0 ? <p className="mt-4 text-sm text-muted">Este plan todavía no tiene instantáneas disponibles.</p> : <ol className="mt-5 grid gap-3">{versions.map((version) => {
          const snapshot = version.snapshot;
          const brief = objectValue(snapshot.brief);
          const media = Array.isArray(brief.selectedMedia) ? brief.selectedMedia.length : 0;
          return <li key={version.id} className="rounded-card border border-border bg-fog p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>Versión {version.version}</strong><span className="ml-2 rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-muted">{String(snapshot.status ?? "borrador")}</span></div><time className="text-xs text-muted">{formatDate(version.created_at)}</time></div><dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><Metric label="Etapa" value={String(snapshot.stage ?? "brief")} /><Metric label="Progreso" value={`${Number(snapshot.progress ?? 0)}%`} /><Metric label="Presupuesto" value={money(Number(brief.budgetUsd ?? brief.budget ?? 0))} /><Metric label="Medios" value={media ? String(media) : "Por definir"} /></dl></li>;
        })}</ol>}
      </section>
      <section className="rounded-panel border border-border bg-white p-6 shadow-panel">
        <h2 className="text-xl font-black">Nota de revisión</h2><p className="mt-1 text-sm text-muted">Deja decisiones, solicitudes o validaciones pendientes ligadas al plan.</p>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={2000} className="mt-4 w-full rounded-xl border border-border bg-fog p-4 text-sm" placeholder="Ej. Validar disponibilidad de vallas antes de aprobar la orden." />
        <button type="button" disabled={pending || !comment.trim()} onClick={() => startTransition(async () => { const result = await comentarPlan(plan.id, comment); setMessage({ ok: result.ok, text: result.ok ? result.message : result.error }); if (result.ok) setComment(""); })} className="btn btn-primary mt-3 disabled:opacity-50">{pending ? "Guardando…" : "Registrar comentario"}</button>
        {message && <p className={`mt-3 text-sm font-bold ${message.ok ? "text-forest" : "text-[#a13b31]"}`}>{message.text}</p>}
      </section>
      <section className="rounded-panel border border-border bg-white p-6 shadow-panel"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide text-signal-dark">Sala de aprobación</p><h2 className="mt-1 text-xl font-black">Una decisión, registrada contra una versión</h2><p className="mt-1 text-sm text-muted">Aprobar no compra medios ni activa gasto; habilita la coordinación comercial.</p></div><span className="rounded-full bg-fog px-3 py-1 text-xs font-black text-forest">Estado: {plan.status}</span></div><textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} rows={3} maxLength={2000} className="mt-4 w-full rounded-xl border border-border bg-fog p-4 text-sm" placeholder="Condiciones de aprobación o cambios requeridos." /><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await decidirPlan(plan.id, "approved", decisionNote); setMessage({ ok: result.ok, text: result.ok ? result.message : result.error }); if (result.ok) setDecisionNote(""); })} className="btn btn-primary disabled:opacity-50">Aprobar versión {plan.version}</button><button type="button" disabled={pending || !decisionNote.trim()} onClick={() => startTransition(async () => { const result = await decidirPlan(plan.id, "changes_requested", decisionNote); setMessage({ ok: result.ok, text: result.ok ? result.message : result.error }); if (result.ok) setDecisionNote(""); })} className="btn btn-secondary disabled:opacity-50">Solicitar cambios</button></div>{(approvals.length > 0 || comments.length > 0) && <ol className="mt-6 space-y-3 border-l-2 border-signal/30 pl-5">{[...approvals.map((item) => ({ id: item.id, date: item.createdAt, title: item.decision === "approved" ? `Versión ${item.planVersion} aprobada` : `Cambios solicitados a v${item.planVersion}`, body: item.note ?? "Sin nota adicional", tone: item.decision === "approved" ? "text-signal-dark" : "text-[#9a6a00]" })), ...comments.map((item) => ({ id: item.id, date: item.createdAt, title: "Comentario", body: item.body, tone: "text-forest" }))].sort((a, b) => b.date.localeCompare(a.date)).map((item) => <li key={item.id} className="relative rounded-xl border border-border bg-fog p-4 before:absolute before:-left-[27px] before:top-5 before:size-3 before:rounded-full before:bg-signal"><div className="flex flex-wrap justify-between gap-2"><strong className={`text-sm ${item.tone}`}>{item.title}</strong><time className="text-[10px] text-muted">{formatDate(item.date)}</time></div><p className="mt-1 text-xs text-muted">{item.body}</p></li>)}</ol>}</section>
    </div>
  );
}

function compareVersions(latest?: SavedPlanVersion, previous?: SavedPlanVersion) {
  if (!latest || !previous) return [];
  const current = objectValue(latest.snapshot.brief);
  const before = objectValue(previous.snapshot.brief);
  const changes: string[] = [];
  if (Number(current.budgetUsd ?? current.budget ?? 0) !== Number(before.budgetUsd ?? before.budget ?? 0)) changes.push(`Presupuesto: ${money(Number(before.budgetUsd ?? before.budget ?? 0))} → ${money(Number(current.budgetUsd ?? current.budget ?? 0))}`);
  if (String(current.geography ?? "") !== String(before.geography ?? "")) changes.push("Cambió la cobertura geográfica");
  if (JSON.stringify(current.selectedMedia ?? []) !== JSON.stringify(before.selectedMedia ?? [])) changes.push("Cambió la combinación de medios");
  if (String(latest.snapshot.stage ?? "") !== String(previous.snapshot.stage ?? "")) changes.push(`Etapa: ${String(previous.snapshot.stage ?? "")} → ${String(latest.snapshot.stage ?? "")}`);
  return changes;
}

function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function Metric({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted">{label}</dt><dd className="mt-1 font-black capitalize text-forest">{value}</dd></div>; }
function money(value: number) { return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0); }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
