"use client";

import { useEffect, useState } from "react";
import type { PagoPluxPaybox } from "@/lib/payments/pagoplux";

type PayboxResponse = {
  status?: unknown;
  amount?: unknown;
  id_transaccion?: unknown;
  state?: unknown;
};

declare global {
  interface Window {
    Data?: { init: (input: Record<string, unknown>) => void; reload?: (input: Record<string, unknown>) => void };
    jQuery?: unknown;
    $?: unknown;
  }
}

export function PagoPluxButton({ config }: { config: PagoPluxPaybox }) {
  const [state, setState] = useState<"loading" | "ready" | "pending" | "error">("loading");
  const [message, setMessage] = useState("Cargando el botón seguro de PagoPlux…");

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        await loadScript("pagoplux-jquery", "https://code.jquery.com/jquery-3.7.1.min.js");
        await loadScript("pagoplux-paybox", config.scriptUrl);
        if (cancelled || !window.Data) throw new Error("PagoPlux no expuso el inicializador oficial.");
        const input: Record<string, unknown> = {
          PayboxRemail: config.merchantEmail,
          PayboxSendmail: config.payerEmail,
          PayboxRename: config.merchantName,
          PayboxSendname: config.payerName,
          PayboxBase0: config.base0,
          PayboxBase12: config.base12,
          PayboxDescription: config.description,
          PayboxProduction: config.environment === "live",
          PayboxEnvironment: config.environment === "live" ? "prod" : "sandbox",
          PayboxLanguage: "es",
          PayboxPagoPlux: true,
          PayboxDirection: config.payerAddress,
          PayBoxClientPhone: config.payerPhone,
          PayBoxClientIdentification: config.payerIdentification,
          PayboxRecurrent: false,
          PayboxIdPlan: "",
          PayboxPermitirCalendarizar: false,
          PayboxPagoInmediato: true,
          PayboxCobroPrueba: false,
          onAuthorize: async (response: PayboxResponse) => {
            const transactionId = typeof response.id_transaccion === "string" ? response.id_transaccion : "";
            const amount = Number(response.amount);
            if (!transactionId || !Number.isFinite(amount)) {
              setState("error");
              setMessage("PagoPlux devolvió una respuesta incompleta. No se habilitó la campaña.");
              return;
            }
            setState("pending");
            setMessage("Pago recibido por PagoPlux. Estamos conciliando el webhook antes de habilitar la pauta.");
            const result = await fetch("/api/payments/pagoplux/authorize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentId: config.paymentId,
                jobId: config.jobId,
                transactionId,
                amount,
                status: String(response.status ?? ""),
                state: String(response.state ?? ""),
              }),
            });
            const body = await result.json().catch(() => ({})) as { state?: string; error?: string };
            if (!result.ok) {
              setState("error");
              setMessage(body.error || "No pudimos conciliar la transacción. No se habilitó la campaña.");
            } else if (body.state === "success") {
              setMessage("Pago conciliado. La orden está lista para preparar el borrador pausado en Meta.");
            }
          },
        };
        window.Data.init(input);
        setState("ready");
        setMessage(config.environment === "live" ? "PagoPlux producción listo." : "PagoPlux sandbox listo.");
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("No se pudo cargar PagoPlux. Intenta nuevamente o contacta a soporte.");
        }
      }
    }
    initialize();
    return () => { cancelled = true; };
  }, [config]);

  return (
    <div className="space-y-3">
      <div id="modalPaybox" />
      <button id="pay" type="button" disabled={state === "loading" || state === "pending"} className="btn btn-primary w-full disabled:opacity-60">
        {state === "loading" ? "Cargando PagoPlux…" : state === "pending" ? "Conciliando pago…" : `Pagar con PagoPlux · $${Number(config.base0).toFixed(2)}`}
      </button>
      <p className={`text-center text-[11px] ${state === "error" ? "font-bold text-[#a13b31]" : "text-muted"}`}>{message}</p>
    </div>
  );
}

function loadScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "true") return resolve();
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("script_load_failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error("script_load_failed"));
    document.head.appendChild(script);
  });
}
