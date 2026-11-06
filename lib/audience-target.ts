/** Common vocabulary for the demographic cuts present in the licensed studies.
 * These are cohort definitions, not audience figures. A selectable cut does not
 * make every medium, city or wave compatible with it. */
export const AUDIENCE_AGES = [
  { value: "Personas 18+", label: "18–99 años", min: 18, max: 99 },
  { value: "Personas 3+", label: "3–99 años", min: 3, max: 99 },
  { value: "3-11", label: "3–11 años", min: 3, max: 11 },
  { value: "12-17", label: "12–17 años", min: 12, max: 17 },
  { value: "15-34", label: "15–34 años", min: 15, max: 34 },
  { value: "35+", label: "35 años o más", min: 35, max: 99 },
] as const;
export const AUDIENCE_SEXES = [
  { value: "Todas las personas", label: "Todas las personas", code: "all" },
  { value: "Mujeres", label: "Mujeres", code: "female" },
  { value: "Hombres", label: "Hombres", code: "male" },
] as const;
export const AUDIENCE_NSES = [
  { value: "Todos los NSE", label: "Todos los NSE", code: "all" },
  { value: "NSE AB", label: "NSE AB", code: "AB" },
] as const;
export type AudienceSelection = { ageRange: string; sex: string; socioeconomic: string };
export type AudienceInput = Partial<AudienceSelection>;
export type AudienceCohort = { ageMin: number | null; ageMax: number | null; sex: string; nse: string };
export const DEFAULT_AUDIENCE: AudienceSelection = { ageRange: "Personas 18+", sex: "Todas las personas", socioeconomic: "Todos los NSE" };
const key = (value = "") => typeof value === "string" ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() : "";

function ageValue(value: string): string | undefined {
  const candidate = key(value).replace(/^(personas|ninos|adolescentes) /, "").replace(/ anos$/, "");
  return AUDIENCE_AGES.find(age => [key(age.value).replace(/^personas /, ""), key(age.label).replace(/ anos$/, ""), `${age.min} ${age.max}`, ...(age.max === 99 ? [`${age.min}`, `${age.min} anos o mas`] : [])].includes(candidate))?.value;
}
function sexValue(value: string): string | undefined {
  return AUDIENCE_SEXES.find(sex => [key(sex.value), key(sex.code), ...(sex.code === "all" ? ["hom muj", "hombres y mujeres"] : [])].includes(key(value)))?.value;
}
function nseValue(value: string): string | undefined {
  const candidate = key(value);
  return candidate === "a b" ? "NSE AB" : AUDIENCE_NSES.find(nse => [key(nse.value), key(nse.code)].includes(candidate))?.value;
}
/** Preserve unknown saved cuts as an empty choice, never replace them with total. */
export function restoreAudienceSelection(input: AudienceInput): AudienceSelection {
  return {
    ageRange: input.ageRange === undefined ? DEFAULT_AUDIENCE.ageRange : ageValue(input.ageRange) ?? "",
    sex: input.sex === undefined ? DEFAULT_AUDIENCE.sex : sexValue(input.sex) ?? "",
    socioeconomic: input.socioeconomic === undefined ? DEFAULT_AUDIENCE.socioeconomic : nseValue(input.socioeconomic) ?? "",
  };
}
/** Exact native combinations: TV has AB and children/adolescents; radio and
 * press have adults by sex; TGI has the two all-sex/all-NSE age bands. */
export function supportedAudienceSelection(input: AudienceInput): boolean {
  const selection = restoreAudienceSelection(input);
  if (!selection.ageRange || !selection.sex || !selection.socioeconomic) return false;
  if (selection.ageRange === "Personas 18+") return true;
  if (selection.sex !== "Todas las personas") return false;
  return ["3-11", "12-17"].includes(selection.ageRange) || selection.socioeconomic === "Todos los NSE";
}
export function audienceCohort(input: AudienceInput): AudienceCohort | null {
  if (!supportedAudienceSelection(input)) return null;
  const selection = restoreAudienceSelection(input);
  const age = AUDIENCE_AGES.find(age => age.value === selection.ageRange)!;
  return { ageMin: age.min, ageMax: age.max, sex: AUDIENCE_SEXES.find(sex => sex.value === selection.sex)!.code, nse: AUDIENCE_NSES.find(nse => nse.value === selection.socioeconomic)!.code };
}
/** Neither a broader age band, total sex nor total NSE can stand in for a cut. */
export function audienceMatchesSource(source: AudienceCohort, input: AudienceInput): boolean {
  if (!input.ageRange || !input.sex || !input.socioeconomic) return false;
  const requested = audienceCohort(input);
  const sex = sexValue(source.sex), nse = nseValue(source.nse);
  return !!requested && source.ageMin === requested.ageMin && source.ageMax === requested.ageMax
    && !!sex && !!nse && sex === restoreAudienceSelection(input).sex && nse === restoreAudienceSelection(input).socioeconomic;
}
/** Changing age retains other dimensions only if that complete cut exists. */
export function changeAudienceSelection(input: AudienceSelection, field: keyof AudienceSelection, value: string): AudienceSelection {
  const next = { ...input, [field]: value };
  if (supportedAudienceSelection(next)) return next;
  if (field !== "sex" && supportedAudienceSelection({ ...next, sex: DEFAULT_AUDIENCE.sex })) return { ...next, sex: DEFAULT_AUDIENCE.sex };
  if (field === "ageRange") return { ...DEFAULT_AUDIENCE, ageRange: value };
  return next;
}
export function audienceSelectionLabel(input: AudienceInput): string {
  const selection = restoreAudienceSelection(input);
  if (!supportedAudienceSelection(input)) return "";
  return [selection.sex, AUDIENCE_AGES.find(age => age.value === selection.ageRange)!.label, selection.socioeconomic].join(" · ");
}
