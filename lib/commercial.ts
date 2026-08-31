/**
 * Interruptores de seguridad para operaciones con efectos economicos.
 * Tener credenciales configuradas no habilita por si solo cobros ni gasto.
 */
export function isCommercialPaymentsEnabled(): boolean {
  return enabled(process.env.COMMERCIAL_PAYMENTS_ENABLED);
}

export function isMetaPausedDraftsEnabled(): boolean {
  return enabled(process.env.META_PAUSED_DRAFTS_ENABLED);
}

export function isMetaRealSpendEnabled(): boolean {
  return enabled(process.env.META_REAL_SPEND_ENABLED);
}

export function isAgentAutomationEnabled(): boolean {
  return enabled(process.env.AGENT_AUTOMATION_ENABLED);
}

export function isAiAssistantEnabled(): boolean {
  return enabled(process.env.AI_ASSISTANT_ENABLED);
}

export function isAiWebTrendsEnabled(): boolean {
  return enabled(process.env.AI_WEB_TRENDS_ENABLED);
}

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
