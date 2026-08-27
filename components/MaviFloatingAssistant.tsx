"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MaviAvatar } from "@/components/Mavi";

type Source = { title: string; url: string; source: string; publishedAt: string | null };
type Message = { role: "user" | "assistant"; content: string; sources?: Source[] };

const STARTERS = [
  "¿Qué medio conviene para mi negocio?",
  "Explícame mi presupuesto",
  "Busca una tendencia actual",
];

export function MaviFloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"ask" | "campaign">("ask");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hola, soy Mavi. Pregúntame por tu plan, los catálogos, una campaña o una tendencia que pueda afectar a tu marca." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState("instagram");
  const [budget, setBudget] = useState("");
  const [objective, setObjective] = useState("Alcance");
  const scrollRef = useRef<HTMLDivElement>(null);
  const campaignHref = useMemo(() => {
    const params = new URLSearchParams({ red: network });
    if (budget) params.set("monto", budget);
    if (objective) params.set("objetivo", objective);
    return `/pautar?${params.toString()}`;
  }, [network, budget, objective]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mavi") === "open") setOpen(true);
  }, []);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    if (!consent) {
      setError("Confirma el aviso de tratamiento para consultar a Mavi.");
      return;
    }
    const next = [...messages, { role: "user" as const, content: clean }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, consent: true }),
      });
      const data = await response.json() as { reply?: string; error?: string; sources?: Source[] };
      if (!response.ok) setError(data.error ?? "Mavi no pudo responder.");
      else setMessages((current) => [...current, { role: "assistant", content: data.reply ?? "No pude preparar la respuesta.", sources: data.sources ?? [] }]);
    } catch {
      setError("No pude conectarme. Intenta nuevamente.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  return (
    <div className={`mavi-floating ${open ? "is-open" : ""}`}>
      {open && (
        <section className="mavi-floating-panel" aria-label="Asistente Mavi">
          <header>
            <div><MaviAvatar size={42} /><div><strong>Mavi</strong><span>Asistente de medios</span></div></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar Mavi">×</button>
          </header>
          <nav aria-label="Acciones de Mavi">
            <button type="button" className={mode === "ask" ? "is-active" : ""} onClick={() => setMode("ask")}>Preguntar</button>
            <button type="button" className={mode === "campaign" ? "is-active" : ""} onClick={() => setMode("campaign")}>Pauta aparte</button>
          </nav>

          {mode === "ask" ? (
            <>
              <div ref={scrollRef} className="mavi-floating-messages">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`mavi-mini-message is-${message.role}`}>
                    <p>{message.content}</p>
                    {message.sources && message.sources.length > 0 && (
                      <ul>{message.sources.slice(0, 4).map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} · {source.source} ↗</a></li>)}</ul>
                    )}
                  </div>
                ))}
                {loading && <div className="mavi-mini-message is-assistant"><p>Mavi está analizando…</p></div>}
                {error && <p className="mavi-floating-error">{error}</p>}
              </div>
              {messages.length === 1 && <div className="mavi-floating-starters">{STARTERS.map((starter) => <button type="button" key={starter} onClick={() => send(starter)}>{starter}</button>)}</div>}
              <form className="mavi-floating-form" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
                {!consent && <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Autorizo procesar esta consulta con el proveedor configurado y consultar fuentes públicas cuando corresponda. No incluiré datos sensibles.</span></label>}
                <div><input value={input} onChange={(event) => setInput(event.target.value)} maxLength={4000} placeholder="Pregunta sobre tu plan o campaña…" /><button type="submit" disabled={loading || !consent} aria-label="Enviar pregunta">↑</button></div>
              </form>
            </>
          ) : (
            <div className="mavi-floating-campaign">
              <p>Prepara una pauta independiente. En el siguiente paso añadirás el enlace de la publicación, geografía y radio.</p>
              <label>Plataforma<select value={network} onChange={(event) => setNetwork(event.target.value)}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option></select></label>
              <label>Objetivo<select value={objective} onChange={(event) => setObjective(event.target.value)}><option>Alcance</option><option>Tráfico</option><option>Mensajes</option><option>Ventas</option></select></label>
              <label>Inversión para anuncios (USD)<input type="number" min="1" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Ej. 500" /></label>
              <a href={campaignHref} className="btn btn-primary">Continuar con la pauta →</a>
              <small>El checkout calculará por separado inversión, 22% de impuestos/costos y 25% de asistencia.</small>
            </div>
          )}
        </section>
      )}
      <button type="button" className="mavi-floating-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Cerrar asistente Mavi" : "Abrir asistente Mavi"}>
        <MaviAvatar size={54} />
        <span><strong>Pregunta a Mavi</strong><small>Planifica o crea una pauta</small></span>
        <b>{open ? "×" : "+"}</b>
      </button>
    </div>
  );
}
