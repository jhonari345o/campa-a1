import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { digitalBriefEditable, parseDigitalCampaignBrief } from "@/lib/digital-campaign-brief";
import { formatBudgetInput } from "@/lib/brief-inputs";
import { DigitalCampaignForm } from "./DigitalCampaignForm";
export const metadata = { title: "Mi campaña digital" };
export default async function DigitalCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f\d-]{36}$/i.test(id)) notFound();
  const profile = await getSessionProfile(); if (!profile) redirect("/ingresar");
  const db = await createClient(), { data: order, error } = await db.from("catalog_orders").select("id,title,status,total_cents,items,digital_brief,digital_brief_version").eq("id", id).maybeSingle();
  if (error || !order) notFound();
  const rows = (Array.isArray(order.items) ? order.items : []).filter((item: { kind?: string }) => item.kind === "digital") as Array<{ provider: string; name: string; format: string; quantity: number; unitPriceCents: number | null }>;
  if (!rows.length) notFound();
  const allowed = digitalBriefEditable(order.status, order.total_cents == null ? null : Number(order.total_cents));
  const canEdit = profile.is_platform_admin || ["admin", "planner"].includes(profile.workspace?.role ?? "");
  let initial = {}; try { initial = parseDigitalCampaignBrief(order.digital_brief ?? {}); } catch { /* An invalid saved configuration cannot grant permissions or supply budget. */ }
  return <><AppHeader name={profile.full_name ?? "Usuario"} isAdmin={profile.is_platform_admin} workspace={profile.workspace ?? undefined} active="campanas"/><main className="portal-page" id="workspace-content"><Link href={`/campanas?catalog=${id}`} className="text-sm font-bold text-signal-dark">← Volver a mis órdenes</Link><header className="planner-hero mt-6"><div><p>Mi espacio digital</p><h1>{order.title}</h1><span>Objetivo, audiencias y piezas de tu campaña.</span></div></header><section className="mb-6 grid gap-4 md:grid-cols-2">{rows.map((row, index) => <article key={index} className="rounded-2xl border border-border bg-white p-5"><h2 className="text-lg font-black">{row.provider}</h2><p className="mt-2 text-sm text-muted">{row.format}</p><strong className="mt-4 block text-2xl">{row.unitPriceCents == null ? "Presupuesto en revisión" : `$ ${formatBudgetInput(row.unitPriceCents * row.quantity / 100)}`}</strong></article>)}</section>{allowed ? <DigitalCampaignForm orderId={id} initial={initial} version={Number(order.digital_brief_version ?? 0)} editable={canEdit}/> : <p className="rounded-panel border border-border bg-white p-6 text-sm">Este espacio se habilita cuando la compra digital queda aprobada.</p>}</main></>;
}
