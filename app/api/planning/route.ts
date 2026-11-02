import { generarPlan, completarPlan } from "@/app/planificador/actions";
import { handlePlanningRequest } from "@/lib/planning-request";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request){
  // Both stages retain the authenticated actions' role, entitlement and owner checks.
  return handlePlanningRequest(request,{prepare:form=>generarPlan(null,form),complete:completarPlan},process.env.NEXT_PUBLIC_SITE_URL?.trim());
}
