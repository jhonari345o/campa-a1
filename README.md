# Ad Mavericks One

Sitio web, consola de administracion y base de inversion publicitaria para
**Ad Mavericks** — la central de medios del nuevo siglo (Guayaquil, Ecuador).

De una demostracion a un producto real, seguro y multiempresa.

## Que incluye este repositorio

| Modulo | Estado | Descripcion |
| --- | --- | --- |
| **Sitio publico** | base lista | Landing de marca (identidad Ad Mavericks). |
| **Base de datos (Supabase)** | SQL listo | Esquema multiempresa con aislamiento (RLS) + base de inversion publicitaria. |
| **Consola de Alta de Clientes** | en progreso | Panel del equipo Ad Mavericks para dar de alta clientes y generar codigos. |
| **Ingreso de clientes / plataforma** | siguiente | Login por invitacion, roles y cuenta aislada por empresa. |

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** con los tokens del manual de marca (forest / signal green, Nunito Sans)
- **Supabase** — Postgres, Auth y RLS (datos y acceso)
- **AWS** — infraestructura: WAF, respaldos y monitoreo (fase de despliegue)

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar con las claves de Supabase
npm run dev                  # http://localhost:3000
```

### Base de datos (Camino A)

1. Crear un proyecto en [app.supabase.com](https://app.supabase.com).
2. Copiar `Project URL`, `anon key` y `service_role key` a `.env.local`.
3. En el **SQL Editor** de Supabase, pegar y ejecutar:
   - `supabase/schema.sql` (tablas, RLS, funciones y triggers)
   - `supabase/seed.sql` (primer admin + fuentes de datos)

Detalle completo en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Scripts

| Comando | Accion |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion |
| `npm run start` | Servir el build |
| `npm run typecheck` | Verificar tipos |

## Marca

La identidad visual sigue el *Manual de identidad Ad Mavericks v1.0*. Regla:
consistencia antes que decoracion. Un CTA principal por vista; datos honestos
(si algo no esta verificado, se marca **pendiente**).
