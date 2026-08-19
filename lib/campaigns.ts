import type { MediaPlan } from "@/lib/planner";

export type Campaign = {
  platform: string;
  icon: string;
  budget: number | null;
  objetivo: string;
  publico: string;
  formato: string;
  copy: string; // texto listo para usar (multilinea)
  extra?: { label: string; value: string };
  link: string;
  linkLabel: string;
};

export type CampaignInput = {
  keyword: string; // giro
  audience: string;
  objective: string;
};

function titdulo(s: string) {
  return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function amountFor(plan: MediaPlan, includes: string): number | null {
  const row = plan.plan.find((r) => r.label.toLowerCase().includes(includes.toLowerCase()));
  return row?.amount ?? null;
}

/**
 * Genera propuestas de campana por plataforma a partir del plan de medios.
 * Deterministico (no necesita el modelo): usa el giro, publico, objetivo y el
 * presupuesto por canal. Mavi las presenta y luego el equipo las ejecuta.
 */
export function buildCampaigns(input: CampaignInput, plan: MediaPlan): Campaign[] {
  const giro = titdulo(input.keyword || "tu negocio");
  const publico = input.audience?.trim() || "tu publico objetivo";
  const objetivo = input.objective?.trim() || "mas ventas y clientes";

  return [
    {
      platform: "Meta — Facebook e Instagram",
      icon: "📘",
      budget: amountFor(plan, "meta"),
      objetivo: `Mensajes y ventas — ${objetivo}`,
      publico: publico,
      formato: "Reel + Historia + Imagen unica",
      copy: [
        `Titular: ${giro} que estabas buscando`,
        `Cuerpo: En ${giro} te damos justo lo que necesitas. Escribenos y recibe atencion al instante. Promo de bienvenida por tiempo limitado.`,
        `CTA: Enviar mensaje`,
      ].join("\n"),
      link: "https://business.facebook.com/adsmanager",
      linkLabel: "Abrir Meta Ads Manager",
    },
    {
      platform: "Google — Busqueda y YouTube",
      icon: "🔎",
      budget: amountFor(plan, "google"),
      objetivo: `Captar demanda — ${objetivo}`,
      publico: `Personas buscando "${input.keyword}" en tu ciudad`,
      formato: "Anuncios de busqueda + video YouTube",
      copy: [
        `Titular 1: ${giro} cerca de ti`,
        `Titular 2: Calidad y buen precio`,
        `Titular 3: Contactanos hoy`,
        `Descripcion: ${giro} con atencion rapida y confiable. Escribenos o llama y reserva ahora.`,
      ].join("\n"),
      extra: {
        label: "Palabras clave",
        value: `${input.keyword}, ${input.keyword} cerca de mi, mejor ${input.keyword}, ${input.keyword} a domicilio`,
      },
      link: "https://ads.google.com",
      linkLabel: "Abrir Google Ads",
    },
    {
      platform: "TikTok",
      icon: "🎵",
      budget: amountFor(plan, "tiktok"),
      objetivo: `Reconocimiento y alcance joven — ${objetivo}`,
      publico: publico,
      formato: "Video vertical 9:16, 15-20s",
      copy: [
        `Gancho (0-3s): Esto es lo que nadie te cuenta de ${input.keyword}...`,
        `Desarrollo (3-12s): muestra tu producto/servicio en accion, real y cercano.`,
        `CTA (12-15s): Siguenos y escribenos para probarlo hoy.`,
      ].join("\n"),
      link: "https://ads.tiktok.com",
      linkLabel: "Abrir TikTok Ads",
    },
    {
      platform: "WhatsApp Business",
      icon: "💬",
      budget: amountFor(plan, "whatsapp"),
      objetivo: `Cerrar ventas y atender — ${objetivo}`,
      publico: "Clientes que escriben desde tus anuncios",
      formato: "Mensajes + catalogo + respuestas rapidas",
      copy: [
        `Mensaje 1: Hola 👋 gracias por escribir a ${giro}. ¿En que te ayudo?`,
        `Mensaje 2: Mira nuestro catalogo y promos de hoy [enlace].`,
        `Mensaje 3: ¿Te agendo / preparo tu pedido? Responde y lo cerramos.`,
      ].join("\n"),
      link: "https://business.whatsapp.com",
      linkLabel: "Abrir WhatsApp Business",
    },
  ];
}
