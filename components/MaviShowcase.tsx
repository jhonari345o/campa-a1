"use client";

import { useEffect, useState } from "react";
import { MaviScene } from "@/components/Mavi";

type Example = { platform: string; emoji: string; objetivo: string; copy: string };

const EXAMPLES: Example[] = [
  {
    platform: "Meta — Facebook e Instagram",
    emoji: "📸",
    objetivo: "Mas visitas a tu local",
    copy: "\"Este finde, 2x1 en tu antojo favorito 🍩. Te esperamos en el centro de Guayaquil.\"",
  },
  {
    platform: "Google — Busqueda",
    emoji: "🔎",
    objetivo: "Que te encuentren al buscar",
    copy: "\"Panaderia artesanal cerca de ti — pan calientito todo el dia. Pide ya.\"",
  },
  {
    platform: "TikTok",
    emoji: "🎵",
    objetivo: "Que te conozcan mas personas",
    copy: "\"POV: descubriste el mejor postre del barrio 😋 #Guayaquil #Antojos\"",
  },
  {
    platform: "WhatsApp Business",
    emoji: "💚",
    objetivo: "Vender por chat",
    copy: "\"¡Hola! 👋 Mira nuestro menu del dia y haz tu pedido por aqui mismo.\"",
  },
];

/**
 * "Ejecuciones": Mavi salta de un ejemplo de campana a otro, para mostrar de
 * forma viva el tipo de anuncios que arma. Rota solo cada pocos segundos.
 */
export function MaviShowcase() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % EXAMPLES.length), 3200);
    return () => clearInterval(t);
  }, []);

  const ex = EXAMPLES[i];

  return (
    <section className="mt-8 overflow-hidden rounded-panel border border-border bg-fog/60 p-6">
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <MaviScene height={110} motion="bounce" prop="🚀" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wide text-muted">
            Mavi te muestra ejemplos de campanas
          </p>
          <div key={i} className="mavi-fade mt-2 rounded-xl border border-border bg-white p-4 shadow-panel">
            <div className="flex items-center gap-2">
              <span className="text-xl">{ex.emoji}</span>
              <span className="font-black text-forest">{ex.platform}</span>
            </div>
            <p className="mt-1 text-xs font-bold text-signal-dark">{ex.objetivo}</p>
            <p className="mt-2 text-sm text-forest">{ex.copy}</p>
          </div>
          <div className="mt-3 flex gap-1.5">
            {EXAMPLES.map((_, idx) => (
              <span
                key={idx}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (idx === i ? "w-5 bg-signal" : "w-1.5 bg-border")
                }
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
