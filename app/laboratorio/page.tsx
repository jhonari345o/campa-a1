import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { CreativeLab } from "./CreativeLab";

export const metadata = { title: "Laboratorio creativo" };

export default async function LaboratorioPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  return <div className="min-h-screen"><AppHeader name={profile.full_name ?? profile.email ?? "Ad Mavericks"} isAdmin={profile.is_platform_admin} active="laboratorio" /><main id="workspace-content" className="portal-page portal-page-planner"><CreativeLab /></main></div>;
}
