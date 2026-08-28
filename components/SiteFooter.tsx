import { Wordmark } from "./Wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-forest-deep text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark one invert className="text-lg" />
          <p className="mt-4 max-w-xs text-sm text-white/70">
            Tu central de medios del nuevo siglo. Planificacion, compra y control
            de pauta publicitaria, clara y segura. Guayaquil, Ecuador.
          </p>
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.1em] text-white/50">
            Plataforma
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li><a href="#como-funciona" className="hover:text-signal">Como funciona</a></li>
            <li><a href="#seguridad" className="hover:text-signal">Seguridad</a></li>
            <li><a href="#fases" className="hover:text-signal">Implementacion</a></li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.1em] text-white/50">
            Contacto
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li><a href="#contacto" className="hover:text-signal">Solicitar acceso</a></li>
            <li><a href="/ingresar" className="hover:text-signal">Ingresar a mi cuenta</a></li>
            <li><a href="/privacidad" className="hover:text-signal">Privacidad</a></li>
            <li><a href="/terminos" className="hover:text-signal">Términos</a></li>
            <li><a href="/reembolsos" className="hover:text-signal">Facturación y devoluciones</a></li>
            <li><a href="/eliminacion-datos" className="hover:text-signal">Eliminar mis datos</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>Ad Mavericks · {new Date().getFullYear()} · Documento de trabajo</span>
          <span>Version 1.0 · Manual de identidad visual</span>
        </div>
      </div>
    </footer>
  );
}
