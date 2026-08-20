import type { MediaPlan } from "@/lib/planner";

export type Campaign = {
  key: "meta" | "google" | "tiktok" | "whatsapp";
  platform: string;
  icon: string;
  budget: number | null;
  objetivo: string;
  publico: string;
  formato: string;
  copy: string; // idea mostrada por defecto (= ideas[0])
  ideas: string[]; // banco de variaciones para "otra idea"
  extra?: { label: string; value: string };
  link: string;
  linkLabel: string;
};

export type CampaignInput = {
  keyword: string; // giro
  audience: string;
  objective: string;
};

function titulo(s: string) {
  return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function amountFor(plan: MediaPlan, includes: string): number | null {
  const row = plan.plan.find((r) => r.label.toLowerCase().includes(includes.toLowerCase()));
  return row?.amount ?? null;
}

/** Mezcla un arreglo (Fisher-Yates) para variar el orden en cada generacion. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Genera propuestas de campana por plataforma. Deterministico (no necesita el
 * modelo), pero ahora con un BANCO DE ANGULOS: cada plataforma trae varias
 * variaciones de copy, con distinto gancho y enfoque, para que las ideas no se
 * repitan. La UI puede pedir "otra idea" y rotar entre ellas.
 */
export function buildCampaigns(input: CampaignInput, plan: MediaPlan): Campaign[] {
  const giro = titulo(input.keyword || "tu negocio");
  const kw = input.keyword?.trim() || "tu negocio";
  const publico = input.audience?.trim() || "tu publico objetivo";
  const objetivo = input.objective?.trim() || "mas ventas y clientes";

  // ---- Meta: distintos angulos de venta ----
  const metaIdeas = shuffle([
    [
      `Titular: ${giro} que estabas buscando`,
      `Cuerpo: En ${giro} te damos justo lo que necesitas. Escribenos y recibe atencion al instante. Promo de bienvenida por tiempo limitado.`,
      `CTA: Enviar mensaje`,
    ].join("\n"),
    [
      `Titular: Lo que dicen nuestros clientes 💬`,
      `Cuerpo: Cientos de personas ya confian en ${giro}. Calidad, buen trato y resultados. Suma tu experiencia hoy.`,
      `CTA: Quiero probarlo`,
    ].join("\n"),
    [
      `Titular: ¿Cansado de lo mismo? Prueba ${giro}`,
      `Cuerpo: Resolvemos ${objetivo} sin complicarte. Rapido, cercano y a tu medida. Te mostramos como en 1 mensaje.`,
      `CTA: Escribir ahora`,
    ].join("\n"),
    [
      `Titular: Solo por esta semana 🔥`,
      `Cuerpo: Beneficio especial para nuevos clientes de ${giro}. Cupos limitados: aprovecha antes de que se acabe.`,
      `CTA: Aprovechar promo`,
    ].join("\n"),
    [
      `Titular: Hecho para ${publico}`,
      `Cuerpo: Pensamos ${giro} justo para ti. Descubre por que somos la mejor opcion y da el primer paso hoy.`,
      `CTA: Ver mas`,
    ].join("\n"),
  ]);

  // ---- Google: intencion de busqueda ----
  const googleIdeas = shuffle([
    [
      `Titular 1: ${giro} cerca de ti`,
      `Titular 2: Calidad y buen precio`,
      `Titular 3: Contactanos hoy`,
      `Descripcion: ${giro} con atencion rapida y confiable. Escribenos o llama y reserva ahora.`,
    ].join("\n"),
    [
      `Titular 1: El mejor ${kw} de la ciudad`,
      `Titular 2: Miles de clientes felices`,
      `Titular 3: Pide en linea`,
      `Descripcion: Descubre por que somos la opcion #1 en ${kw}. Facil, rapido y seguro.`,
    ].join("\n"),
    [
      `Titular 1: ${giro} a domicilio`,
      `Titular 2: Rapido y sin filas`,
      `Titular 3: Ordena ahora`,
      `Descripcion: Te lo llevamos donde estes. ${giro} con la comodidad que buscabas.`,
    ].join("\n"),
    [
      `Titular 1: ${giro} con descuento`,
      `Titular 2: Promo por tiempo limitado`,
      `Titular 3: Reserva hoy`,
      `Descripcion: Aprovecha precios especiales en ${kw}. Cupos limitados, no te quedes fuera.`,
    ].join("\n"),
  ]);

  // ---- TikTok: estilos de gancho ----
  const tiktokIdeas = shuffle([
    [
      `Gancho (0-3s): Esto es lo que nadie te cuenta de ${kw}...`,
      `Desarrollo (3-12s): muestra tu producto/servicio en accion, real y cercano.`,
      `CTA (12-15s): Siguenos y escribenos para probarlo hoy.`,
    ].join("\n"),
    [
      `Gancho (0-3s): POV: encontraste el mejor ${kw} de la ciudad 👀`,
      `Desarrollo (3-12s): plano corto y dinamico del antes/despues o del momento "wow".`,
      `CTA (12-15s): Comenta "yo" y te escribimos.`,
    ].join("\n"),
    [
      `Gancho (0-3s): 3 razones para elegir ${giro} 👇`,
      `Desarrollo (3-12s): tres cortes rapidos, cada uno con un beneficio.`,
      `CTA (12-15s): Guarda el video y visitanos.`,
    ].join("\n"),
    [
      `Gancho (0-3s): Story time: como ${giro} salvo mi dia`,
      `Desarrollo (3-12s): narra el problema y como lo resolviste con tu servicio.`,
      `CTA (12-15s): Escribenos y vive tu propia historia.`,
    ].join("\n"),
    [
      `Gancho (0-3s): Reto: prueba ${kw} y no te va a decepcionar`,
      `Desarrollo (3-12s): muestra la reaccion real de un cliente.`,
      `CTA (12-15s): Etiqueta a un amigo y vengan juntos.`,
    ].join("\n"),
  ]);

  // ---- WhatsApp: flujos de conversacion ----
  const whatsappIdeas = shuffle([
    [
      `Mensaje 1: Hola 👋 gracias por escribir a ${giro}. ¿En que te ayudo?`,
      `Mensaje 2: Mira nuestro catalogo y promos de hoy [enlace].`,
      `Mensaje 3: ¿Te agendo / preparo tu pedido? Responde y lo cerramos.`,
    ].join("\n"),
    [
      `Mensaje 1: ¡Que bueno verte por aqui! 🎉 En ${giro} tenemos algo para ti.`,
      `Mensaje 2: Cuentame que buscas y te armo la mejor opcion.`,
      `Mensaje 3: ¿Lo dejamos listo hoy? Tengo cupo disponible.`,
    ].join("\n"),
    [
      `Mensaje 1: Hola 👋 soy de ${giro}. ¿Es tu primera vez con nosotros?`,
      `Mensaje 2: Por ser nuevo cliente tienes un beneficio de bienvenida.`,
      `Mensaje 3: ¿Te lo activo ahora mismo?`,
    ].join("\n"),
    [
      `Mensaje 1: ¡Gracias por tu interes en ${giro}! 🙌`,
      `Mensaje 2: Estas son nuestras 3 opciones mas pedidas: [lista].`,
      `Mensaje 3: Dime cual te gusta y lo coordinamos al toque.`,
    ].join("\n"),
  ]);

  return [
    {
      key: "meta",
      platform: "Meta — Facebook e Instagram",
      icon: "📘",
      budget: amountFor(plan, "meta"),
      objetivo: `Mensajes y ventas — ${objetivo}`,
      publico,
      formato: "Reel + Historia + Imagen unica",
      copy: metaIdeas[0],
      ideas: metaIdeas,
      link: "https://business.facebook.com/adsmanager",
      linkLabel: "Abrir Meta Ads Manager",
    },
    {
      key: "google",
      platform: "Google — Busqueda y YouTube",
      icon: "🔎",
      budget: amountFor(plan, "google"),
      objetivo: `Captar demanda — ${objetivo}`,
      publico: `Personas buscando "${kw}" en tu ciudad`,
      formato: "Anuncios de busqueda + video YouTube",
      copy: googleIdeas[0],
      ideas: googleIdeas,
      extra: {
        label: "Palabras clave",
        value: `${kw}, ${kw} cerca de mi, mejor ${kw}, ${kw} a domicilio`,
      },
      link: "https://ads.google.com",
      linkLabel: "Abrir Google Ads",
    },
    {
      key: "tiktok",
      platform: "TikTok",
      icon: "🎵",
      budget: amountFor(plan, "tiktok"),
      objetivo: `Reconocimiento y alcance joven — ${objetivo}`,
      publico,
      formato: "Video vertical 9:16, 15-20s",
      copy: tiktokIdeas[0],
      ideas: tiktokIdeas,
      link: "https://ads.tiktok.com",
      linkLabel: "Abrir TikTok Ads",
    },
    {
      key: "whatsapp",
      platform: "WhatsApp Business",
      icon: "💬",
      budget: amountFor(plan, "whatsapp"),
      objetivo: `Cerrar ventas y atender — ${objetivo}`,
      publico: "Clientes que escriben desde tus anuncios",
      formato: "Mensajes + catalogo + respuestas rapidas",
      copy: whatsappIdeas[0],
      ideas: whatsappIdeas,
      link: "https://business.whatsapp.com",
      linkLabel: "Abrir WhatsApp Business",
    },
  ];
}
