import landscapes from "./radio-landscapes.json";
export type RadioLandscape = { path: string; label: string; source: string; author: string; license: string; licenseUrl: string };
export const radioLandscapes: Record<string, RadioLandscape> = landscapes;
