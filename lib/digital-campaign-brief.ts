import { validDate } from "./broadcast-catalog";
export const DIGITAL_BRIEF_FIELDS = ["campaignName", "startDate", "endDate", "geography", "audience", "interests", "destination", "whatsapp", "creativeLinks", "copy", "measurement", "notes"] as const;
export type DigitalCampaignBrief = Partial<Record<typeof DIGITAL_BRIEF_FIELDS[number], string>>;
export function parseDigitalCampaignBrief(input: unknown): DigitalCampaignBrief {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Revisa la configuración de campaña.");
  const object = input as Record<string, unknown>;
  if (Object.keys(object).some(key => !(DIGITAL_BRIEF_FIELDS as readonly string[]).includes(key))) throw new Error("La configuración contiene campos no permitidos.");
  const result: DigitalCampaignBrief = {};
  for (const key of DIGITAL_BRIEF_FIELDS) {
    if (object[key] == null) continue;
    if (typeof object[key] !== "string" || object[key].length > 4000) throw new Error("Reduce el texto a 4.000 caracteres por campo.");
    result[key] = object[key].trim();
  }
  if (JSON.stringify(result).length > 24000) throw new Error("Reduce la extensión de la configuración.");
  if (result.startDate && !validDate(result.startDate) || result.endDate && !validDate(result.endDate) || result.startDate && result.endDate && result.endDate < result.startDate) throw new Error("Revisa las fechas de la campaña.");
  const urls = [result.destination, ...(result.creativeLinks ?? "").split(/[\n\s]+/)].filter(Boolean);
  for (const value of urls) {
    let url: URL; try { url = new URL(value!); } catch { throw new Error("Escribe enlaces completos que empiecen con https://."); }
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Usa enlaces https:// sin credenciales.");
  }
  if (result.whatsapp && !/^\+?[\d\s()-]{7,25}$/.test(result.whatsapp)) throw new Error("Revisa el número de WhatsApp e incluye el código de país.");
  return result;
}
export function digitalBriefEditable(status: string, total: number | null) { return total != null && ["approved", "in_execution"].includes(status); }
