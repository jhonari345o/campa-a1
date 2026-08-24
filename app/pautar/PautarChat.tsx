"use client";

import { useState } from "react";
import { MaviAvatar } from "@/components/Mavi";
import { crearPauta } from "./actions";
import { EcuadorTargetMap, type GeoTarget } from "./EcuadorTargetMap";
import { computeCharge, money, SERVICE_FEE_LABEL, TAX_LABEL } from "@/lib/pricing";

type Bubble = { from: "mavi" | "user"; text: string };

const REDES = [
  { id: "instagram", label: "Instagram", emoji: "📸", enabled: true },
  { id: "facebook", label: "Facebook", emoji: "👍", enabled: true },
  { id: "tiktok", label: "TikTok · proximamente", emoji: "🎵", enabled: false },
];

type Step = "red" | "link" | "geo" | "monto" | "pago";

export function PautarChat({
  initialRed,
  initialMonto,
  initialObjetivo,
  commercialPaymentsEnabled = false,
}: {
  initialRed?: string;
  initialMonto?: number;
  initialObjetivo?: string;
  commercialPaymentsEnabled?: boolean;
} = {}) {
  const prefilled = Boolean(initialRed && initialMonto && initialMonto > 0);
  const [chat, setChat] = useState<Bubble[]>(
    prefilled
      ? [
          {
            from: "mavi",
            text: `¡Te prepare esta campana! 🦎 ${redLabel(initialRed!)} · ${money(initialMonto!)}${
              initialObjetivo ? ` · ${initialObjetivo}` : ""
            }. Solo pega el link de la publicacion que quieres pautar 👇`,
          },
        ]
      : [{ from: "mavi", text: "¡Listo para pautar! 🦎 Vamos paso a paso. Primero: ¿en que plataforma quieres pautar?" }],
  );
  const [step, setStep] = useState<Step>(prefilled ? "link" : "red");
  const [red, setRed] = useState(initialRed ?? "");
  const [postUrl, setPostUrl] = useState("");
  const [geoTarget, setGeoTarget] = useState<GeoTarget | null>(null);
  const [monto, setMonto] = useState(initialMonto ?? 0);
  const [objetivo] = useState(initialObjetivo ?? "");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentLinks, setPaymentLinks] = useState<{
    payWithCard: string;
    payWithPayPhone: string;
  } | null>(null);

  function push(b: Bubble) {
    setChat((c) => [...c, b]);
  }

  function pickRed(r: { id: string; label: string; enabled: boolean }) {
    if (!r.enabled) return;
    setRed(r.id);
    push({ from: "user", text: r.label });
    push({ from: "mavi", text: "Perfecto. Pega el link de la publicacion (video o foto) que quieres pautar 👇" });
    setStep("link");
  }

  function confirmGeoTarget() {
    if (!geoTarget) return;
    push({ from: "user", text: `${geoTarget.label} · radio ${geoTarget.radiusKm} km` });
    if (monto > 0) {
      // Presupuesto ya venia de la campana: pasamos directo al pago.
      const ch = computeCharge(monto);
      push({
        from: "mavi",
        text: `¡Buenisimo! Para pautar ${money(monto)} pasas por caja: se suman los costos de servicio y gestion. Total a pagar: ${money(ch.total)}.`,
      });
      setStep("pago");
    } else {
      push({ from: "mavi", text: "¡Buenisimo! ¿Cuanto quieres pautar? Escribe el monto en dolares (ej. 200)." });
      setStep("monto");
    }
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
      push({
        from: "mavi",
        text: "¡Anotado! Marca el centro en el mapa de Ecuador y ajusta el radio donde quieres mostrar el anuncio.",
      });
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
    if (!geoTarget) {
      setError("Selecciona la geolocalizacion y el radio de la pauta.");
      return;
    }
    setSending(true);
    setError(null);
    const res = await crearPauta({
      red,
      postUrl,
      geo: `${geoTarget.label} · ${geoTarget.latitude.toFixed(6)}, ${geoTarget.longitude.toFixed(6)} · ${geoTarget.radiusKm} km`,
      latitude: geoTarget.latitude,
      longitude: geoTarget.longitude,
      radiusKm: geoTarget.radiusKm,
      presupuesto: monto,
      objetivo: objetivo || undefined,
    });
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPaymentLinks({
      payWithCard: res.payWithCard,
      payWithPayPhone: res.payWithPayPhone,
    });
    push({ from: "mavi", text: "PayPhone preparo el pago. Elige tarjeta o la app PayPhone; el enlace vence en 10 minutos." });
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
              <button
                key={r.id}
                type="button"
                onClick={() => pickRed(r)}
                disabled={!r.enabled}
                className="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
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
            <EcuadorTargetMap value={geoTarget} onChange={setGeoTarget} />
            <button
              type="button"
              onClick={confirmGeoTarget}
              disabled={!geoTarget}
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
              <Row label={TAX_LABEL} value={money(charge.tax)} />
              <Row label={SERVICE_FEE_LABEL} value={money(charge.fee)} />
              <div className="my-2 border-t border-border" />
              <Row label="Total a pagar" value={money(charge.total)} bold />
            </div>

            {!commercialPaymentsEnabled ? (
              <div className="mt-4 space-y-2">
                <button type="button" disabled className="btn btn-secondary w-full cursor-not-allowed opacity-60">
                  Cobro bloqueado hasta aprobación comercial
                </button>
                <a
                  href="mailto:hola@admavericks.one?subject=Revision%20de%20solicitud%20de%20pauta"
                  className="btn btn-primary w-full"
                >
                  Solicitar revisión humana →
                </a>
              </div>
            ) : !paymentLinks ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  pagar();
                }}
                className="mt-4"
              >
                <button
                  type="submit"
                  disabled={sending}
                  className="btn btn-primary mt-1 w-full disabled:opacity-50"
                >
                  {sending ? "Preparando PayPhone..." : `Continuar a PayPhone · ${money(charge.total)}`}
                </button>
              </form>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => window.location.assign(paymentLinks.payWithCard)}
                  className="btn btn-primary"
                >
                  Pagar con tarjeta
                </button>
                <button
                  type="button"
                  onClick={() => window.location.assign(paymentLinks.payWithPayPhone)}
                  className="btn btn-secondary"
                >
                  Pagar con app PayPhone
                </button>
              </div>
            )}

            <p className="mt-2 text-center text-[11px] text-muted">
              {commercialPaymentsEnabled
                ? "🔒 PayPhone procesa el pago en su pagina segura. Ad Mavericks no recibe los datos de la tarjeta."
                : "No se solicitan ni almacenan datos de tarjeta durante el modo controlado."}
            </p>
          </div>
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-black text-forest" : "text-muted"}>{label}</span>
      <span className={bold ? "text-lg font-black text-forest" : "font-bold text-forest"}>{value}</span>
    </div>
  );
}
