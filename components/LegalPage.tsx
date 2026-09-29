import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

export function LegalPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" aria-label="Volver a Ad Mavericks One"><Wordmark one /></Link>
          <Link href="/" className="text-sm font-black text-forest hover:text-signal-dark">Volver al inicio</Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-signal-dark">{eyebrow}</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg text-muted">{intro}</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Última actualización: 26 de agosto de 2026</p>
        <article className="legal-copy mt-10 space-y-8 rounded-panel border border-border bg-white p-6 shadow-panel sm:p-10">
          {children}
        </article>
      </main>
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="text-xl font-black tracking-tight">{title}</h2><div className="mt-3 space-y-3 text-sm leading-7 text-muted">{children}</div></section>;
}

