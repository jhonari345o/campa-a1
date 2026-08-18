import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MaviFull } from "@/components/Mavi";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Plataforma />
        <ComoFunciona />
        <Seguridad />
        <Fases />
        <Contacto />
      </main>
      <SiteFooter />
    </>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-8 pt-14">
      <div className="relative overflow-hidden rounded-hero bg-[linear-gradient(115deg,#17281f,#22392f_55%,#24596a)] px-8 py-16 text-white shadow-panel sm:px-16 sm:py-24">
        <span className="text-xs font-black uppercase tracking-[0.1em] text-signal">
          Central de medios · Ecuador
        </span>
        <h1 className="mt-4 max-w-3xl text-[clamp(2.6rem,6vw,5rem)] font-black leading-[0.96] tracking-tightest">
          Tu central de medios del nuevo siglo.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/75">
          Ad Mavericks convierte una operacion compleja de medios en una
          experiencia clara, segura y extraordinariamente facil de comprender.
        </p>
        <div className="mt-9 flex flex-wrap gap-4">
          <a href="#contacto" className="btn btn-primary">
            Solicitar acceso →
          </a>
          <a href="#como-funciona" className="btn btn-secondary">
            Ver como funciona
          </a>
        </div>
        <div className="accent-line mt-10" />
        <MaviFull
          height={360}
          className="pointer-events-none absolute bottom-0 right-6 z-[1] hidden lg:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-72 h-[550px] w-[550px] rounded-full border border-white/15"
          style={{ boxShadow: "0 0 0 45px rgba(255,255,255,.035), 0 0 0 92px rgba(255,255,255,.02)" }}
        />
      </div>
    </section>
  );
}

const pilares = [
  {
    title: "Planificacion clara",
    body: "Ordenamos la complejidad y entregamos un plan de medios entendible, accionable y listo para avanzar.",
  },
  {
    title: "Compra con criterio",
    body: "Seleccionamos canales por afinidad, cobertura y eficiencia. La tecnologia acelera; el criterio eleva el resultado.",
  },
  {
    title: "Control multiempresa",
    body: "Cada cliente entra con su cuenta corporativa segura y aislada. Reservas, ordenes, facturas y auditoria.",
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
          Inteligencia operativa, catalogo estructurado y decisiones comerciales
          mas agiles — en un mismo lugar.
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
  { n: "02", t: "Analizar al publico", d: "Edad, ubicacion, intereses, habitos, dispositivos y momentos de exposicion." },
  { n: "03", t: "Disenar la estrategia", d: "Que canales, que rol tiene cada uno, cuanto presupuesto y por cuanto tiempo." },
  { n: "04", t: "Planificar la campana", d: "Fechas, formatos, ubicaciones, audiencias, inversion y resultados estimados." },
  { n: "05", t: "Comprar los espacios", d: "Reserva y negociacion en TV, radio, via publica, prensa, digital y streaming." },
  { n: "06", t: "Medir y optimizar", d: "Alcance, frecuencia, conversiones, CPC/CPM/CPA y retorno de inversion." },
];

function ComoFunciona() {
  return (
    <section id="como-funciona" className="bg-forest-deep py-20 text-white">
      <div className="mx-auto max-w-6xl px-6">
        <span className="text-xs font-black uppercase tracking-[0.1em] text-signal">
          Como funciona
        </span>
        <h2 className="mt-2 max-w-2xl text-[clamp(1.8rem,3vw,2.8rem)] font-black leading-tight tracking-tight">
          Del objetivo de negocio al resultado medible.
        </h2>
        <p className="mt-4 max-w-xl text-white/70">
          Una central de medios decide donde, cuando, como y ante quien invertir
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
  { t: "Aislamiento por cliente", d: "Cada empresa en su propio cuarto. Nunca puede ver ni buscar datos de otra." },
  { t: "Respaldos probados", d: "Copias automaticas y recuperacion a un punto en el tiempo, verificadas periodicamente." },
  { t: "Escudo contra ataques", d: "Proteccion WAF y control de abuso sobre la infraestructura AWS." },
  { t: "Datos honestos", d: "Si un dato no esta verificado, se marca pendiente. Nunca se inventa una cifra." },
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
            Su informacion, protegida y respaldada.
          </h2>
        </div>
        <p className="max-w-sm text-muted">
          Datos y acceso sobre Supabase; escudo, respaldos y vigilancia sobre AWS.
          Cuatro garantias desde el primer dia.
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
  { n: "0", t: "Preparacion", d: "Herramientas y entornos listos; decisiones confirmadas.", dur: "1–2 sem" },
  { n: "1", t: "Seguridad + Consola", d: "Login, roles, aislamiento y la Consola de Alta de Clientes.", dur: "4–6 sem" },
  { n: "2", t: "Catalogo y cotizacion", d: "Proveedores, tarifas, cotizaciones y reservas reales.", dur: "5–7 sem" },
  { n: "3", t: "Ordenes, cobro y movil", d: "Compra vinculante, facturacion, cobro y app movil.", dur: "6–10 sem" },
];

function Fases() {
  return (
    <section id="fases" className="bg-fog py-20">
      <div className="mx-auto max-w-6xl px-6">
        <span className="text-xs font-black uppercase tracking-[0.1em] text-signal-dark">
          Implementacion
        </span>
        <h2 className="mt-2 max-w-2xl text-[clamp(1.8rem,3vw,2.8rem)] font-black leading-tight tracking-tight">
          Como lo haremos: cuatro fases.
        </h2>
        <p className="mt-4 max-w-xl text-muted">
          Vamos por partes; cada fase entrega algo concreto. Primero los cimientos,
          despues las compras reales. Total aproximado: 4–6 meses.
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
          Regla de oro: no se abre a clientes externos ni se cobra un solo dolar
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
          El siguiente paso.
        </h2>
        <p className="mt-4 max-w-xl text-white/75">
          Confirmar unas pocas decisiones y entregar los primeros accesos. Con eso
          arrancamos la Fase 1: seguridad, cuentas y la Consola de Alta de Clientes.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <a href="mailto:hola@admavericks.one" className="btn btn-primary">
            Escribir a Ad Mavericks →
          </a>
          <a href="/ingresar" className="btn btn-ghost">
            Ingresar a mi cuenta
          </a>
        </div>
      </div>
    </section>
  );
}
