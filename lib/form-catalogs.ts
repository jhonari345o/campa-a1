export type CatalogOption = Readonly<{ value: string; label: string }>;

/**
 * Catálogos cerrados compartidos por el brief y la carga administrativa.
 * Los valores son legibles porque también alimentan el análisis estratégico de Mavi.
 */
export const BUSINESS_CATEGORY_OPTIONS: readonly CatalogOption[] = [
  { value: "Restaurantes, alimentos y bebidas", label: "Restaurantes, alimentos y bebidas" },
  { value: "Retail, comercio y e-commerce", label: "Retail, comercio y e-commerce" },
  { value: "Salud, clínicas y bienestar", label: "Salud, clínicas y bienestar" },
  { value: "Finanzas, banca, seguros y fintech", label: "Finanzas, banca, seguros y fintech" },
  { value: "Automotriz, vehículos y movilidad", label: "Automotriz, vehículos y movilidad" },
  { value: "Inmobiliario y construcción", label: "Inmobiliario y construcción" },
  { value: "Educación, cursos y capacitación", label: "Educación, cursos y capacitación" },
  { value: "Tecnología, software y aplicaciones", label: "Tecnología, software y aplicaciones" },
  { value: "Servicios profesionales y B2B", label: "Servicios profesionales y B2B" },
  { value: "Turismo, viajes y hotelería", label: "Turismo, viajes y hotelería" },
  { value: "Belleza y cuidado personal", label: "Belleza y cuidado personal" },
  { value: "Entretenimiento, cultura y eventos", label: "Entretenimiento, cultura y eventos" },
  { value: "Telecomunicaciones e internet", label: "Telecomunicaciones e internet" },
  { value: "Gobierno e instituciones públicas", label: "Gobierno e instituciones públicas" },
  { value: "ONG y causas sociales", label: "ONG y causas sociales" },
  { value: "Deportes y fitness", label: "Deportes y fitness" },
  { value: "Hogar, muebles y decoración", label: "Hogar, muebles y decoración" },
  { value: "Moda, calzado y accesorios", label: "Moda, calzado y accesorios" },
  { value: "Logística, transporte e industria", label: "Logística, transporte e industria" },
  { value: "Agricultura, agroindustria y alimentos", label: "Agricultura, agroindustria y alimentos" },
  { value: "Energía y servicios básicos", label: "Energía y servicios básicos" },
  { value: "Mascotas y servicios veterinarios", label: "Mascotas y servicios veterinarios" },
  { value: "Otro o por definir", label: "Otro o por definir" },
];

export const ECUADOR_PROVINCE_OPTIONS: readonly CatalogOption[] = [
  "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi", "El Oro", "Esmeraldas",
  "Galápagos", "Guayas", "Imbabura", "Loja", "Los Ríos", "Manabí", "Morona Santiago", "Napo",
  "Orellana", "Pastaza", "Pichincha", "Santa Elena", "Santo Domingo de los Tsáchilas", "Sucumbíos",
  "Tungurahua", "Zamora Chinchipe",
].map((value) => ({ value, label: value }));

export const WOW_FORMAT_OPTIONS: readonly CatalogOption[] = optionList([
  "Mapping o proyección audiovisual",
  "Mural o intervención artística",
  "Corpóreo o estructura tridimensional",
  "Banderines, pendones o elementos aéreos",
  "Activación experiencial o BTL",
  "Instalación interactiva",
  "Mobiliario urbano especial",
  "Evento, pop-up o lanzamiento",
  "Otro formato o por definir",
]);

export const WOW_SURFACE_OPTIONS: readonly CatalogOption[] = optionList([
  "Fachada o edificio privado",
  "Espacio público",
  "Centro comercial o local",
  "Valla o estructura publicitaria",
  "Vehículo o unidad móvil",
  "Escenario o recinto de eventos",
  "Pantalla o soporte digital",
  "Otro soporte o por confirmar",
]);

export const COMMERCIAL_GOAL_UNIT_OPTIONS: readonly CatalogOption[] = optionList([
  "Ventas o transacciones",
  "Unidades vendidas",
  "Leads calificados",
  "Cotizaciones o solicitudes",
  "Reservas",
  "Matrículas o inscripciones",
  "Visitas al local",
  "Conversaciones por WhatsApp",
  "Suscripciones",
  "Descargas o instalaciones",
  "Otro indicador o por definir",
]);

export const COMMERCIAL_KPI_OPTIONS: readonly CatalogOption[] = optionList([
  "Ingresos o ventas",
  "Unidades vendidas",
  "Leads calificados",
  "Costo por lead (CPL)",
  "Costo por adquisición (CPA/CAC)",
  "Retorno de pauta (ROAS)",
  "Reservas o matrículas",
  "Visitas al local",
  "Conversaciones iniciadas",
  "Retención o recompra",
  "Otro KPI o por definir",
]);

export const PRODUCT_SEASON_OPTIONS: readonly CatalogOption[] = optionList([
  "Todo el año",
  "Temporada alta",
  "Temporada baja",
  "Regreso a clases",
  "Día de la Madre o del Padre",
  "Vacaciones y turismo",
  "Black Friday o Cyber Monday",
  "Navidad y fin de año",
  "Lanzamiento puntual",
  "Otra temporada o por definir",
]);

export const CONVERSION_EVENT_OPTIONS: readonly CatalogOption[] = optionList([
  "Compra completada",
  "Lead o formulario enviado",
  "Lead calificado",
  "Mensaje o conversación iniciada",
  "Llamada telefónica",
  "Reserva confirmada",
  "Matrícula o registro completado",
  "Visita al local",
  "Descarga o instalación de app",
  "Suscripción",
  "Otro evento o por definir",
]);

export const MONTH_OPTIONS: readonly CatalogOption[] = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
].map((label, index) => ({ value: String(index + 1), label }));

const currentYear = new Date().getFullYear();
export const PERIOD_YEAR_OPTIONS: readonly CatalogOption[] = Array.from(
  { length: currentYear - 1998 },
  (_, index) => String(currentYear + 1 - index),
).map((value) => ({ value, label: value }));

function optionList(values: readonly string[]): readonly CatalogOption[] {
  return values.map((value) => ({ value, label: value }));
}
