export type JobStatus =
  | "pendiente"
  | "en_proceso"
  | "listo_para_revision"
  | "publicada"
  | "error"
  | "cancelada";

export const JOB_STATUS: Record<JobStatus, { label: string; tone: "amber" | "sky" | "signal" | "coral" | "muted" }> = {
  pendiente: { label: "Pendiente", tone: "amber" },
  en_proceso: { label: "En proceso", tone: "sky" },
  listo_para_revision: { label: "Listo para revisar", tone: "signal" },
  publicada: { label: "Publicada", tone: "signal" },
  error: { label: "Error", tone: "coral" },
  cancelada: { label: "Cancelada", tone: "muted" },
};

export const PLATFORM_LABEL: Record<string, string> = {
  meta: "Meta — Facebook e Instagram",
  google: "Google — Busqueda y YouTube",
  tiktok: "TikTok",
  whatsapp: "WhatsApp Business",
};
