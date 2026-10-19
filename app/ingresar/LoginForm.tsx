"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setShowPassword(false);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("No pudimos ingresar. Revisa tu correo y contraseña.");
        return;
      }
      router.push("/panel");
      router.refresh();
    } catch {
      setError("Ocurrió un problema de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form} aria-busy={loading}>
      <div className={styles.field}>
        <label htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
          placeholder="tu@empresa.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="password">
          Contraseña
        </label>
        <div className={styles.passwordField}>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={error ? "login-error" : undefined}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            aria-controls="password"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {showPassword && <path d="m3 3 18 18" />}
            </svg>
          </button>
        </div>
      </div>
      {error && (
        <p id="login-error" role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className={styles.submit}>
        <span>{loading ? "Ingresando…" : "Ingresar"}</span>
        {!loading && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>}
      </button>
    </form>
  );
}
