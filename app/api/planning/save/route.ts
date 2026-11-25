import { guardarPlan } from "@/app/planificador/actions";
import { handlePlanSaveRequest } from "@/lib/planning-save-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlePlanSaveRequest(request, guardarPlan, process.env.NEXT_PUBLIC_SITE_URL?.trim());
}
