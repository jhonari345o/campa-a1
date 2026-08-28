import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { PautarChat } from "./PautarChat";
import { computeCharge, money, SERVICE_FEE_PCT, TAX_PCT } from "@/lib/pricing";
import { isCommercialPaymentsEnabled } from "@/lib/commercial";
import { isDlocalConfigured } from "@/lib/payments/dlocal";
import { isMetaConfigured } from "@/lib/ads/meta";

export const metadata = { title: "Pautar con Mavi" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const REDES_VALIDAS = ["instagram", "facebook"];

export default async function PautarPage({
  searchParams,
}: {
  searchParams: Promise<{
    red?: string;
    monto?: string;
    objetivo?: string;
    checkout?: string;
    job?: string;
    detail?: string;
    post?: string;
  }>;
}) {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");

  const sp = await searchParams;
  const initialRed = sp.red && REDES_VALIDAS.includes(sp.red) ? sp.red : undefined;
  const montoNum = Number(sp.monto);
  const initialMonto = Number.isFinite(montoNum) && montoNum > 0 ? montoNum : undefined;
  const initialObjetivo = sp.objetivo?.slice(0, 120) || undefined;
  const initialPostUrl = safePostUrl(sp.post);
  const commercialPaymentsEnabled = isCommercialPaymentsEnabled();
  const dlocalConectado = isDlocalConfigured();
  const metaConectada = isMetaConfigured();

  return (
    <div className="min-h-screen">
      <AppHeader
        name={profile.full_name ?? profile.email ?? "Ad Mavericks"}
        isAdmin={profile.is_platform_admin}
        active="pautar"
      />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight">Pautar con Mavi</h1>
        <p className="mt-1 text-muted">
          Mavi prepara la solicitud. El equipo revisa cuenta, disponibilidad, condiciones y
          aprobaciones antes de cualquier orden vinculante.
        </p>

        {!commercialPaymentsEnabled && (
          <p className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-bold text-forest">
            🛡️ Modo controlado: puedes definir publicación, ubicación y presupuesto, pero el cobro
            permanece bloqueado hasta completar los controles P0/P1 del lanzamiento comercial.
          </p>
        )}

        {sp.checkout === "success" && (
          <p className="mt-4 rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm font-bold text-forest">
            ✅ dLocal Go confirmó el pago. La orden ya está disponible en “Mis campañas” para preparar
            el borrador pausado de Meta.
          </p>
        )}
        {sp.checkout === "cancelled" && (
          <p className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-bold text-forest">
            Pago cancelado. dLocal Go no habilitó la pauta; puedes crear una nueva orden cuando quieras.
          </p>
        )}

        {sp.checkout === "pending" && (
          <p className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-bold text-forest">
            El pago sigue pendiente en dLocal Go. La pauta se habilitará únicamente cuando la API lo confirme.
          </p>
        )}

        {["failed", "attention", "invalid"].includes(sp.checkout ?? "") && (
          <p className="mt-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">
            {sp.detail || "dLocal Go no pudo confirmar el pago. La pauta no fue habilitada."}
          </p>
        )}

        {(!dlocalConectado || !metaConectada) && (
          <p className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-bold text-forest">
            🔌 Integración pendiente de credenciales: {!dlocalConectado ? "dLocal Go" : ""}
            {!dlocalConectado && !metaConectada ? " y " : ""}
            {!metaConectada ? "Meta" : ""}. No se simulan tarjetas ni publicaciones.
          </p>
        )}

        {/* El desglose real (comision/ganancia) es SOLO para el equipo Ad Mavericks. */}
        {profile.is_platform_admin && <ModeloMonetizacion />}

        <div className="mt-6">
          <PautarChat
            initialRed={initialRed}
            initialMonto={initialMonto}
            initialObjetivo={initialObjetivo}
            initialPostUrl={initialPostUrl}
            commercialPaymentsEnabled={commercialPaymentsEnabled}
          />
        </div>
      </main>
    </div>
  );
}

function safePostUrl(value?: string) {
  if (!value || value.length > 2000) return undefined;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : undefined; } catch { return undefined; }
}

/** Explica el modelo de negocio con un ejemplo. SOLO para el equipo (admin). */
function ModeloMonetizacion() {
  const ej = computeCharge(200);
  const pct = Math.round(SERVICE_FEE_PCT * 100);
  const taxPct = Math.round(TAX_PCT * 100);
  return (
    <details className="mt-4 rounded-panel border border-forest/30 bg-forest/5 p-5 shadow-panel">
      <summary className="cursor-pointer text-sm font-black text-forest">
        🔒 Solo equipo · Como ganamos (ejemplo)
      </summary>
      <p className="mt-3 text-sm text-muted">
        El cliente recarga lo que quiere invertir en anuncios. Sobre esa recarga cobramos una
        impuestos y costos regulatorios del <strong className="text-forest">{taxPct}%</strong>, mas
        una comision de servicio del <strong className="text-forest">{pct}%</strong>: esa es la
        ganancia de Ad Mavericks. La recarga completa se acredita a la pauta.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <Box label="Recarga (a ads)" value={money(ej.base)} tone="fog" />
        <Box label={`Impuestos ${taxPct}%`} value={money(ej.tax)} tone="fog" />
        <Box label={`Comision ${pct}%`} value={money(ej.fee)} tone="signal" />
        <Box label="Paga el cliente" value={money(ej.total)} tone="forest" />
      </div>
      <p className="mt-3 text-xs text-muted">
        Ejemplo: recarga {money(ej.base)} → paga {money(ej.total)} → van {money(ej.base)} a los
        anuncios, {money(ej.tax)} corresponden a impuestos/costos y {money(ej.fee)} es nuestra
        ganancia.
      </p>
    </details>
  );
}

function Box({ label, value, tone }: { label: string; value: string; tone: "fog" | "signal" | "forest" }) {
  const map = {
    fog: "bg-fog text-forest",
    signal: "bg-signal/15 text-signal-dark",
    forest: "bg-forest text-white",
  } as const;
  return (
    <div className={`rounded-xl px-2 py-3 ${map[tone]}`}>
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] font-bold uppercase opacity-80">{label}</p>
    </div>
  );
}
