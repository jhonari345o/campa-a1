"use client";

import { useState } from "react";
import Link from "next/link";
import { MaviAvatar } from "@/components/Mavi";
import { crearPauta } from "./actions";

type Bubble = { from: "mavi" | "user"; text: string };

const REDES = [
  { id: "instagram", label: "Instagram", emoji: "📸" },
  { id: "facebook", label: "Facebook", emoji: "👍" },
  { id: "tiktok", label: "TikTok", emoji: "🎵" },
];

const money = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function PautarChat() {
  const [chat, setChat] = useState<Bubble[]>([
    { from: "mavi", text: "¡Listo para pautar! 🦎 Vamos paso a paso. Primero: ¿en que red quieres pautar?" },
  ]);
  const [step, setStep] = useState<"red" | "link" | "monto" | "geo" | "confirmar" | "hecho">("red");
  const [red, setRed] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [monto, setMonto] = useState("");
  const [geo, setGeo] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  function push(b: Bubble) {
    setChat((c) => [...c, b]);
  }

  function pickRed(r: { id: string; label: string }) {
    setRed(r.id);
    push({ from: "user", text: r.label });
    push({ from: "mavi", text: "Perfecto. Ahora pega el link de la publicacion (video o foto) que quieres pautar 👇" });
    setStep("link");
  }

  function submitText() {
    const value = text.trim();
    if (!value) return;
    push({ from: "user", text: value });
    setText("");

    if (step === "link") {
      if (!/^https?:\/\//i.test(value)) {
        push({ from: "mavi", text: "Ese link no se ve bien. Debe empezar con http... Copialo desde la publicacion e intenta de nuevo." });
        return;
      }
      setPostUrl(value);
      push({ from: "mavi", text: "¡Anotado! ¿Cuanto quieres invertir en total? Escribe el monto en dolares (ej. 50)." });
      setStep("monto");
    } else if (step === "monto") {
      const n = Number(value.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(n) || n <= 0) {
        push({ from: "mavi", text: "Necesito un monto en dolares, solo el numero (ej. 50)." });
        return;
      }
      setMonto(String(n));
      push({ from: "mavi", text: "Genial. ¿En que ubicacion quieres mostrar el anuncio? (ciudad, provincia o pais)" });
      setStep("geo");
    } else if (step === "geo") {
      setGeo(value);
      push({
        from: "mavi",
        text: `Listo, reviso: pauta en ${redLabel(red)}, ${money(Number(monto))}, ubicacion "${value}". ¿Lo creo?`,
      });
      setStep("confirmar");
    }
  }

  async function confirmar() {
    setSending(true);
    setError(null);
    const res = await crearPauta({
      red,
      postUrl,
      geo,
      presupuesto: Number(monto),
    });
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setJobId(res.id);
    push({ from: "mavi", text: "¡Orden de pauta creada! 🚀 La veras en 'Mis campanas' con su estado y sus metricas." });
    setStep("hecho");
  }

  return (
    <div className="rounded-panel border border-border bg-white shadow-panel">
      {/* Transcript */}
      <div className="max-h-[420px] space-y-3 overflow-y-auto p-5">
        {chat.map((b, i) => (
          <div key={i} className={b.from === "user" ? "flex justify-end" : "flex items-start gap-2"}>
            {b.from === "mavi" && <MaviAvatar size={30} className="mt-0.5 shrink-0" />}
            <p
              className={
                b.from === "user"
                  ? "max-w-[80%] rounded-2xl rounded-br-sm bg-forest px-4 py-2 text-sm text-white"
                  : "max-w-[80%] rounded-2xl rounded-bl-sm bg-fog px-4 py-2 text-sm text-forest"
              }
            >
              {b.text}
            </p>
          </div>
        ))}
      </div>

      {/* Zona de entrada segun el paso */}
      <div className="border-t border-border p-4">
        {step === "red" && (
          <div className="flex flex-wrap gap-2">
            {REDES.map((r) => (
              <button key={r.id} type="button" onClick={() => pickRed(r)} className="btn btn-secondary">
                {r.emoji} {r.label}
              </button>
            ))}
          </div>
        )}

        {(step === "link" || step === "monto" || step === "geo") && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitText();
            }}
            className="flex gap-2"
          >
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              inputMode={step === "monto" ? "decimal" : "text"}
              placeholder={
                step === "link"
                  ? "https://instagram.com/p/..."
                  : step === "monto"
                    ? "50"
                    : "Guayaquil, Ecuador"
              }
              className="flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-forest outline-none focus:border-signal"
            />
            <button type="submit" className="btn btn-primary">
              Enviar
            </button>
          </form>
        )}

        {step === "confirmar" && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={confirmar} disabled={sending} className="btn btn-primary disabled:opacity-60">
              {sending ? "Creando..." : "Si, crear la pauta →"}
            </button>
            <button
              type="button"
              onClick={() => {
                push({ from: "user", text: "Mejor no" });
                push({ from: "mavi", text: "Sin problema. Cuando quieras empezamos de nuevo." });
                setStep("hecho");
              }}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
          </div>
        )}

        {step === "hecho" && jobId && (
          <Link href="/campanas" className="btn btn-primary w-full text-center">
            Ver en Mis campanas →
          </Link>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-coral/40 bg-coral/10 px-4 py-2 text-sm font-bold text-[#a13b31]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function redLabel(id: string) {
  return REDES.find((r) => r.id === id)?.label ?? id;
}
