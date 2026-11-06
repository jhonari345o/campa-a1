"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "./Wordmark";
import styles from "./SiteHeader.module.css";

const nav = [
  { href: "#plataforma", label: "La plataforma" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#precios", label: "Soluciones" },
  { href: "#contacto", label: "Ayuda y acceso" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header className={styles.header}>
      <a href="#contenido" className={styles.skipLink}>Ir al contenido</a>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Ad Mavericks One, inicio">
          <Wordmark one />
        </Link>
        <button
          ref={menuButton}
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            {menuOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <nav id="site-navigation" className={`${styles.nav} ${menuOpen ? styles.open : ""}`} aria-label="Principal">
          {nav.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
        <Link href="/ingresar" className={styles.login} onClick={() => setMenuOpen(false)}>
          Iniciar sesión
        </Link>
      </div>
    </header>
  );
}
