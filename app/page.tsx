import Link from "next/link";
import styles from "./home.module.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MaviFull } from "@/components/Mavi";
import { PlanesPricing } from "@/components/PlanesPricing";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="contenido" className={styles.page} tabIndex={-1}>
        <Hero />
        <Plataforma />
        <ComoFunciona />
        <Precios />
        <Seguridad />
        <Fases />
        <Contacto />
      </main>
      <SiteFooter />
    </>
  );
}

function Precios() {
  return (
    <section id="precios" className="mx-auto max-w-6xl px-6 py-20">
      <div className="text-center">
        <span className="text-xs font-black uppercase tracking-[0.1em] text-signal-dark">Planes</span>
        <h2 className="mt-2 text-[clamp(1.8rem,3vw,2.8rem)] font-black leading-tight tracking-tight">
          Elige tu nivel de gestión de medios.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Un servicio de central de medios de primer nivel, con Mavi de tu lado.
          El alcance, acceso y responsables se confirman con nuestro equipo.
        </p>
      </div>
      <PlanesPricing />
    </section>
  );
}

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={styles.panel}>
        <div className={styles.intro}>
          <p className={styles.kicker}>Tu central de medios · Ecuador</p>
          <h1 id="home-title">Tu equipo. Tus medios. Un mismo lugar.</h1>
          <p className={styles.description}>
            Planifica campañas, coordina con tu equipo y da seguimiento a tus proyectos desde Ad Mavericks One.
          </p>
        </div>
        <section className={styles.access} aria-labelledby="access-title">
          <span className={styles.accessIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M3 12h12m-4-4 4 4-4 4" />
            </svg>
          </span>
          <p className={styles.eyebrow}>Acceso al portal</p>
          <h2 id="access-title">Bienvenido de nuevo.</h2>
          <p className={styles.instructions}>
            Entra con el correo y la contraseña que te asignó tu administrador.
          </p>
          <Link href="/ingresar" className={styles.login}>
            Iniciar sesión
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
          </Link>
          <p className={styles.audience}>Clientes · Proveedores · Colaboradores</p>
          <div className={styles.request}>
            <p>¿Es tu primera vez aquí?</p>
            <a href="#contacto">Solicitar acceso o ayuda <span aria-hidden="true">&nbsp;↗</span></a>
          </div>
        </section>
        <div className={styles.companion}>
          <div className={styles.companionCopy}>
            <strong>Mavi te acompaña.</strong>
            <p>Tú decides. Mavi te ayuda a avanzar.</p>
            <a href="#plataforma" className={styles.learnMore}>Conoce la plataforma <span aria-hidden="true">↓</span></a>
          </div>
          <MaviFull height={220} float={false} className={styles.mascot} />
        </div>
      </div>
    </section>
  );
}

const pilares = [
  {
    title: "Planificación clara",
    body: "Ordenamos la complejidad y entregamos un plan de medios entendible, accionable y listo para avanzar.",
  },
  {
    title: "Compra con criterio",
    body: "Seleccionamos canales por afinidad, cobertura y eficiencia. La tecnología acelera; el criterio eleva el resultado.",
  },
  {
    title: "Control multiempresa",
    body: "Cada cliente entra por invitación y trabaja dentro de su empresa. Reservas, órdenes y facturas se habilitan solo tras validación comercial.",
  },
];

function Plataforma() {
  return (
    <section id="plataforma" className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.1em] text-signal-dark">
            Esencia
          </span>
          <h2 className="mt-2 max-w-lg text-[clamp(1.8rem,3vw,2.8rem)] font-black leading-tight tracking-tight">
            Una plataforma para planificar, comprar y controlar medios.
          </h2>
        </div>
        <p className="max-w-sm text-muted">
          Inteligencia operativa, catálogo estructurado y decisiones comerciales
          más ágiles — en un mismo lugar.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {pilares.map((p) => (
          <article
            key={p.title}
            className="rounded-card border border-border bg-white p-6 shadow-panel"
          >
            <h3 className="text-lg font-black tracking-tight">{p.title}</h3>
            <p className="mt-3 text-sm text-muted">{p.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const pasos = [
  { n: "01", t: "Entender el negocio", d: "Objetivos, mercado, presupuesto y resultado esperado: notoriedad, ventas o registros." },
  { n: "02", t: "Analizar al público", d: "Edad, ubicación, intereses, hábitos, dispositivos y momentos de exposición." },
  { n: "03", t: "Diseñar la estrategia", d: "Qué canales, qué rol tiene cada uno, cuánto presupuesto y por cuánto tiempo." },
  { n: "04", t: "Planificar la campaña", d: "Fechas, formatos, ubicaciones, audiencias, inversión y resultados estimados." },
  { n: "05", t: "Confirmar los espacios", d: "El equipo valida disponibilidad, condiciones y aprobaciones antes de emitir una orden vinculante." },
  { n: "06", t: "Medir y optimizar", d: "Alcance, frecuencia, conversiones, CPC/CPM/CPA y retorno de inversión." },
];

function ComoFunciona() {
  return (
    <section id="como-funciona" className="bg-forest-deep py-20 text-white">
      <div className="mx-auto max-w-6xl px-6">
        <span className="text-xs font-black uppercase tracking-[0.1em] text-signal">
          Cómo funciona
        </span>
        <h2 className="mt-2 max-w-2xl text-[clamp(1.8rem,3vw,2.8rem)] font-black leading-tight tracking-tight">
          Del objetivo de negocio al resultado medible.
        </h2>
        <p className="mt-4 max-w-xl text-white/70">
          Una central de medios decide dónde, cuándo, cómo y ante quién invertir
          en publicidad — y convierte el presupuesto en resultados.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pasos.map((s) => (
            <article
              key={s.n}
              className="rounded-card border border-white/10 bg-white/5 p-6"
            >
              <span className="text-2xl font-black text-signal">{s.n}</span>
              <h3 className="mt-3 text-lg font-black tracking-tight">{s.t}</h3>
              <p className="mt-2 text-sm text-white/70">{s.d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const garantias = [
  { t: "Aislamiento por cliente", d: "Supabase aplica políticas por empresa; las pruebas de aislamiento forman parte de cada liberación." },
  { t: "Recuperación verificable", d: "La retención y la restauración deben comprobarse antes de habilitar operación comercial." },
  { t: "Protección por capas", d: "HTTPS y cabeceras seguras están activas; WAF y límites de abuso se validan antes del lanzamiento." },
  { t: "Datos honestos", d: "Si una fuente o metodología no está homologada, se muestra como pendiente y nunca se inventa una cifra." },
];

function Seguridad() {
  return (
    <section id="seguridad" className="mx-auto max-w-6xl px-6 py-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.1em] text-signal-dark">
            Seguridad
          </span>
          <h2 className="mt-2 max-w-lg text-[clamp(1.8rem,3vw,2.8rem)] font-black leading-tight tracking-tight">
            Controles claros antes de operar con clientes reales.
          </h2>
        </div>
        <p className="max-w-sm text-muted">
          La plataforma funciona como piloto controlado mientras se completan y
          documentan los controles obligatorios del lanzamiento comercial.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {garantias.map((g) => (
          <article key={g.t} className="rounded-card border border-border bg-white p-6 shadow-panel">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-signal/15 font-black text-signal-dark">
              ✓
            </span>
            <h3 className="mt-4 text-base font-black tracking-tight">{g.t}</h3>
            <p className="mt-2 text-sm text-muted">{g.d}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const fases = [
  { n: "0", t: "Preparación", d: "Herramientas y entornos listos; decisiones confirmadas.", dur: "1–2 sem" },
  { n: "1", t: "Seguridad + Consola", d: "Login, roles, aislamiento y la Consola de Alta de Clientes.", dur: "4–6 sem" },
  { n: "2", t: "Catálogo y cotización", d: "Proveedores, tarifas, cotizaciones y reservas reales.", dur: "5–7 sem" },
  { n: "3", t: "Órdenes, cobro y móvil", d: "Compra vinculante, facturación, cobro y app móvil.", dur: "6–10 sem" },
];

function Fases() {
  return (
    <section id="fases" className="bg-fog py-20">
      <div className="mx-auto max-w-6xl px-6">
        <span className="text-xs font-black uppercase tracking-[0.1em] text-signal-dark">
          Implementación
        </span>
        <h2 className="mt-2 max-w-2xl text-[clamp(1.8rem,3vw,2.8rem)] font-black leading-tight tracking-tight">
          Cómo lo haremos: cuatro fases.
        </h2>
        <p className="mt-4 max-w-xl text-muted">
          Vamos por partes; cada fase entrega algo concreto. Primero los cimientos,
          después las compras reales. Total aproximado: 4–6 meses.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {fases.map((f) => (
            <article key={f.n} className="rounded-card border border-border bg-white p-6 shadow-panel">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest font-black text-white">
                  {f.n}
                </span>
                <span className="text-xs font-black uppercase tracking-wide text-muted">{f.dur}</span>
              </div>
              <h3 className="mt-4 text-lg font-black tracking-tight">{f.t}</h3>
              <p className="mt-2 text-sm text-muted">{f.d}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 rounded-card border border-amber/40 bg-amber/10 px-5 py-4 text-sm font-bold text-forest">
          Regla de oro: no se abre a clientes externos ni se cobra un solo dólar
          hasta tener la seguridad lista.
        </p>
      </div>
    </section>
  );
}

function Contacto() {
  return (
    <section id="contacto" className="mx-auto max-w-6xl px-6 py-20">
      <div className="rounded-panel bg-forest px-8 py-14 text-white sm:px-14">
        <h2 className="max-w-2xl text-[clamp(1.8rem,3vw,2.8rem)] font-black leading-tight tracking-tight">
          ¿Necesitas acceso o ayuda?
        </h2>
        <p className="mt-4 max-w-xl text-white/75">
          El acceso se habilita por invitación. Si necesitas una cuenta o ayuda para
          ingresar, contacta a tu administrador o al equipo de Ad Mavericks.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <a href="mailto:hola@admavericks.one" className="btn btn-primary">
            Escribir a Ad Mavericks →
          </a>
          <a href="/ingresar" className="btn btn-ghost">
            Iniciar sesión
          </a>
        </div>
      </div>
    </section>
  );
}
