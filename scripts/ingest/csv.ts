import { readFileSync } from "node:fs";

/**
 * Parser CSV minimo y robusto (comillas, comas y saltos de linea dentro de
 * campos entre comillas). Sin dependencias externas.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((v) => v !== "")) rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

export function readCsv(path: string): Record<string, string>[] {
  return parseCsv(readFileSync(path, "utf8"));
}

/** Convierte texto a numero o null. Tolera separadores de miles. */
export function toNumber(v: string | undefined): number | null {
  if (v == null) return null;
  const s = v.replace(/[^0-9.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function toStatus(v: string | undefined): "verificado" | "pendiente" {
  return String(v ?? "").trim().toLowerCase() === "verificado" ? "verificado" : "pendiente";
}
