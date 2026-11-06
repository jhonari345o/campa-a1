import { CatalogLogo } from "./CatalogLogo";
import type { MediaGroup } from "@/lib/media-groups";
import { providerLogo } from "@/lib/strategy-visuals";
export function MediaProviderMark({ provider, medium, context="" }: { provider: string; medium: MediaGroup; context?:string }) {
  const logo = providerLogo(provider, medium, context);
  return <span className="strategy-provider-mark"><CatalogLogo src={logo} alt={`Logo de ${provider}`} medium={medium} className="object-contain"/></span>;
}
