import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { cerrarSesion } from "@/app/consola/actions";

type AppHeaderProps = {
  name: string;
  isAdmin: boolean;
  /** Ruta activa para resaltar el enlace. */
  active?: "mercado" | "consola" | "panel" | "asistente";
};

/** Encabezado del area autenticada (mercado, consola). */
export function AppHeader({ name, isAdmin, active }: AppHeaderProps) {
  return (
    <header className="border-b border-border bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/panel" className="text-lg">
            <Wordmark one />
          </Link>
          <nav className="hidden items-center gap-5 md:flex">
            <HeaderLink href="/panel" label="Panel" active={active === "panel"} />
            <HeaderLink href="/mercado" label="Mercado" active={active === "mercado"} />
            <HeaderLink href="/asistente" label="Mavi" active={active === "asistente"} />
            {isAdmin && (
              <HeaderLink href="/consola" label="Consola" active={active === "consola"} />
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm font-bold text-muted sm:block">{name}</span>
          <form action={cerrarSesion}>
            <button type="submit" className="text-sm font-black text-forest hover:text-signal-dark">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function HeaderLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`text-sm font-black transition-colors ${
        active ? "text-signal-dark" : "text-forest hover:text-signal-dark"
      }`}
    >
      {label}
    </Link>
  );
}
