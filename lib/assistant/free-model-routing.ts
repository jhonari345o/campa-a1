type ModelRow = { id?: unknown; context_length?: unknown; supported_parameters?: unknown; pricing?: { prompt?: unknown; completion?: unknown } };

/** Public model metadata only; account data and prompts never enter this cache. */
let inventory: { at: number; rows: ModelRow[] } | null = null;
const freeId = (id: string) => id.endsWith(":free") && /^[a-z0-9._:/-]+$/i.test(id);
const zero = (price: unknown) => (typeof price === "string" || typeof price === "number") && String(price).trim() !== "" && Number(price) === 0;

export function selectAvailableFreeModels(configured: string[], rows: ModelRow[], structured: boolean, minimumContext: number, strictSchema = false) {
  const available = rows.filter(row => row && typeof row === "object" && typeof row.id === "string" && freeId(row.id) && zero(row.pricing?.prompt) && zero(row.pricing?.completion)
    && typeof row.context_length === "number" && row.context_length >= minimumContext
    && (!structured || Array.isArray(row.supported_parameters) && row.supported_parameters.includes("response_format"))
    && (!strictSchema || Array.isArray(row.supported_parameters) && row.supported_parameters.includes("structured_outputs")));
  const ids = new Set(available.map(row => row.id as string));
  return [...new Set([...configured.filter(id => ids.has(id)), ...available.map(row => row.id as string), "openrouter/free"])];
}

export async function availableFreeModels(configured: string[], structured: boolean, minimumContext: number, signal: AbortSignal, strictSchema = false) {
  try {
    if (!inventory || Date.now() - inventory.at > 300_000) {
      const response = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.any([signal, AbortSignal.timeout(750)]), cache: "no-store" });
      if (!response.ok) throw new Error("MODEL_INVENTORY_UNAVAILABLE");
      const data = await response.json() as { data?: unknown };
      if (!Array.isArray(data.data) || data.data.length > 5000) throw new Error("MODEL_INVENTORY_INVALID");
      inventory = { at: Date.now(), rows: data.data };
    }
    return selectAvailableFreeModels(configured, inventory.rows, structured, minimumContext, strictSchema);
  } catch {
    // Discovery is optional. Keep the explicitly configured free pool and its
    // zero-price provider cap when the public inventory is temporarily down.
    return [...new Set(configured.filter(id => freeId(id) || id === "openrouter/free"))];
  }
}
