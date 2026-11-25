import { getSessionProfile } from "@/lib/auth";
import { handleCatalogCart } from "@/lib/catalog-cart-http";
import { readCatalogCart } from "@/lib/catalog-shopping-server";
import { saveCatalogSelection } from "@/app/planificador/catalog-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const store = {
  authenticated: async () => Boolean(await getSessionProfile()),
  load: readCatalogCart,
  save: saveCatalogSelection,
};
export async function GET(request: Request) { return handleCatalogCart(request, store, process.env.NEXT_PUBLIC_SITE_URL); }
export async function POST(request: Request) { return handleCatalogCart(request, store, process.env.NEXT_PUBLIC_SITE_URL); }
