"use client";

import { useState } from "react";
import Link from "next/link";
import { MaviAvatar } from "@/components/Mavi";
import { crearPauta } from "./actions";
import { computeCharge, money, SERVICE_FEE_LABEL } from "@/lib/pricing";

type Bubble = { from: "mavi" | "user"; text: string };

const REDES = [
  { id: "instagram", label: "Instagram", emoji: "📸" },
  { id: "facebook", label: "Facebook", emoji: "👍" },
  { id: "tiktok", label: "TikTok", emoji: "🎵" },
];

const CIUDADES = ["Guayaquil", "Quito", "Cuenca"];

type Step = "red" | "link" | "geo" | "monto" | "pago" | "hecho";

export function PautarChat() {
  const [chat, setChat] = useState<Bubble[]>([
    { from: "mavi", text: "¡Listo para pautar! 🦎 Vamos paso a paso. Primero: ¿en que plataforma quieres pautar?" },
  ]);
  const [step, setStep] = useState<Step>("red");
  const [red, setRed] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [monto, setMonto] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  // Datos de tarjeta (SIMULADOS — no se envian a ningun lado).
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const cardDigits = cardNumber.replace(/\D/g, "");
  const cardValido =
    cardName.trim().length >= 3 &&
    cardDigits.length >= 15 &&
    /^\d{2}\/\d{2}$/.test(cardExp) &&
    /^\d{3,4}$/.test(cardCvc);

  function push(b: Bubble) {
    setChat((c) => [...c, b]);
  }

  function pickRed(r: { id: string; label: string }) {
    setRed(r.id);
    push({ from: "user", text: r.label });
    push({ from: "mavi", text: "Perfecto. Pega el link de la publicacion (video o foto) que quieres pautar 👇" });
    setStep("link");
  }

  function toggleCity(c: string) {
    setCities((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function confirmCities() {
    if (cities.length === 0) return;
    push({ from: "user", text: cities.join(", ") });
    push({ from: "mavi", text: "¡Buenisimo! ¿Cuanto quieres pautar? Escribe el monto en dolares (ej. 200)." });
    setStep("monto");
  }

  function submitText() {
    const value = text.trim();
    if (!value) return;
    push({ from: "user", text: value });
    setText("");

    if (step === "link") {
      if (!/^https?:\/\//i.test(value)) {
        push({ from: "mavi", text: "Ese link no se ve bien. Debe empezar con http... Copialo de la publicacion e intenta de nuevo." });
        return;
      }
      setPostUrl(value);
      push({ from: "mavi", text: "¡Anotado! ¿En que publicos quieres mostrar el anuncio? Elige una o varias ciudades." });
      setStep("geo");
    } else if (step === "monto") {
      const n = Number(value.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(n) || n <= 0) {
        push({ from: "mavi", text: "Necesito un monto en dolares, solo el numero (ej. 200)." });
        return;
      }
      setMonto(n);
      const ch = computeCharge(n);
      push({
        from: "mavi",
        text: `Perfecto. Para pautar ${money(n)} pasas por caja: se suman los costos de servicio y gestion. Total a pagar: ${money(ch.total)}.`,
      });
      setStep("pago");
    }
  }

  async function pagar() {
    setSending(true);
    setError(null);
    const res = await crearPauta({ red, postUrl, geo: cities.join(", "), presupuesto: monto });
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setJobId(res.id);
    push({ from: "user", text: `Pagar ${money(computeCharge(monto).total)}` });
    push({ from: "mavi", text: "¡Pago recibido (demostracion)! 🚀 Cree tu orden de pauta. La veras en 'Mis campanas' con sus metricas." });
    setStep("hecho");
  }

  const charge = computeCharge(monto);

  return (
    <div className="rounded-panel border border-border bg-white shadow-panel">
      {/* Transcript */}
      <div className="max-h-[380px] space-y-3 overflow-y-auto p-5">
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

        {(step === "link" || step === "monto") && (
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
              placeholder={step === "link" ? "https://instagram.com/p/..." : "200"}
              className="flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-forest outline-none focus:border-signal"
            />
            <button type="submit" className="btn btn-primary">Enviar</button>
          </form>
        )}

        {step === "geo" && (
          <div>
            <div className="flex flex-wrap gap-2">
              {CIUDADES.map((c) => {
                const on = cities.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCity(c)}
                    className={
                      "rounded-full border px-4 py-1.5 text-sm font-black transition-colors " +
                      (on
                        ? "border-signal bg-signal/15 text-signal-dark"
                        : "border-border bg-white text-forest hover:border-signal")
                    }
                  >
                    {on ? "✓ " : ""}📍 {c}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={confirmCities}
              disabled={cities.length === 0}
              className="btn btn-primary mt-3 disabled:opacity-50"
            >
              Continuar →
            </button>
          </div>
        )}

        {step === "pago" && (
          <div className="rounded-xl border-2 border-signal/30 bg-signal/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wide text-signal-dark">🔒 Pago seguro</p>
              <span className="text-lg" aria-hidden>💳</span>
            </div>

            <div className="mt-3 space-y-1.5 text-sm">
              <Row label={`Inversion en anuncios (${red || "red"})`} value={money(charge.base)} />
              <Row label={SERVICE_FEE_LABEL} value={money(charge.fee)} />
              <div className="my-2 border-t border-border" />
              <Row label="Total a pagar" value={money(charge.total)} bold />
            </div>

            {/* Formulario de tarjeta (simulado) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (cardValido) pagar();
              }}
              className="mt-4 space-y-2"
            >
              <input
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Nombre en la tarjeta"
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-forest outline-none focus:border-signal"
              />
              <input
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCard(e.target.value))}
                inputMode="numeric"
                placeholder="4242 4242 4242 4242"
                maxLength={19}
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-forest outline-none focus:border-signal"
              />
              <div className="flex gap-2">
                <input
                  value={cardExp}
                  onChange={(e) => setCardExp(formatExp(e.target.value))}
                  inputMode="numeric"
                  placeholder="MM/AA"
                  maxLength={5}
                  className="w-1/2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-forest outline-none focus:border-signal"
                />
                <input
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="CVC"
                  maxLength={4}
                  className="w-1/2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-forest outline-none focus:border-signal"
                />
              </div>

              <button
                type="submit"
                disabled={sending || !cardValido}
                className="btn btn-primary mt-1 w-full disabled:opacity-50"
              >
                {sending ? "Procesando pago..." : `Pagar ${money(charge.total)}`}
              </button>
            </form>

            <p className="mt-2 text-center text-[11px] text-muted">
              🔒 Pago cifrado · Demostracion (no se realiza ningun cobro real)
            </p>
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

/** Agrupa el numero de tarjeta de 4 en 4 (solo visual). */
function formatCard(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/** Formatea la expiracion como MM/AA. */
function formatExp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-black text-forest" : "text-muted"}>{label}</span>
      <span className={bold ? "text-lg font-black text-forest" : "font-bold text-forest"}>{value}</span>
    </div>
  );
}
