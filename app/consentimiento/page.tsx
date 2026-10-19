import { redirect } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { getSessionProfile } from "@/lib/auth";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { ConsentForm } from "./ConsentForm";

export const metadata = { title: "Consentimiento y privacidad" };

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  const { next } = await searchParams;
  return <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
    <section className="w-full rounded-panel border border-border bg-white p-7 shadow-panel sm:p-10">
      <Wordmark one className="text-lg" />
      <p className="mt-7 text-xs font-black uppercase tracking-[.18em] text-signal-dark">Consentimiento verificable</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">Antes de continuar, decide sobre tus datos.</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">Hola, {profile.full_name || profile.email}. Registraremos fecha, versiones aceptadas y opciones elegidas. Ad Mavericks es responsable del tratamiento para las finalidades informadas; esta aceptación no transfiere la propiedad de tus datos personales ni elimina tus derechos.</p>
      <ConsentForm nextPath={next?.startsWith("/") ? next : "/panel"} />
      <p className="mt-5 text-center text-[11px] text-muted">Versiones: términos {LEGAL_VERSIONS.terms} · privacidad {LEGAL_VERSIONS.privacy} · tratamiento {LEGAL_VERSIONS.treatment}</p>
    </section>
  </main>;
}
