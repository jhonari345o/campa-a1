import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { getAdvertisers, MEDIA_TYPE_LABELS, MEDIA_TYPES } from "@/lib/market";
import { crearAnunciante, crearMedio, crearInversion, crearMetrica } from "../actions";
import { EntityForm, STATUS_OPTIONS, type Field } from "./EntityForm";

export const metadata = { title: "Cargar datos de mercado" };

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default async function CargarPage() {
  if (!supabaseConfigured) redirect("/consola");
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  if (!profile.is_platform_admin) redirect("/mercado");

  const advertisers = await getAdvertisers(200);
  const advertiserOptions = advertisers.map((a) => ({ value: a.id, label: a.name }));
  const mediaOptions = MEDIA_TYPES.map((t) => ({ value: t, label: MEDIA_TYPE_LABELS[t] }));
  const platformOptions = [
    { value: "google_ads", label: "Google Ads" },
    { value: "meta_ads", label: "Meta Ads" },
    { value: "google_analytics", label: "Google Analytics" },
  ];

  const anuncianteFields: Field[] = [
    { name: "name", label: "Nombre", required: true, colSpan: 2, placeholder: "Cerveceria del Litoral" },
    { name: "legal_id", label: "RUC", placeholder: "0990000000001" },
    { name: "sector", label: "Sector", placeholder: "Bebidas" },
    { name: "province", label: "Provincia", placeholder: "Guayas" },
    { name: "status", label: "Estado", options: STATUS_OPTIONS },
  ];

  const medioFields: Field[] = [
    { name: "name", label: "Nombre", required: true, placeholder: "Ecuavisa" },
    { name: "media_type", label: "Tipo de medio", options: mediaOptions, required: true },
    { name: "owner", label: "Propietario", colSpan: 2, placeholder: "Grupo / empresa" },
  ];

  const inversionFields: Field[] = [
    { name: "advertiser_id", label: "Anunciante", options: advertiserOptions, required: true, colSpan: 2 },
    { name: "media_type", label: "Medio", options: mediaOptions },
    { name: "amount_usd", label: "Monto (USD)", type: "number", placeholder: "50000" },
    { name: "period_year", label: "Anio", type: "number", required: true, placeholder: "2026" },
    { name: "period_month", label: "Mes (1-12)", type: "number", placeholder: "8" },
    { name: "status", label: "Estado", options: STATUS_OPTIONS },
    { name: "notes", label: "Notas", colSpan: 2 },
  ];

  const metricaFields: Field[] = [
    { name: "advertiser_id", label: "Anunciante", options: advertiserOptions, required: true, colSpan: 2 },
    { name: "platform", label: "Plataforma", options: platformOptions, required: true },
    { name: "spend_usd", label: "Inversion (USD)", type: "number", placeholder: "12000" },
    { name: "period_year", label: "Anio", type: "number", required: true, placeholder: "2026" },
    { name: "period_month", label: "Mes (1-12)", type: "number", placeholder: "8" },
    { name: "impressions", label: "Impresiones", type: "number" },
    { name: "clicks", label: "Clics", type: "number" },
    { name: "conversions", label: "Conversiones", type: "number" },
    { name: "status", label: "Estado", options: STATUS_OPTIONS },
  ];

  return (
    <div className="min-h-screen">
      <AppHeader
        name={profile.full_name ?? profile.email ?? "Ad Mavericks"}
        isAdmin
        active="mercado"
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Cargar datos de mercado</h1>
            <p className="mt-1 text-muted">
              Regla: si un dato no esta verificado, dejalo como <strong>pendiente</strong>.
            </p>
          </div>
          <Link href="/mercado" className="btn btn-secondary text-sm">
            ← Volver
          </Link>
        </div>

        {advertisers.length === 0 && (
          <p className="mt-6 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-bold text-forest">
            Empieza creando un anunciante: las inversiones y metricas se ligan a el.
          </p>
        )}

        <div className="mt-8 grid gap-8">
          <EntityForm
            title="Nuevo anunciante"
            description="Empresa que invierte en publicidad (Superintendencia de Companias)."
            action={crearAnunciante}
            fields={anuncianteFields}
            submitLabel="Agregar anunciante →"
          />
          <EntityForm
            title="Nuevo medio / canal"
            description="Televisora, emisora, plataforma o empresa de via publica."
            action={crearMedio}
            fields={medioFields}
            submitLabel="Agregar medio →"
          />
          <EntityForm
            title="Nueva inversion publicitaria"
            description="Cuanto invirtio un anunciante en un medio y periodo."
            action={crearInversion}
            fields={inversionFields}
            submitLabel="Registrar inversion →"
          />
          <EntityForm
            title="Nueva metrica digital"
            description="Google Ads, Meta Ads o Google Analytics."
            action={crearMetrica}
            fields={metricaFields}
            submitLabel="Registrar metrica →"
          />
        </div>
      </main>
    </div>
  );
}
