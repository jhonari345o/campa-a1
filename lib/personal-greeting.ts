const nameKey = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();

/** Use the authenticated person's display name; never infer a person from an agency or email. */
export function personalGreeting(name?: string | null, workspaceName?: string): string {
  const clean = name?.trim().replace(/\s+/g, " ") ?? "";
  const first = clean.split(" ")[0], key = nameKey(clean), firstKey = nameKey(first);
  const generic = new Set(["vista", "usuario", "usuaria", "equipo", "medios", "agencia", "cliente", "administrador", "administradora", "admin", "ad"]);
  const company = workspaceName ? nameKey(workspaceName) : "";
  if (!clean || clean.includes("@") || generic.has(firstKey) || (company && (key === company || firstKey === company.split(" ")[0]))) return "Hola.";
  return `Hola, ${first}.`;
}
