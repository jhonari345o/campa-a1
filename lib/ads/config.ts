import "server-only";

export function getMaxMetaBudgetUsd(): number {
  const configured = Number(process.env.META_MAX_CAMPAIGN_BUDGET_USD ?? "500");
  return Number.isFinite(configured) && configured >= 5 ? configured : 500;
}

export function getMetaCampaignDurationDays(): number {
  const configured = Number(process.env.META_CAMPAIGN_DURATION_DAYS ?? "7");
  if (!Number.isInteger(configured) || configured < 1 || configured > 90) return 7;
  return configured;
}

