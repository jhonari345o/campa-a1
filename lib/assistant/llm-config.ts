type Environment = Record<string, string | undefined>;
export type LlmConfiguration = {
  provider: "openrouter" | "deepseek" | "bedrock" | "compatible";
  model: string;
  fallbackModels: string[];
  freeOnly: boolean;
  endpoint?: string;
};

const freeModel = (model: string) => model === "openrouter/free" || model.endsWith(":free");

/** Shared by Mavi and planning. Contains no keys and never switches providers after a failure. */
export function getLlmConfiguration(env: Environment = process.env): LlmConfiguration | null {
  const preferred = env.AI_PROVIDER?.trim().toLowerCase();
  const provider = preferred || (env.BEDROCK_MODEL_ID ? "bedrock" : env.OPENROUTER_API_KEY ? "openrouter" : env.DEEPSEEK_API_KEY ? "deepseek" : env.LLM_BASE_URL && env.LLM_MODEL ? "compatible" : "");
  if (provider === "openrouter" && env.OPENROUTER_API_KEY) {
    const model = env.OPENROUTER_MODEL?.trim() || "minimax/minimax-m3:free";
    const freeOnly = freeModel(model);
    const fallbackModels = [...new Set((env.OPENROUTER_FALLBACK_MODELS ?? "google/gemma-4-26b-a4b-it:free,openrouter/free").split(",").map(m => m.trim()))]
      .filter(m => m && m !== model && (!freeOnly || freeModel(m)));
    return { provider, model, fallbackModels, freeOnly };
  }
  if (provider === "deepseek" && env.DEEPSEEK_API_KEY) return { provider, model: env.DEEPSEEK_MODEL?.trim() || "deepseek-chat", fallbackModels: [], freeOnly: false };
  if (provider === "bedrock" && env.BEDROCK_MODEL_ID) return { provider, model: env.BEDROCK_MODEL_ID.trim(), fallbackModels: [], freeOnly: false };
  if (provider === "compatible" && env.LLM_BASE_URL && env.LLM_MODEL) return { provider, model: env.LLM_MODEL.trim(), endpoint: env.LLM_BASE_URL, fallbackModels: [], freeOnly: false };
  return null;
}

/** Existing free Mavi configuration is reusable; paid planning requires explicit activation. */
export function planningAiEnabled(kind: "strategy" | "category", config: LlmConfiguration | null, env: Environment = process.env): boolean {
  if (!config) return false;
  const flag = env[kind === "strategy" ? "MEDIA_STRATEGY_AI_ENABLED" : "INFOMEDIA_AI_ENABLED"];
  if (flag !== undefined) return flag === "true";
  if (config.provider === "bedrock") return env[kind === "strategy" ? "MEDIA_STRATEGY_AWS_AI_ENABLED" : "INFOMEDIA_AWS_AI_ENABLED"] === "true";
  return config.provider === "openrouter" && config.freeOnly && env.AI_ASSISTANT_ENABLED === "true";
}
