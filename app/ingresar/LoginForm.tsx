"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("No pudimos ingresar. Revisa tu correo y contrasena.");
        return;
      }
      router.push("/mercado");
      router.refresh();
    } catch {
      setError("Ocurrio un problema de conexion. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-black text-forest">
          Correo
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-black text-forest">
          Contrasena
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-fog px-4 py-3 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
        />
      </div>
      {error && (
        <p className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm font-bold text-[#a13b31]">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-60">
        {loading ? "Ingresando..." : "Ingresar →"}
      </button>
    </form>
  );
}
