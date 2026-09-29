export type CatalogSection = "tv" | "radio" | "ooh" | "press" | "digital" | "influencers";
export type CatalogStatus = "cotizable" | "validacion" | "directorio";

export type CatalogItem = {
  slug: string;
  name: string;
  imagePath?: string;
  status: CatalogStatus;
  statusNote: string;
  summary: string;
  detail: string;
  coverage?: string;
  incorporated?: string[];
  pending?: string[];
  count?: number;
};

export type DigitalPlatform = CatalogItem & {
  objective: string;
  formats: string;
  measurement: string;
};

export type RadioStation = {
  name: string;
  genre: string | null;
  rating: number | null;
  share: number | null;
  audience: number | null;
  reach: number | null;
  reachPct: number | null;
  audienceRank: number | null;
  reachRank: number | null;
  imagePath: string | null;
};

export type InfluencerRate = { format: string; amountUsd: number };
export type InfluencerProfile = {
  id: string;
  slug: string;
  category: "deportes" | "foodie" | "beauty";
  name: string;
  handle: string | null;
  platform: string | null;
  profileUrl: string | null;
  followers: number | null;
  avgViews: number | null;
  engagementPct: number | null;
  followerQualityPct: number | null;
  rates: InfluencerRate[];
};

export const CATALOG_SECTIONS: { id: CatalogSection; label: string; description: string }[] = [
  { id: "tv", label: "Televisión", description: "Canales y grupos" },
  { id: "radio", label: "Radio", description: "Cobertura y rankings" },
  { id: "ooh", label: "Vía pública", description: "Proveedores e inventario" },
  { id: "press", label: "Prensa", description: "Medios por cobertura" },
  { id: "digital", label: "Digital", description: "Plataformas y objetivos" },
  { id: "influencers", label: "Influenciadores", description: "Perfiles por categoría" },
];

export const DIGITAL_PLATFORMS: DigitalPlatform[] = [
  {
    slug: "google-ads", name: "Google Ads", imagePath: "/providers/digital/google-ads.svg", status: "cotizable",
    statusNote: "Inversión definida en el plan",
    summary: "Capturar intención de búsqueda y ampliar cobertura con video y display.",
    detail: "Selección por objetivo, audiencia, medición, destino e inversión.",
    objective: "Intención, cobertura y acción",
    formats: "Search, YouTube, Display y soluciones automatizadas según el objetivo.",
    measurement: "Conversión, valor, leads y visitas cuando el tracking está preparado.",
  },
  {
    slug: "meta-ads", name: "Meta Ads", imagePath: "/providers/digital/meta.svg", status: "cotizable",
    statusNote: "Inversión definida en el plan",
    summary: "Construir alcance, consideración y resultados en Facebook e Instagram.",
    detail: "Selección por objetivo, audiencia, medición, destino e inversión.",
    objective: "Alcance, consideración y resultados",
    formats: "Video, reels, stories, tráfico, leads, ventas y remarketing según medición disponible.",
    measurement: "Alcance, frecuencia, leads, ventas y eventos según pixel/CAPI y atribución disponible.",
  },
  {
    slug: "linkedin-ads", name: "LinkedIn Ads", imagePath: "/providers/digital/linkedin.svg", status: "cotizable",
    statusNote: "Inversión definida en el plan",
    summary: "Conectar con audiencias profesionales y decisores en estrategias B2B.",
    detail: "Selección por objetivo, audiencia, medición, destino e inversión.",
    objective: "Audiencias profesionales y B2B",
    formats: "Contenido patrocinado, generación de leads y video por perfil profesional.",
    measurement: "Impresiones, leads y calidad de audiencia profesional según integración disponible.",
  },
  {
    slug: "tiktok-ads", name: "TikTok Ads", imagePath: "/providers/digital/tiktok.svg", status: "cotizable",
    statusNote: "Inversión definida en el plan",
    summary: "Generar descubrimiento, atención y acción con video vertical y códigos culturales de la plataforma.",
    detail: "Selección por objetivo, audiencia, medición, destino e inversión.",
    objective: "Descubrimiento, atención y acción",
    formats: "Reach, video views, tráfico, leads, conversiones y catálogos según objetivo y medición disponible.",
    measurement: "Alcance, frecuencia, visualizaciones, leads y conversiones según pixel, Events API y atribución disponible.",
  },
  {
    slug: "spotify-ads", name: "Spotify Ads", imagePath: "/providers/digital/spotify.svg", status: "cotizable",
    statusNote: "Inversión definida en el plan",
    summary: "Sumar cobertura y contexto de escucha con audio, video y formatos display.",
    detail: "Selección por objetivo, audiencia, medición, destino e inversión.",
    objective: "Cobertura y contexto de escucha",
    formats: "Audio, video, display y patrocinios según audiencia, plaza, objetivo y disponibilidad.",
    measurement: "Impresiones, alcance y frecuencia reportados por plataforma; acciones posteriores con tracking compatible.",
  },
  {
    slug: "pinterest-ads", name: "Pinterest Ads", imagePath: "/providers/digital/pinterest.svg", status: "cotizable",
    statusNote: "Inversión definida en el plan",
    summary: "Aparecer durante procesos de inspiración, planificación y descubrimiento de productos.",
    detail: "Selección por objetivo, audiencia, medición, destino e inversión.",
    objective: "Inspiración y descubrimiento",
    formats: "Awareness, consideración, tráfico, catálogos y conversiones según categoría y medición disponible.",
    measurement: "Impresiones, vistas, clics, guardados y conversiones según etiqueta, API y atribución disponible.",
  },
  {
    slug: "programmatic-dsp", name: "Programmatic · Ad Mavericks DSP", imagePath: "/providers/digital/ad-mavericks-programmatic.svg", status: "cotizable",
    statusNote: "Inversión definida en el plan",
    summary: "Activar inventario digital de múltiples publishers desde una compra centralizada.",
    detail: "Selección por objetivo, audiencia, medición, destino e inversión.",
    objective: "Compra centralizada y cobertura",
    formats: "Display, video, audio, native y otros formatos según inventario, brand safety y objetivo de campaña.",
    measurement: "Impresiones, viewability, alcance y frecuencia cuando el DSP y la fuente de identidad permiten una lectura compatible.",
  },
];

export const TV_CHANNELS: CatalogItem[] = [
  { slug: "ecuavisa", name: "Ecuavisa", imagePath: "/providers/tv/ecuavisa.png", status: "validacion", statusNote: "Referencia histórica · junio 2026", summary: "Programación informativa, entretenimiento y formatos de alcance masivo.", detail: "Cobertura comercial por confirmar en cada planificación.", incorporated: ["Parrilla Guayaquil/Quito", "Tarifario 30s histórico", "Ratings para planificación"], pending: ["Tarifario vigente", "Disponibilidad", "Negociación final", "Curva de reach/frecuencia"], count: 45 },
  { slug: "red-comercial", name: "Red Comercial", imagePath: "/providers/tv/red-comercial.png", status: "cotizable", statusNote: "Cotizable · agosto 2026", summary: "Canal y grupo comercial para planes de televisión.", detail: "Programación, frecuencia e inversión se confirman en la cotización." },
  { slug: "teleamazonas", name: "Teleamazonas", imagePath: "/providers/tv/teleamazonas.png", status: "validacion", statusNote: "Tarifario julio 2026 · reconfirmar", summary: "Programación nacional, noticias y entretenimiento.", detail: "Tarifario, disponibilidad y negociación final por reconfirmar." },
  { slug: "tc-television", name: "TC Televisión", imagePath: "/providers/tv/tc-television.png", status: "cotizable", statusNote: "Cotizable · julio 2026", summary: "Televisión abierta con entretenimiento, noticias y formatos masivos.", detail: "Programación y condiciones comerciales sujetas a confirmación." },
  { slug: "oromar-tv", name: "Oromar TV", imagePath: "/providers/tv/oromar-tv.png", status: "directorio", statusNote: "Información comercial en carga", summary: "Canal de televisión abierta incorporado al directorio.", detail: "Tarifario, disponibilidad y cobertura comercial en carga." },
  { slug: "catomedia-ucsg", name: "Catomedia · UCSG TV", imagePath: "/providers/catomedia/catomedia-logo.png", status: "cotizable", statusNote: "Julio 2026 · reconfirmar", summary: "Oferta televisiva y comercial de UCSG TV.", detail: "Vigencia, disponibilidad y condiciones por reconfirmar." },
  { slug: "ecuador-tv", name: "Ecuador TV", imagePath: "/providers/tv/ecuador-tv.png", status: "directorio", statusNote: "Información comercial en carga", summary: "Canal público incorporado al directorio nacional.", detail: "Información comercial y disponibilidad en carga." },
];

export const OOH_PROVIDERS: CatalogItem[] = [
  { slug: "gran-comercio", name: "Gran Comercio", imagePath: "/providers/ooh/gran-comercio/logo.png", status: "validacion", statusNote: "En normalización", summary: "Proveedor de vía pública con catálogo detallado en proceso de normalización.", detail: "Presentación comercial recibida; ubicaciones, imágenes y disponibilidad en normalización." },
  { slug: "duoprint", name: "Duoprint", imagePath: "/providers/ooh/duoprint/logo.png", status: "cotizable", statusNote: "130 fichas incorporadas", summary: "Formatos digitales, tradicionales, centros comerciales, Aerovía y experiencias especiales.", detail: "Catálogo comercial 2026 normalizado; valores sin IVA y disponibilidad por reconfirmar.", coverage: "El Oro, Guayas, Imbabura, Manabí, Morona Santiago, Nacional, Pastaza, Pichincha, Santa Elena y Tungurahua", count: 130 },
  { slug: "zazapec", name: "Zazapec", imagePath: "/providers/ooh/zazapec/logo.png", status: "cotizable", statusNote: "180 fichas incorporadas", summary: "Inventario territorial de publicidad exterior.", detail: "Ubicaciones, imágenes, formatos y tarifas incorporadas; disponibilidad por reconfirmar.", count: 180 },
  { slug: "creamedios", name: "Creamedios", imagePath: "/providers/ooh/creamedios/logo.png", status: "directorio", statusNote: "En carga", summary: "Proveedor de publicidad exterior incorporado al directorio.", detail: "Inventario y condiciones comerciales en carga." },
  { slug: "induvallas", name: "Induvallas", imagePath: "/providers/ooh/induvallas/logo.png", status: "directorio", statusNote: "En carga", summary: "Proveedor de publicidad exterior incorporado al directorio.", detail: "Inventario y condiciones comerciales en carga." },
  { slug: "basics", name: "Basics", status: "directorio", statusNote: "En carga", summary: "Proveedor incorporado al directorio de vía pública.", detail: "Inventario y condiciones comerciales en carga." },
  { slug: "independientes", name: "Titulares independientes en validación", status: "validacion", statusNote: "2 fichas incorporadas", summary: "Colección de titulares y activos independientes.", detail: "Identidad, ubicación, disponibilidad y condiciones por validar.", count: 2 },
];

export const PRESS_OUTLETS: CatalogItem[] = [
  { slug: "el-universo", name: "El Universo", imagePath: "/providers/press/el-universo.png", status: "validacion", statusNote: "Planificación editorial 2026 en validación", summary: "Noticias, actualidad y formatos editoriales impresos.", detail: "Nacional; tarifas publicables, edición y disponibilidad por confirmar." },
  { slug: "el-comercio", name: "El Comercio", imagePath: "/providers/press/el-comercio.png", status: "directorio", statusNote: "Ficha de directorio", summary: "Noticias, análisis y formatos editoriales impresos.", detail: "Tarifario, formatos, ediciones y disponibilidad pendientes." },
  { slug: "expreso", name: "Expreso", imagePath: "/providers/press/expreso.png", status: "directorio", statusNote: "Ficha de directorio", summary: "Actualidad y contenidos informativos impresos.", detail: "Tarifario, formatos, ediciones y disponibilidad pendientes." },
  { slug: "extra", name: "Extra", imagePath: "/providers/press/extra.png", status: "directorio", statusNote: "Ficha de directorio", summary: "Noticias, entretenimiento y formatos editoriales de alta circulación.", detail: "Tarifario, formatos, ediciones y disponibilidad pendientes." },
  { slug: "metro-ecuador", name: "Metro Ecuador", imagePath: "/providers/press/metro.png", status: "cotizable", statusNote: "Catálogo comercial 2026", summary: "Formatos impresos estándar, premium y especiales, content marketing, display, redes y Nueva Mujer.", detail: "73 formatos incorporados; ECU equivale a Quito + Guayaquil + Cuenca, no a cobertura nacional total.", count: 73 },
  { slug: "diario-opinion", name: "Diario Opinión", status: "validacion", statusNote: "Tarifa y disponibilidad por confirmar", summary: "Publicación local para evaluar por afinidad, contexto y cobertura territorial.", detail: "Machala, El Oro; medio independiente con identidad contrastada." },
  { slug: "semanario-la-noticia", name: "Semanario La Noticia", status: "validacion", statusNote: "Tarifa y disponibilidad por confirmar", summary: "Publicación local para evaluar por afinidad, contexto y cobertura territorial.", detail: "Vinces, Los Ríos; medio independiente con identidad contrastada." },
];

export const STATUS_LABELS: Record<CatalogStatus, string> = {
  cotizable: "Cotizable",
  validacion: "En validación",
  directorio: "Solo directorio",
};

/** El portal fuente solo tiene fotografía para estos 30 perfiles. */
export const INFLUENCER_IMAGE_SLUGS = new Set([
  "gabriela-gomez", "raquel-ochoa", "tono-valencia", "joel-arrobo", "jamil-faour",
  "lucho-bresciani", "andrea-cobo", "yerson-palma", "gray-martinez", "ricardo-pino",
  "santiago-bucaram", "joel-alvarado", "nathaly-chong", "romina-rendon", "berchoman",
  "richard-salazar", "fabri-alvarado", "apugol", "zulay-lisseth", "cristian-santos",
  "melissa-pergola", "carla-bruno", "sofi-reynes", "andrea-heras", "cris-torres",
  "mare-cevallos", "nicole-delgado", "domenica-espinoza", "debora-delgado", "gene-campuzano",
]);
