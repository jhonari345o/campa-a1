"use client";

import { useRef, useState } from "react";
import { MaviAvatar } from "@/components/Mavi";

type Msg = { role: "user" | "assistant"; content: string };

const SUGERENCIAS = [
  "Tengo una cafeteria y $2000 al mes. ¿En que canales invierto?",
  "Hazme un guion para un reel de Instagram de mi restaurante.",
  "Escribe una cuna de radio de 30s para mi farmacia.",
  "¿Como armo una campana de WhatsApp para vender mas?",
];

export function ChatMavi() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "¡Hola! Soy Mavi. Cuentame tu negocio y tu presupuesto, y te digo en que canales invertir y como. Tambien te armo campanas y guiones para redes, TV o radio.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: clean }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No pude responder.");
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setError("Problema de conexion. Intenta de nuevo.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));
    }
  }

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col rounded-panel border border-border bg-white shadow-panel">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {loading && <Bubble role="assistant" content="Mavi esta pensando…" muted />}
        {error && (
          <p className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">
            {error}
          </p>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-6 pb-2">
          {SUGERENCIAS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border bg-fog px-3 py-1.5 text-xs font-bold text-forest hover:border-signal"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-3 border-t border-border p-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta sobre medios…"
          className="flex-1 rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
        />
        <button type="submit" disabled={loading} className="btn btn-primary disabled:opacity-60">
          Enviar →
        </button>
      </form>
    </div>
  );
}

function Bubble({
  role,
  content,
  muted,
}: {
  role: "user" | "assistant";
  content: string;
  muted?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && <MaviAvatar size={36} className="shrink-0" />}
      <div
        className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-forest text-white"
            : `border border-border bg-fog text-forest ${muted ? "italic text-muted" : ""}`
        }`}
      >
        {content}
      </div>
    </div>
  );
}
