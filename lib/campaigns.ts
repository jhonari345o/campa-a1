import { strategicProfileFor, type MediaPlan } from "@/lib/planner";

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
  brand?: string;
  geography?: string;
  audienceType?: string;
  ageRange?: string;
  socioeconomic?: string;
  businessModel?: string;
  conversionModel?: string;
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
  const marca = input.brand?.trim() || giro;
  const zona = input.geography?.trim() || "la zona prioritaria";
  const publicoBase = input.audience?.trim() || `${input.audienceType || "personas"} interesadas en ${kw}`;
  const publico = `${publicoBase} · ${input.ageRange || "edad por validar"} · ${zona}`;
  const objetivo = input.objective?.trim() || "mas ventas y clientes";
  const conversion = input.conversionModel?.trim() || "mensaje, visita o compra";
  const profile = strategicProfileFor(kw, input.audienceType, input.businessModel);

  // ---- Meta: distintos angulos de venta ----
  const metaIdeas = shuffle([
    [
      `Ángulo: beneficio específico · ${profile.promise}`,
      `Titular: ${marca}: ${profile.promise}`,
      `Cuerpo: Mostramos ${profile.proof} para que ${publicoBase} entienda la diferencia. La pieza aterriza en ${conversion} y se limita a ${zona}.`,
      `CTA: Conocer la propuesta`,
    ].join("\n"),
    [
      `Ángulo: evidencia antes que promesa`,
      `Titular: Mira cómo funciona ${marca}`,
      `Cuerpo: Secuencia de ${profile.proof}. Evita frases genéricas: incluye un dato, condición o demostración que la marca pueda comprobar.`,
      `CTA: Ver cómo funciona`,
    ].join("\n"),
    [
      `Ángulo: problema → solución`,
      `Titular: Una forma más clara de lograr ${objetivo.toLowerCase()}`,
      `Cuerpo: Abre con una tensión real del público y demuestra cómo ${marca} la resuelve mediante ${profile.promise}. Cierra hacia ${profile.offer}.`,
      `CTA: Dar el siguiente paso`,
    ].join("\n"),
    [
      `Ángulo: oferta verificable`,
      `Titular: ${profile.offer}`,
      `Cuerpo: Publica una condición real —vigencia, cobertura en ${zona} y restricciones—. Sin escasez inventada ni resultados garantizados.`,
      `CTA: Revisar condiciones`,
    ].join("\n"),
    [
      `Ángulo: relevancia local`,
      `Titular: ${marca} en ${zona}`,
      `Cuerpo: Adapta la escena, vocabulario y prueba a ${publicoBase}. La ubicación tiene que sentirse parte de la idea, no solo de la segmentación.`,
      `CTA: Encontrar la opción cercana`,
    ].join("\n"),
  ]);

  // ---- Google: intencion de busqueda ----
  const googleIdeas = shuffle([
    [
      `Grupo: intención alta · ${zona}`,
      `Titular 1: ${giro} en ${zona}`,
      `Titular 2: ${marca} · ${profile.promise}`,
      `Titular 3: ${profile.offer}`,
      `Descripción: Responde la búsqueda con ${profile.proof} y lleva a ${conversion}.`,
    ].join("\n"),
    [
      `Grupo: problema o necesidad`,
      `Titular 1: Solución de ${kw}`,
      `Titular 2: Compara antes de decidir`,
      `Titular 3: Habla con ${marca}`,
      `Descripción: Explica una diferencia comprobable y la condición de ${profile.offer}.`,
    ].join("\n"),
    [
      `Grupo: marca y confianza`,
      `Titular 1: ${marca} oficial`,
      `Titular 2: ${profile.proof}`,
      `Titular 3: Información y condiciones`,
      `Descripción: Protege búsquedas de marca y dirige a una página coherente con ${conversion}.`,
    ].join("\n"),
    [
      `Grupo: categoría + decisión`,
      `Titular 1: Opciones de ${kw}`,
      `Titular 2: Elige con información clara`,
      `Titular 3: Cotiza en ${zona}`,
      `Descripción: Usa extensiones de ubicación, llamada y precio solo cuando los datos estén vigentes.`,
    ].join("\n"),
  ]);

  // ---- TikTok: estilos de gancho ----
  const tiktokIdeas = shuffle([
    [
      `Gancho (0-3s): ¿Qué cambia cuando eliges ${marca}?`,
      `Desarrollo (3-12s): demuestra ${profile.proof} en una situación real de ${zona}.`,
      `CTA (12-15s): ${profile.offer}.`,
    ].join("\n"),
    [
      `Gancho (0-3s): POV: necesitas ${profile.promise}`,
      `Desarrollo (3-12s): presenta problema, uso y evidencia; rótulos con datos que la marca pueda verificar.`,
      `CTA (12-15s): Escribe para ${conversion}.`,
    ].join("\n"),
    [
      `Gancho (0-3s): 3 señales para elegir ${kw} sin equivocarte`,
      `Desarrollo (3-12s): tres criterios útiles; el tercero conecta de forma natural con ${marca}.`,
      `CTA (12-15s): Guarda la guía y revisa ${profile.offer}.`,
    ].join("\n"),
    [
      `Gancho (0-3s): Lo probamos en ${zona}: esto pasó`,
      `Desarrollo (3-12s): microhistoria con contexto, demostración y resultado sin exagerar causalidad.`,
      `CTA (12-15s): Conoce cómo funciona ${marca}.`,
    ].join("\n"),
    [
      `Gancho (0-3s): Pregunta real de un cliente sobre ${kw}`,
      `Desarrollo (3-12s): responde con ${profile.proof}, subtítulos y una objeción concreta.`,
      `CTA (12-15s): Envía tu pregunta a ${marca}.`,
    ].join("\n"),
  ]);

  // ---- WhatsApp: flujos de conversacion ----
  const whatsappIdeas = shuffle([
    [
      `Mensaje 1: Hola 👋 Soy del equipo de ${marca}. ¿Buscas información, precio o disponibilidad en ${zona}?`,
      `Mensaje 2: Según tu respuesta, comparte una sola opción con condiciones y ${profile.proof}.`,
      `Mensaje 3: ¿Avanzamos con ${conversion}?`,
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
