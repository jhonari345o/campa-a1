import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { StackAdaptPanel } from "./StackAdaptPanel";

export const metadata = { title: "DSP · StackAdapt" };
export const dynamic = "force-dynamic";

export default async function DspPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  if (!profile.is_platform_admin) redirect("/planificador?view=media&section=digital");
  return <>
    <AppHeader name={profile.full_name ?? "Usuario"} isAdmin workspace={profile.workspace ?? undefined} active="planificador"/>
    <main className="portal-page" id="workspace-content">
      <Link href="/planificador?view=media&section=digital" className="text-sm font-bold text-signal-dark">← Medios digitales</Link>
      <header className="planner-hero mt-6"><div><p>Ad Mavericks One · Medios digitales</p><h1>Programmatic DSP</h1><span>Tu operación de StackAdapt, desde One.</span></div></header>
      <StackAdaptPanel/>
    </main>
  </>;
}
