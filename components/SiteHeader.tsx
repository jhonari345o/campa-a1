import Link from "next/link";
import { Wordmark } from "./Wordmark";

const nav = [
  { href: "#plataforma", label: "Plataforma" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#precios", label: "Precios" },
  { href: "#seguridad", label: "Seguridad" },
  { href: "#fases", label: "Implementacion" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-fog/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:gap-6 sm:px-6">
        <Link href="/" className="shrink-0 text-sm sm:text-xl">
          <Wordmark one />
        </Link>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Principal">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-black text-forest transition-colors hover:text-signal-dark"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/ingresar" className="hidden text-sm font-black text-forest hover:text-signal-dark sm:block">
            Ingresar
          </Link>
          <a href="#contacto" className="btn btn-primary px-3 text-xs sm:px-5 sm:text-sm">
            <span className="sm:hidden">Solicitar</span>
            <span className="hidden sm:inline">Solicitar acceso</span>
          </a>
        </div>
      </div>
    </header>
  );
}
