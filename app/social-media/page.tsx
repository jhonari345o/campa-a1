import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionProfile } from "@/lib/auth";
import { getSocialWorkspace } from "@/lib/social-media-server";
import { SocialMediaWorkspace } from "./SocialMediaWorkspace";
export const metadata = { title: "Social Media", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function SocialMediaPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/ingresar");
  if (!profile.is_platform_admin && profile.workspace?.kind === "provider") redirect("/proveedores");
  const { company } = await searchParams;
  const workspace = await getSocialWorkspace(profile, company);
  return <div className="min-h-screen"><AppHeader name={profile.full_name ?? profile.email ?? "Ad Mavericks"} isAdmin={profile.is_platform_admin} workspace={profile.workspace} active="social-media" /><main id="workspace-content" className="portal-page portal-page-wide"><SocialMediaWorkspace key={workspace.companyId} initial={workspace} /></main></div>;
}
