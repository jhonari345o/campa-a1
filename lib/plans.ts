/**
 * Planes de suscripcion de Ad Mavericks One.
 * Fuente unica: se usa en la landing (precios) y en la Consola (alta de cliente).
 * Precios mensuales en USD. Editar aqui para cambiarlos en todo el sitio.
 */
export type Plan = {
  id: "basico" | "premium" | "super" | "diamante";
  name: string;
  price: number; // USD / mes
  tagline: string;
  seats: number; // usuarios incluidos
  features: string[];
  destacado?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "basico",
    name: "Basico",
    price: 149,
    tagline: "Para empezar a pautar con criterio.",
    seats: 3,
    features: [
      "3 usuarios",
      "Planificador de medios",
      "Mavi, tu estratega IA",
      "Pauta en 1 red (Meta o TikTok)",
      "Hasta 5 campanas al mes",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 349,
    tagline: "El favorito de las marcas que crecen.",
    seats: 8,
    destacado: true,
    features: [
      "8 usuarios",
      "Todas las redes (Meta, TikTok, WhatsApp)",
      "Campanas ilimitadas",
      "Gestion de pauta con Mavi",
      "Soporte prioritario",
    ],
  },
  {
    id: "super",
    name: "Super Premium",
    price: 699,
    tagline: "Operacion de medios completa.",
    seats: 20,
    features: [
      "20 usuarios",
      "Todo lo de Premium",
      "Inteligencia de mercado",
      "Reportes avanzados y metricas en vivo",
      "Estratega de cuenta asignado",
    ],
  },
  {
    id: "diamante",
    name: "Diamante",
    price: 1499,
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

export const planMoney = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
