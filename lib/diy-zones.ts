import type { OohLocationOption } from "./media-workspace";
export const FALLBACK_OOH: OohLocationOption[] = [
  zone("mall-del-sol", "Entorno Mall del Sol", "Guayaquil", -2.155041, -79.892686),
  zone("san-marino", "Entorno San Marino Shopping", "Guayaquil", -2.169141, -79.898269),
  zone("carlos-julio", "Av. Carlos Julio Arosemena · Albán Borja", "Guayaquil", -2.168693, -79.916651),
  zone("orellana", "Av. Francisco de Orellana · WTC", "Guayaquil", -2.163501, -79.897987),
  zone("25-julio", "Av. 25 de Julio · Mall del Sur", "Guayaquil", -2.227227, -79.897963),
  zone("urdesa", "Urdesa · Víctor Emilio Estrada", "Guayaquil", -2.176354, -79.905004),
  zone("plaza-lagos", "Plaza Lagos · Av. Samborondón", "Samborondón", -2.098392, -79.875193),
];
function zone(id: string, name: string, city: string, latitude: number, longitude: number): OohLocationOption { return { id, assetCode: id, status: "zone_candidate", providerName: null, name, city, province: "Guayas", address: name, latitude, longitude, format: "Zona para búsqueda de inventario", monthlyRateUsd: null, productionRateUsd: null, audienceTags: ["adultos 25-45 · hipótesis"], contextTags: ["movilidad urbana"], affluenceIndex: null, sourceNote: "Zona candidata; requiere proveedor, flujo, tarifa y disponibilidad.", verifiedAt: "2026-08-27" }; }

