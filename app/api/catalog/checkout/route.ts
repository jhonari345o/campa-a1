import { submitCatalogSelection } from "@/app/planificador/catalog-actions";
import { handleCatalogCheckout } from "@/lib/catalog-checkout";
import { withRequestScope } from "@/lib/request-scope";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  return withRequestScope(()=>handleCatalogCheckout(request, submitCatalogSelection, process.env.NEXT_PUBLIC_SITE_URL));
}
