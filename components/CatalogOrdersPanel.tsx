import Link from "next/link";
import { digitalBriefEditable } from "@/lib/digital-campaign-brief";
import { formatBudgetInput } from "@/lib/brief-inputs";
type CatalogOrder = { id: string; title: string; status: string; known_subtotal_cents: number; total_cents: number | null; desired_start: string | null; notes: string; created_at: string; items: unknown };
const money = (cents: number) => `$ ${formatBudgetInput(cents / 100)}`;
const rowPrice = (row: Record<string, unknown>) => {
  const price = row.unitPriceCents ?? row.referenceUnitPriceCents;
  return typeof price === "number" && Number.isSafeInteger(price) && price >= 0 ? price : null;
};
const labels: Record<string, string> = { pending_review: "En revisión", quoting: "En cotización", awaiting_client: "Pendiente de respuesta", approved: "Aprobada", in_execution: "En ejecución", completed: "Completada", cancelled: "Cancelada" };
export function CatalogOrdersPanel({ orders, selected }: { orders: CatalogOrder[]; selected?: string }) {
  if (!orders.length) return null;
  return <section className="mt-8 rounded-panel border border-border bg-white p-6 shadow-panel" aria-label="Solicitudes del catálogo"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-signal-dark">Compras del catálogo</p><h2 className="mt-1 text-xl font-black">Tus selecciones de medios</h2><p className="mt-1 text-sm text-muted">Solicitudes independientes con sus productos, cantidades y valores de referencia.</p></div><strong className="rounded-full bg-signal/10 px-3 py-1 text-xs">{orders.length} solicitudes</strong></div>
    <div className="mt-5 grid gap-4">{orders.map(order => {
      const rows = Array.isArray(order.items) ? order.items.filter(v => v && typeof v === "object") as Array<Record<string, unknown>> : [];
      const estimate = rows.length && rows.every(row => rowPrice(row) != null) ? rows.reduce((sum, row) => sum + rowPrice(row)! * Number(row.quantity), 0) : null;
      return <details key={order.id} open={selected === order.id} className="rounded-2xl border border-border bg-fog p-4">
        <summary className="cursor-pointer font-black"><span>{order.title}</span><span className="ml-3 inline-block rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-signal-dark">{labels[order.status] ?? "En revisión"}</span><span className="mt-2 block text-lg">{money(order.total_cents == null ? estimate ?? Number(order.known_subtotal_cents) : Number(order.total_cents))}{order.total_cents == null ? estimate == null ? " · subtotal con precio" : " · estimado" : ""}</span></summary>
        <p className="mt-3 text-xs text-muted">{new Date(order.created_at).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}{order.desired_start ? ` · Inicio deseado: ${order.desired_start}` : ""}</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead><tr><th className="p-2">Proveedor y producto</th><th className="p-2">Unidad</th><th className="p-2">Cantidad</th><th className="p-2">Precio</th><th className="p-2">Subtotal</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-border"><th scope="row" className="p-2"><strong>{String(row.provider ?? "")}</strong><span className="mt-1 block font-normal">{String(row.name ?? "")} · {String(row.format ?? "")}</span>{!!row.location && <small className="mt-1 block font-normal text-muted">{String(row.location)}</small>}</th><td className="p-2">{String(row.unit ?? "")}<small className="mt-1 block text-muted">{row.taxIncluded === true ? "IVA incluido" : row.taxIncluded === false ? "Sin IVA" : "Base fiscal no indicada"}</small></td><td className="p-2">{Number(row.quantity)}</td><td className="p-2">{rowPrice(row) == null ? "Tarifa solicitada" : <>{money(rowPrice(row)!)}{row.unitPriceCents == null && <small className="mt-1 block text-muted">Referencia</small>}</>}</td><td className="p-2 font-black">{rowPrice(row) == null ? "Tarifa solicitada" : money(rowPrice(row)! * Number(row.quantity))}</td></tr>)}</tbody></table></div>
        {order.notes && <p className="mt-4 whitespace-pre-wrap text-sm">{order.notes}</p>}
        {rows.some(row => row.kind === "digital") && digitalBriefEditable(order.status, order.total_cents) && <Link href={`/digital/${order.id}`} className="btn btn-primary mt-5">Configurar campaña digital →</Link>}
      </details>;
    })}</div>
  </section>;
}
export type { CatalogOrder };
