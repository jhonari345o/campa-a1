/**
 * Planes de suscripcion de Ad Mavericks One.
 * Fuente unica: se usa en la landing y en la Consola (alta de cliente).
 * La cotizacion es personalizada; no se publican precios fijos.
 */
export type Plan = {
  id: "basico" | "premium" | "super" | "diamante";
  name: string;
  tagline: string;
  seats: number; // usuarios incluidos
  features: string[];
  destacado?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "basico",
    name: "Basico",
    tagline: "Para empezar a pautar con criterio.",
    seats: 3,
    features: [
      "3 usuarios",
      "Planificador de medios",
      "Mavi, tu guia de medios",
      "Pauta en 1 red (Meta o TikTok)",
      "Hasta 5 campanas al mes",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "El favorito de las marcas que crecen.",
    seats: 8,
    destacado: true,
    features: [
      "8 usuarios",
      "Todas las redes (Meta, TikTok, WhatsApp)",
      "Campanas ilimitadas",
      "Borradores de pauta con Mavi",
      "Soporte prioritario",
    ],
  },
  {
    id: "super",
    name: "Super Premium",
    tagline: "Operacion de medios completa.",
    seats: 20,
    features: [
      "20 usuarios",
      "Todo lo de Premium",
      "Inteligencia de mercado",
      "Reportes con fuente, periodo y metodologia",
      "Estratega de cuenta asignado",
    ],
  },
  {
    id: "diamante",
    name: "Diamante",
    tagline: "Maximo nivel, hecho a tu medida.",
    seats: 100,
    features: [
      "Usuarios ilimitados",
      "Todo lo de Super Premium",
      "Estratega dedicado 1 a 1",
      "Integraciones a medida",
      "Atencion 24/7",
    ],
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
