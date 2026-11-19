import "server-only";

import type { Profile } from "@/lib/auth";
import type { MyCompany } from "@/lib/company";
import { catalogClientContext } from "@/lib/catalog-client-server";
import type { MetaClientScope } from "./meta-client-binding";

/** Resolve the existing authenticated workspace and its selected agency client. */
export async function currentCampaignScope(profile: Profile, companies: MyCompany[]): Promise<{ company: MyCompany; scope: MetaClientScope }> {
  const company = profile.workspace?.companyId
    ? companies.find((candidate) => candidate.id === profile.workspace?.companyId)
    : companies.length === 1 ? companies[0] : undefined;
  if (!company || company.status !== "activa") throw new Error("Selecciona un espacio activo para preparar la campaña.");
  let clientId: string | null = null;
  if (company.portal_kind === "agency") {
    if (profile.workspace?.companyId !== company.id) throw new Error("Selecciona el espacio de la agencia.");
    const context = await catalogClientContext();
    if (!context?.selected) throw new Error("Selecciona el cliente de la campaña en el catálogo.");
    clientId = context.selected.id;
  }
  return { company, scope: { companyId: company.id, clientId } };
}
