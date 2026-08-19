"use client";

import { useEffect, useState } from "react";
import { MaviAvatar } from "@/components/Mavi";

type Step = { emoji: string; title: string; body: string };

const BASE_STEPS: Step[] = [
  {
    emoji: "🦎",
    title: "¡Hola! Soy Mavi",
    body: "Tu estratega de medios. Te acompano en cada paso: desde armar tu plan hasta lanzar tus campanas. Te muestro rapido como funciona.",
  },
  {
    emoji: "🧭",
    title: "1. Planificador de medios",
    body: "Cuentame de tu negocio y te armo un plan con los canales que mas te convienen (Meta, Google, TikTok, WhatsApp), con base en datos del mercado.",
  },
  {
    emoji: "💬",
    title: "2. Preguntame lo que sea",
    body: "En 'Asistente' resuelvo tus dudas de publicidad, te sugiero ideas y te genero los textos y guiones de tus anuncios.",
  },
  {
    emoji: "🚀",
    title: "3. Ejecuta y sigue tus campanas",
    body: "Cuando le des 'Ejecutar con Mavi', preparo la campana y la veras en 'Mis campanas' con su estado. Nunca publico sola: tu das el visto bueno.",
  },
];

const ADMIN_STEP: Step = {
  emoji: "👥",
  title: "4. Suma a tu equipo",
  body: "Como administrador, aqui mismo en tu panel puedes crear las cuentas de tu equipo (hasta tus cupos). Cada persona ve solo la informacion de tu empresa.",
};

const STORAGE_KEY = "mavi_tour_v1";

/**
 * Tutorial guiado por Mavi. Se muestra la primera vez (localStorage) y queda
 * un boton flotante para verlo de nuevo cuando el usuario quiera.
 */
export function MaviTour({ isAdmin = false }: { isAdmin?: boolean }) {
  const steps = isAdmin ? [...BASE_STEPS, ADMIN_STEP] : BASE_STEPS;
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  function close() {
    setOpen(false);
    setI(0);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* si no hay storage, igual se cierra */
    }
  }

  const step = steps[i];
  const last = i === steps.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setI(0);
          setOpen(true);
        }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-black text-forest shadow-panel transition-transform hover:-translate-y-0.5"
      >
        <MaviAvatar size={24} /> Como funciona
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-panel border border-border bg-white p-6 shadow-panel">
            <div className="flex items-start gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-signal/10 text-3xl">
                {step.emoji}
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-forest">{step.title}</h2>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-1.5">
              {steps.map((_, idx) => (
                <span
                  key={idx}
                  className={
                    "h-1.5 rounded-full transition-all " +
                    (idx === i ? "w-5 bg-signal" : "w-1.5 bg-border")
                  }
                />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={close}
                className="text-sm font-bold text-muted hover:text-forest"
              >
                Saltar
              </button>
              <button
                type="button"
                onClick={() => (last ? close() : setI((n) => n + 1))}
                className="btn btn-primary"
              >
                {last ? "¡Listo, a empezar!" : "Siguiente →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
