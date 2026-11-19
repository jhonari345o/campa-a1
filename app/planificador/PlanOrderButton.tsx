"use client";

import { useState, useTransition } from "react";
import { crearOrdenDesdePlan } from "./workspace-actions";

export function PlanOrderButton({ planId }: { planId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await crearOrdenDesdePlan(planId);
          setMessage({ ok: result.ok, text: result.ok ? result.message : result.error });
        })}
        className="btn btn-primary w-full disabled:opacity-60"
      >
        {pending ? "Creando orden…" : "Enviar a coordinación →"}
      </button>
      {message && <p className={`mt-2 text-xs font-bold ${message.ok ? "text-forest" : "text-[#a13b31]"}`}>{message.text}</p>}
    </div>
  );
}
