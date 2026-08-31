export type CreativePreflightInput = {
  postUrl: string;
  platform: string;
  objective?: string;
  trackingReady?: boolean;
};

export type CreativePreflight = {
  status: "ready" | "warning" | "blocked";
  score: number;
  checks: Array<{ id: string; label: string; status: "pass" | "warning" | "fail"; detail: string }>;
  disclaimer: string;
};

const HOSTS: Record<string, string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com", "fb.watch", "m.facebook.com"],
};

export function creativePreflight(input: CreativePreflightInput): CreativePreflight {
  const platform = input.platform.toLowerCase();
  const checks: CreativePreflight["checks"] = [];
  let parsed: URL | null = null;
  try {
    parsed = new URL(input.postUrl);
  } catch {
    parsed = null;
  }
  checks.push(parsed && parsed.protocol === "https:"
    ? { id: "url", label: "Enlace seguro", status: "pass", detail: "El enlace usa HTTPS y tiene una estructura válida." }
    : { id: "url", label: "Enlace seguro", status: "fail", detail: "Pega una URL pública que empiece con https://." });

  const allowedHosts = HOSTS[platform] ?? [];
  const hostMatches = parsed ? allowedHosts.includes(parsed.hostname.toLowerCase()) : false;
  checks.push(hostMatches
    ? { id: "platform", label: "Plataforma", status: "pass", detail: `El enlace corresponde a ${platformLabel(platform)}.` }
    : { id: "platform", label: "Plataforma", status: "fail", detail: `El enlace debe pertenecer a ${platformLabel(platform)}.` });

  const isPermalink = Boolean(parsed && /\/(p|reel|reels|stories|watch|videos|posts)\//i.test(parsed.pathname));
  checks.push(isPermalink
    ? { id: "permalink", label: "Publicación identificable", status: "pass", detail: "La URL parece apuntar a una publicación concreta." }
    : { id: "permalink", label: "Publicación identificable", status: "warning", detail: "Confirma que el enlace abra directamente la publicación y no sólo el perfil." });

  checks.push(input.trackingReady
    ? { id: "tracking", label: "Medición", status: "pass", detail: "Se declaró tracking listo para validar el evento del objetivo." }
    : { id: "tracking", label: "Medición", status: "warning", detail: "Pixel/CAPI, destino y UTM deben confirmarse antes de optimizar a conversión." });

  checks.push({
    id: "creative",
    label: "Revisión creativa",
    status: "warning",
    detail: "Duración, resolución, márgenes seguros, audio, derechos y políticas se validan al importar el archivo o desde la cuenta publicitaria.",
  });

  const failures = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warning").length;
  const score = Math.max(0, 100 - failures * 40 - warnings * 10);
  return {
    status: failures ? "blocked" : warnings ? "warning" : "ready",
    score,
    checks,
    disclaimer: "Validación preliminar: no sustituye la revisión de políticas ni garantiza aprobación de la plataforma.",
  };
}

function platformLabel(platform: string) {
  return platform === "facebook" ? "Facebook" : platform === "instagram" ? "Instagram" : platform;
}
