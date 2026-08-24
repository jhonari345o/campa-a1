# Ad Mavericks One

Sitio web, consola de administracion y base de inversion publicitaria para
**Ad Mavericks** — la central de medios del nuevo siglo (Guayaquil, Ecuador).

De una demostracion a un producto real, seguro y multiempresa.

## Que incluye este repositorio

| Modulo | Estado | Descripcion |
| --- | --- | --- |
| **Sitio publico** | listo | Landing y precios con identidad Ad Mavericks. |
| **Plataforma autenticada** | lista | Login, panel, planificador, campanas y mercado con aislamiento por empresa. |
| **Mavi (IA)** | lista para configurar | Asistente conectado a Amazon Bedrock o a un endpoint LLM compatible. |
| **Pauta externa** | flujo listo | URL del anuncio, segmentacion en mapa de Ecuador con radio, pago demo, 22% de impuestos/costos y 25% de comision. |
| **Base de datos (Supabase)** | SQL listo | Esquema multiempresa con RLS, datos operativos y archivo auditable de los Excel. |
| **Consola web de clientes** | lista | Alta de empresas, codigos y cupos para el equipo Ad Mavericks. |
| **Consola local de usuarios** | lista | Alta directa de usuarios; escucha solo en `127.0.0.1`. |

## Stack

- **Next.js 15.5** (App Router) + **React 19** + **TypeScript**
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
4. Para cargar la conversion completa y auditable de los dos Excel, seguir
   [`supabase/imports/excel_2026/README.md`](supabase/imports/excel_2026/README.md).

Detalle completo en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Scripts

| Comando | Accion |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion |
| `npm run start` | Servir el build |
| `npm run typecheck` | Verificar tipos |
| `npm run admin:dev` | Abrir la consola de usuarios en `127.0.0.1:4177` |
| `npm run sql:generate` | Regenerar los SQL desde los dos Excel fuente |

## Consola local de usuarios

La consola local no forma parte de las rutas de Next.js y no se publica en
AWS Amplify. Para usarla:

```powershell
Copy-Item admin-console/.env.example admin-console/.env.local
npm run admin:dev
```

Completar el archivo local con la URL de Supabase, la `service_role` y una frase
de acceso de al menos 16 caracteres. La clave de servicio permanece en el
proceso Node local y no llega al navegador. Ver
[`admin-console/README.md`](admin-console/README.md).

## Marca

La identidad visual sigue el *Manual de identidad Ad Mavericks v1.0*. Regla:
consistencia antes que decoracion. Un CTA principal por vista; datos honestos
(si algo no esta verificado, se marca **pendiente**).
