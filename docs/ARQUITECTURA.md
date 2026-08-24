# Arquitectura — Ad Mavericks One

Documento de trabajo. Traduce la propuesta a dueños (agosto 2026) en decisiones
tecnicas concretas.

## 1. Principios

1. **Seguridad primero.** No se abre a clientes externos ni se cobra hasta tener
   la seguridad lista (regla de oro).
2. **Multiempresa aislado.** Cada empresa en su propio "cuarto": nunca ve ni
   busca datos de otra. Se implementa con Row Level Security (RLS) en Postgres.
3. **Datos honestos.** Si un dato no esta verificado, se marca `pendiente`.
   Nunca se inventa una cifra.
4. **Simple para el equipo.** La Consola de Alta la usan personas que no
   programan: escriben un nombre y el sistema hace el resto.

## 2. Componentes

```
Navegador ──▶ Next.js (App Router)
                 │
                 ├─ Sitio publico (marketing)
                 ├─ Ingreso de clientes (login por invitacion)
                 ├─ Plataforma (planificacion / compra / control)  [fases 2-3]
                 └─ Consola de Alta de Clientes (solo staff)
                       │
                       ▼
              Supabase (Postgres + Auth + RLS)
                       │
                       ▼
              Infraestructura AWS (WAF, respaldos, monitoreo)

Equipo Ad Mavericks ──▶ Consola local (127.0.0.1)
                              │ service_role solo en el proceso local
                              └──────────────▶ Supabase Auth + Postgres
```

- **Supabase** provee la base de datos, la autenticacion y el aislamiento por
  RLS. Es la fuente de verdad de datos y acceso.
- **AWS** aporta el escudo (WAF), respaldos automaticos con recuperacion a un
  punto en el tiempo, y vigilancia. El sitio Next.js se despliega aqui.
- **Consola local** permite crear usuarios sin publicar esa herramienta ni su
  `service_role`; corre como un proceso Node separado y escucha solo en loopback.

## 3. Modelo de datos

### Tenancy (aislamiento por cliente)

- `companies` — cada empresa cliente (tenant), con estado y numero de asientos.
- `profiles` — 1:1 con `auth.users`; `is_platform_admin` marca al equipo Ad Mavericks.
- `company_members` — relacion usuario↔empresa con rol (`admin`, `planner`,
  `analyst`, `viewer`). Varias personas por empresa.
- `registration_codes` — codigos de alta tipo `AMK-2026-CRESA-7F3Q`.
- `audit_log` — quien hizo que y cuando.

Las politicas RLS usan `is_platform_admin()` y `my_company_ids()` para que cada
usuario solo alcance su propia empresa; el staff de Ad Mavericks administra todo.

### Base de inversion publicitaria (inteligencia de mercado)

Datos de referencia compartidos (no por tenant). Lectura para usuarios
autenticados; escritura solo para el equipo.

- `data_sources` — Superintendencia de Companias, Superintendencia de Bancos,
  canales de TV, Google Ads, Google Analytics, Meta Ads.
- `advertisers` — empresas anunciantes (RUC, sector, provincia).
- `media_channels` — medios/canales por tipo (TV, radio, digital, etc.).
- `ad_investments` — inversion por anunciante, medio y periodo (con `status`).
- `digital_metrics` — impresiones, clics, CTR, CPC, CPM, CPA, spend, conversiones.

Todo dato entra como `pendiente` hasta ser verificado contra su fuente.

## 4. Roadmap (4 fases)

| Fase | Entrega | Duracion |
| --- | --- | --- |
| 0 · Preparacion | Entornos y decisiones confirmadas. | 1–2 sem |
| 1 · Seguridad + Consola | Login, roles, aislamiento y Consola de Alta. | 4–6 sem |
| 2 · Catalogo y cotizacion | Proveedores, tarifas, cotizaciones, reservas. | 5–7 sem |
| 3 · Ordenes, cobro y movil | Compra vinculante, facturacion, cobro, app. | 6–10 sem |

## 5. Seguridad — cuatro garantias

1. **Aislamiento por cliente** (RLS en Supabase).
2. **Respaldos probados** (recuperacion a un punto en el tiempo).
3. **Escudo contra ataques** (WAF y control de abuso en AWS).
4. **Datos honestos** (`status = pendiente` mientras no se verifica).

## 6. Variables de entorno

Ver [`.env.example`](../.env.example). La `service_role key` vive solo en el
servidor y jamas se envia al navegador.
