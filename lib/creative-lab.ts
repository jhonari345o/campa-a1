export type CreativePlacement = "meta_reels" | "meta_feed" | "youtube_shorts" | "ooh";
export type CreativeAssetInput = { placement: CreativePlacement; mimeType: string; sizeBytes: number; width: number; height: number; durationSeconds: number | null; hasRights: boolean; hasSound: boolean; hasCaptions: boolean; cta: string };

export function reviewCreativeAsset(input: CreativeAssetInput) {
  const checks: Array<{ label: string; status: "pass" | "warning" | "fail"; detail: string }> = [];
  const ratio = input.height > 0 ? input.width / input.height : 0;
  const isVideo = input.mimeType.startsWith("video/");
  if (!input.width || !input.height) checks.push({ label: "Archivo", status: "fail", detail: "No fue posible leer las dimensiones." });
  else checks.push({ label: "Archivo", status: "pass", detail: `${input.width} × ${input.height}px · ${formatBytes(input.sizeBytes)}.` });
  if (input.placement === "meta_reels" || input.placement === "youtube_shorts") {
    checks.push(Math.abs(ratio - 9 / 16) <= 0.035 ? { label: "Formato vertical", status: "pass", detail: "Relación 9:16 adecuada para pantalla completa." } : { label: "Formato vertical", status: "warning", detail: "Conviene una versión 9:16; el recorte automático puede ocultar elementos." });
    if (!isVideo) checks.push({ label: "Movimiento", status: "warning", detail: "Una imagen puede publicarse, pero prepara una versión de video social-first." });
  } else if (input.placement === "meta_feed") checks.push(ratio >= 0.79 && ratio <= 1.02 ? { label: "Relación de aspecto", status: "pass", detail: "El activo cabe en 4:5 o 1:1 para feed." } : { label: "Relación de aspecto", status: "warning", detail: "Prepara una adaptación 4:5 o cuadrada para reducir recortes." });
  else checks.push(ratio >= 1.5 ? { label: "Formato OOH", status: "pass", detail: "Orientación horizontal; el proveedor confirmará medidas y plantilla final." } : { label: "Formato OOH", status: "warning", detail: "La pieza no parece horizontal; solicita la plantilla exacta del soporte." });
  if (input.width < 1080 && input.placement !== "ooh") checks.push({ label: "Resolución", status: "warning", detail: "Menos de 1080px puede perder nitidez en pantallas de alta densidad." });
  else checks.push({ label: "Resolución", status: "pass", detail: "Resolución base adecuada para revisión." });
  if (isVideo && input.durationSeconds != null) checks.push(input.durationSeconds <= 60 ? { label: "Duración", status: "pass", detail: `${input.durationSeconds.toFixed(1)} segundos.` } : { label: "Duración", status: "warning", detail: "Supera 60 segundos; prepara un corte breve para consumo vertical." });
  if (!input.hasRights) checks.push({ label: "Derechos", status: "fail", detail: "Confirma derechos comerciales de imagen, música, voz y material de terceros." });
  else checks.push({ label: "Derechos", status: "pass", detail: "Derechos declarados por el usuario; deben quedar documentados." });
  if (isVideo && !input.hasSound) checks.push({ label: "Audio", status: "warning", detail: "Para video vertical conviene una versión con audio y otra comprensible sin sonido." });
  if (isVideo && !input.hasCaptions) checks.push({ label: "Subtítulos", status: "warning", detail: "Añade subtítulos legibles dentro de la zona segura." });
  if (!input.cta.trim()) checks.push({ label: "CTA", status: "warning", detail: "Define una sola acción verificable para la pieza." });
  else checks.push({ label: "CTA", status: "pass", detail: `Acción declarada: ${input.cta.trim().slice(0, 80)}.` });
  const failures = checks.filter((item) => item.status === "fail").length;
  const warnings = checks.filter((item) => item.status === "warning").length;
  return { status: failures ? "blocked" as const : warnings ? "warning" as const : "ready" as const, score: Math.max(0, 100 - failures * 35 - warnings * 8), checks };
}

function formatBytes(value: number) { return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`; }
