import type { MediaGroup } from "@/lib/media-groups";

/** Contracts only. The reference observations are loaded from private storage. */
export type TgiTarget = { ageRange?: string; sex?: string; socioeconomic?: string; audienceType?: string; geography?: string };
export type TgiValue = { id: string; label: string; role: "media" | "behavior"; value: number };
export type TgiResearch = {
  study: string; period: string; targetLabel: string; geography: string;
  relationship: "age_matched" | "context_only"; note: string; values: TgiValue[];
};
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === "object" && !Array.isArray(v) ? v as Obj : {};
const str = (v: unknown) => typeof v === "string" ? v.slice(0, 220) : "";
const key = (v = "") => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[–—]/g, "-").trim();
const validPct = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
const allowedIds = new Set(["tv-streaming", "open-tv", "ooh", "radio", "internet", "social", "online-video", "music-streaming", "simultaneous", "secure-transactions", "purchase-planning"]);

export function projectTgi(payload: unknown, target: TgiTarget): TgiResearch | undefined {
  const source = obj(payload);
  const age = key(target.ageRange).replace(/^personas /, "");
  const column = age === "15-34" ? "youngAdults" : age === "35+" ? "adults35Plus" : "total";
  const allDimensions = key(target.sex) === "todas las personas" && key(target.socioeconomic) === "todos los nse" && key(target.audienceType) === "b2c";
  const national = /^(todo ecuador|ecuador|nacional|cobertura nacional)$/.test(key(target.geography));
  const ageMatched = column !== "total" && allDimensions && national;
  const seen = new Set<string>();
  const values: TgiValue[] = (Array.isArray(source.indicators) ? source.indicators : []).flatMap((raw) => {
    const row = obj(raw), id = str(row.id), value = row[column];
    if (!allowedIds.has(id) || seen.has(id) || !validPct(value) || !str(row.label) || !["media", "behavior"].includes(str(row.role))) return [];
    seen.add(id);
    return [{ id, label: str(row.label), role: row.role as TgiValue["role"], value }];
  });
  if (!values.length || !str(source.study) || !str(source.period)) return undefined;
  return {
    study: str(source.study), period: str(source.period), geography: "Referencia Ecuador · sin desglose provincial",
    targetLabel: column === "youngAdults" ? "Personas 15–34" : column === "adults35Plus" ? "Personas 35+" : "Total de la referencia TGI",
    relationship: ageMatched ? "age_matched" : "context_only",
    note: ageMatched
      ? "La edad coincide con el corte disponible. Describe consumo declarado; no equivale a alcance de campaña ni a compradores de la categoría."
      : "Referencia contextual: el corte disponible no reproduce todos los filtros del brief. No se atribuye este porcentaje al target ni a la provincia seleccionados.",
    values,
  };
}

export function restoreTgi(value: unknown): TgiResearch | undefined {
  const saved = obj(value);
  if (!["age_matched", "context_only"].includes(str(saved.relationship))) return undefined;
  const seen = new Set<string>();
  const values: TgiValue[] = (Array.isArray(saved.values) ? saved.values : []).flatMap((raw) => {
    const row = obj(raw), id = str(row.id);
    if (!allowedIds.has(id) || seen.has(id) || !validPct(row.value) || !["media", "behavior"].includes(str(row.role))) return [];
    seen.add(id);
    return [{ id, label: str(row.label), role: row.role as TgiValue["role"], value: row.value }];
  });
  if (!values.length || !str(saved.study) || !str(saved.period)) return undefined;
  return { study: str(saved.study), period: str(saved.period), targetLabel: str(saved.targetLabel), geography: str(saved.geography), relationship: saved.relationship as TgiResearch["relationship"], note: str(saved.note), values };
}

export function tgiUsage(group: MediaGroup, research?: TgiResearch): number | null {
  // A single compatible indicator per medium. Digital consumption is not the sum of platforms.
  const id: Partial<Record<MediaGroup, string>> = { television: "open-tv", radio: "radio", ooh: "ooh", digital: "internet" };
  return research?.values.find((row) => row.id === id[group])?.value ?? null;
}

export function tgiIndicatorApplies(id: string, selected: string[]): boolean {
  const groups: Record<string, string> = { "tv-streaming": "television", "open-tv": "television", ooh: "ooh", radio: "radio", internet: "digital", social: "digital", "online-video": "digital", "music-streaming": "digital" };
  return !!groups[id] && selected.includes(groups[id]);
}
