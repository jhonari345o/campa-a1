import Image from "next/image";
import type { MediaGroup } from "@/lib/media-groups";
import { providerLogo } from "@/lib/strategy-visuals";
import { MediaSelectionIcon } from "./MediaSelectionIcon";
export function MediaProviderMark({ provider, medium, context="" }: { provider: string; medium: MediaGroup; context?:string }) {
  const logo = providerLogo(provider, medium, context);
  return <span className="strategy-provider-mark">{logo ? <Image src={logo} alt={`Logo de ${provider}`} width={100} height={58} unoptimized/> : <MediaSelectionIcon medium={medium}/>}</span>;
}
