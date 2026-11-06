import { randomBytes } from "crypto";

/** Quita acentos y deja solo letras A-Z. */
function slugLetters(input: string): string {
  const noAccents = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return noAccents || "AMK";
}

/** slug URL-safe para la empresa (usado como identificador legible). */
export function companySlug(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = randomBytes(2).toString("hex");
  return `${base || "cliente"}-${suffix}`;
}

/**
 * Genera un codigo de registro tipo AMK-2026-CRESA-7F3Q.
 * prefijo: hasta 5 letras del nombre del cliente.
 */
export function generateRegistrationCode(companyName: string): string {
  const year = new Date().getFullYear();
  const prefix = slugLetters(companyName).slice(0, 5);
  const suffix = randomBytes(2).toString("hex").toUpperCase(); // 4 chars
  return `AMK-${year}-${prefix}-${suffix}`;
}
