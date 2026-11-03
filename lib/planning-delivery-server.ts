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
  if(!model || !Array.isArray(model.curves) || !model.target || !model.marketWeights)return null;
  // The supplied OTV workbook is a cumulative multi-channel campaign, not a
  // programme reach curve. Preserve that scope even for older stored definitions.
  return {...model,curves:model.curves.map(curve=>curve.medium==="television"?{...curve,scope:"multi_channel" as const}:curve)};
});
