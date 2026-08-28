export const LEGAL_VERSIONS = {
  terms: "2026-08-28",
  privacy: "2026-08-28",
  treatment: "2026-08-28",
  payments: "2026-08-28",
} as const;

export const PRIVACY_EMAIL = "direccion@adsmaverick.me";
export const BILLING_EMAIL = "direccion@adsmaverick.me";

export const REQUIRED_PROCESSING_PURPOSES = [
  "Autenticar la cuenta y administrar los accesos de la empresa.",
  "Preparar, guardar, revisar y ejecutar planes, órdenes y campañas solicitadas.",
  "Procesar pagos mediante proveedores externos y mantener evidencia contable y antifraude.",
  "Usar proveedores de infraestructura, IA, medición, pagos y medios, incluso cuando exista una transferencia internacional necesaria.",
  "Conservar registros durante la relación y por los plazos legales, contractuales, de seguridad o defensa de reclamaciones aplicables.",
] as const;

export function safeInternalReturnPath(value: FormDataEntryValue | null, fallback = "/panel") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://adsmaverick.me");
    return url.origin === "https://adsmaverick.me" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
