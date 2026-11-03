import directory from "./ecuador-geography.json";

export type CoverageKind = "country" | "province" | "city";

export type CoverageSelection = {
  key: string;
  kind: CoverageKind;
  label: string;
  context?: string;
};

const geographyLabelCorrections: Record<string, string> = {
  Manabi: "Manabí",
  Sucumbios: "Sucumbíos",
  Samborondon: "Samborondón",
};

export function geographyLabel(sourceName: string) {
  return geographyLabelCorrections[sourceName] ?? sourceName;
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-EC")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function geographyKey(kind: CoverageKind, label: string, context?: string) {
  const suffix = context ? `:${normalizeSearch(context).replace(/\s+/g, "-")}` : "";
  return `${kind}:${normalizeSearch(label).replace(/\s+/g, "-")}${suffix}`;
}

export const nationalCoverage: CoverageSelection = {
  key: geographyKey("country", "Ecuador"),
  kind: "country",
  label: "Nacional",
  context: "Todo Ecuador",
};

export function isNationalCoverage(coverage: CoverageSelection[]) {
  return coverage.some((item) => item.kind === "country");
}

export function coverageSummary(coverage: CoverageSelection[]) {
  if (!coverage.length) return "Sin cobertura seleccionada";
  if (isNationalCoverage(coverage)) return "Nacional";
  return coverage.map((item) => item.label).join(", ");
}

// IDs and display names are canonicalized against the same versioned boundaries as the map.
const selections = directory.map((item): CoverageSelection => ({ key: item.key, kind: item.kind as CoverageKind, label: item.label, ...("context" in item ? { context: item.context } : {}) }));
const byKey = new Map([nationalCoverage, ...selections].map((item) => [item.key, item]));
const byShape = new Map(directory.map(({ shapeId, ...item }) => [shapeId, item as CoverageSelection]));

export function coverageForBoundary(shapeId: string): CoverageSelection | undefined {
  return byShape.get(shapeId);
}

export function normalizeCoverage(value: unknown): CoverageSelection[] {
  if (typeof value === "string") {
    if (value.length > 100_000) return [];
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, CoverageSelection>();
  for (const candidate of value.slice(0, 300)) {
    if (!candidate || typeof candidate !== "object" || typeof candidate.key !== "string") continue;
    const canonical = byKey.get(candidate.key);
    if (canonical) unique.set(canonical.key, { ...canonical });
  }
  if (unique.has(nationalCoverage.key)) return [{ ...nationalCoverage }];
  return [...unique.values()].filter((item) => item.kind !== "city" || !item.context || !unique.has(geographyKey("province", item.context)));
}

export function restoreCoverage(brief: Record<string, unknown>): CoverageSelection[] {
  const saved = normalizeCoverage(brief.coverage);
  if (saved.length) return saved;
  if (brief.geoTarget && typeof brief.geoTarget === "object" && "radiusKm" in brief.geoTarget) return [];
  const labels=Array.isArray(brief.geographies)?brief.geographies.filter((s):s is string=>typeof s==="string"):typeof brief.geography==="string"?[brief.geography]:[];
  return coverageFromLabels(labels);
}

export function coverageDescription(value: CoverageSelection[]): string {
  if (isNationalCoverage(value)) return "Todo Ecuador";
  return value.map((item) => item.kind === "province"
    ? `${item.label} (provincia)`
    : `${item.label}${item.context ? `, ${item.context}` : ""} (cantón)`
  ).join(" · ");
}

export function normalizeCoverageBrief(brief: Record<string, unknown>): { coverage: CoverageSelection[]; geography: string } {
  const coverage = restoreCoverage(brief);
  // Existing radius-based plans retain their exact territory until the user replaces it.
  const geography = coverage.length ? coverageDescription(coverage) : typeof brief.geography === "string" ? brief.geography : "";
  return { coverage, geography };
}


/** Legacy labels are restored only when they identify an unambiguous boundary.
 * Radius descriptions and unknown places retain their original stored text. */
export function coverageFromLabels(labels:string[]):CoverageSelection[] {
  const resolved:CoverageSelection[]=[];
  for(const label of labels){
    if(/^(todo ecuador|nacional|ecuador)$/i.test(label.trim()))return [{...nationalCoverage}];
    const province=/^provincia de |\(provincia\)$/i.test(label.trim());
    const key=normalizeSearch(label.replace(/^provincia de /i,"").replace(/\s*\(provincia\)$/i,""));
    const candidates=selections.filter(s=>normalizeSearch(s.label)===key&&(!province||s.kind==="province"));
    if(candidates.length!==1)return [];
    resolved.push(candidates[0]);
  }
  return normalizeCoverage(resolved);
}
export function coverageLegacyLabels(value:CoverageSelection[]):string[] {
  return normalizeCoverage(value).map(s=>s.kind==="country"?"Todo Ecuador":s.kind==="province"?`Provincia de ${s.label}`:s.label);
}
