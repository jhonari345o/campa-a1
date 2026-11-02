import Image from "next/image";
import type { MediaGroup } from "@/lib/media-groups";
import { providerLogo } from "@/lib/strategy-visuals";
import { MediaSelectionIcon } from "./MediaSelectionIcon";
export function MediaProviderMark({ provider, medium }: { provider: string; medium: MediaGroup }) {
  const logo = providerLogo(provider, medium);
  return <span className="strategy-provider-mark">{logo ? <Image src={logo} alt={`Logo de ${provider}`} width={100} height={58} unoptimized/> : <MediaSelectionIcon medium={medium}/>}</span>;
}
