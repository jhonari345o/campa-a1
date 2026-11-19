export type OohPhotoCrop = { left: number; top: number; width: number; height: number; sourceWidth: number; sourceHeight: number };
export type OohPhotoPresentation = { kind: "photo"; crop: OohPhotoCrop | null } | { kind: "map" | "document" };

/** A verified source-page crop extracts the original photograph without recreating the asset. */
export function oohPhotoPresentation(value: unknown): OohPhotoPresentation | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return { kind: "document" };
  const row = value as Record<string, unknown>;
  if (row.kind === "map" || row.kind === "document") return { kind: row.kind };
  if (row.kind !== "photo") return { kind: "document" };
  if (row.crop == null) return { kind: "photo", crop: null };
  if (typeof row.crop !== "object" || Array.isArray(row.crop)) return { kind: "document" };
  const crop = row.crop as OohPhotoCrop;
  if (![crop.left, crop.top, crop.width, crop.height, crop.sourceWidth, crop.sourceHeight].every(Number.isSafeInteger)
    || crop.left < 0 || crop.top < 0 || crop.width < 10 || crop.height < 10
    || crop.sourceWidth > 20_000 || crop.sourceHeight > 20_000
    || crop.left + crop.width > crop.sourceWidth || crop.top + crop.height > crop.sourceHeight) return { kind: "document" };
  return { kind: "photo", crop: { left: crop.left, top: crop.top, width: crop.width, height: crop.height, sourceWidth: crop.sourceWidth, sourceHeight: crop.sourceHeight } };
}
