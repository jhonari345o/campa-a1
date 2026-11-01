import Image from "next/image";
import type { WorkspaceIdentity } from "@/lib/workspace-brand";

export function WorkspaceClientBrand({ workspace }: { workspace?: WorkspaceIdentity | null }) {
  if (!workspace) return null;
  const asset = workspace.brand === "ucsg" ? { src: "/partners/ucsg/ucsg-logo.png", width: 534, height: 132, alt: "UCSG" }
    : workspace.brand === "lettera" ? { src: "/partners/lettera/lettera-logo.png", width: 2048, height: 493, alt: "Léttera" }
    : workspace.brand === "mobil" ? { src: "/partners/mobil/mobil-logo.png", width: 2000, height: 610, alt: "Mobil" } : null;
  return <div className="workspace-client-brand" aria-label={`Espacio de ${workspace.name}`}>
    <span>Tu espacio</span>{asset ? <Image {...asset} alt={asset.alt} className="workspace-client-brand-image" priority/> : <strong>{workspace.name}</strong>}
  </div>;
}
