import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { StackAdaptPanel } from "./StackAdaptPanel";
import styles from "./StackAdaptReport.module.css";

export const metadata = { title: "Reportes digitales · StackAdapt" };
export const dynamic = "force-dynamic";

export default async function DspPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  if (!profile.is_platform_admin) redirect("/planificador?view=media&section=digital");
  return <div className={styles.page}>
    <AppHeader name={profile.full_name ?? "Usuario"} isAdmin workspace={profile.workspace ?? undefined} active="reportes" title="Reportes digitales"/>
    <main className="portal-page" id="workspace-content">
      <Link href="/planificador?view=media&section=digital" className="text-sm font-bold text-signal-dark">← Medios digitales</Link>
      <header className="planner-hero mt-6"><div><p>Ad Mavericks One · Medios digitales</p><h1>Reportes digitales</h1><span>Resultados de StackAdapt, por anunciante y campaña.</span></div></header>
      <StackAdaptPanel/>
    </main>
  </div>;
}
