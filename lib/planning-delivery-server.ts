import "server-only";
import { cache } from "react";
import { catalogAccess } from "./catalog-access-server";
import { createClient } from "./supabase/server";
import { type PlanningCurveModel } from "./planning-delivery";

/** Authorized per-request read. Calibration and provenance never go to the browser. */
export const readPlanningDeliveryModel = cache(async (): Promise<PlanningCurveModel | null> => {
  const access = await catalogAccess(), caller = await createClient();
  const { data: allowed, error: permissionError } = await caller.rpc("can_access_infomedia");
  if (permissionError || !allowed) return null;
  const { data, error } = await access.db.from("planning_delivery_models").select("definition").eq("id", "atl-curve-reference-2022").eq("active", true).maybeSingle();
  if (error || !data) return null;
  const model = data.definition as PlanningCurveModel;
  return model && Array.isArray(model.curves) && model.target && model.marketWeights ? model : null;
});
