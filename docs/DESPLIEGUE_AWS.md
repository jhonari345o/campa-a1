# Despliegue en AWS — Ad Mavericks One

La app es Next.js 15 con SSR y middleware. La ruta recomendada es **AWS Amplify
Hosting**, que soporta Next.js de forma nativa (SSR, rutas dinamicas y middleware)
y entrega HTTPS, dominio y CDN. Alternativa por contenedor (ECS/Fargate) al final.

> **Control de seguridad fechado (24-08-2026):** el proyecto queda en Next.js
> `15.5.21`, ultima linea compatible documentada por Amplify. Next.js anuncio un
> parche critico para la linea 15.5 el **26-08-2026**. Antes del siguiente
> despliegue, actualizar al parche 15.5.x publicado ese dia, ejecutar
> `npm audit`, `npm run typecheck`, `npm run lint` y `npm run build`, y desplegar
> solo si todos finalizan correctamente. Si produccion estuvo en Next.js 15.1.6
> sin parche desde diciembre de 2025, rotar despues del despliegue la
> `SUPABASE_SERVICE_ROLE_KEY`, las credenciales de Bedrock y `AGENT_WORKER_TOKEN`.

## Opcion A — AWS Amplify Hosting (recomendada)

### 1. Conectar el repositorio
1. Consola de AWS → **Amplify** → *Create new app* → *Host web app*.
2. Elegir **GitHub** y autorizar. Seleccionar el repo `jhonari345o/campa-a1`
   y la rama de trabajo (`claude/adsmaiber-website-admin-9xc3cv`) o `main` cuando
   se fusione.
3. Amplify detecta Next.js automaticamente. El build spec ya esta en
   [`amplify.yml`](../amplify.yml).

### 2. Variables de entorno (App settings → Environment variables)
| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key (`sb_secret_...`) — solo servidor |
| `NEXT_PUBLIC_SITE_URL` | la URL publica que asigne Amplify (o el dominio) |

> La `SUPABASE_SERVICE_ROLE_KEY` nunca lleva el prefijo `NEXT_PUBLIC_`: asi jamas
> se envia al navegador. `next.config.mjs` tampoco debe contener secretos en su
> opcion `env`, porque Next.js los incorpora al bundle. `amplify.yml` crea el
> `.env.production` de runtime con una lista cerrada de variables.

Para Bedrock, asignar permisos al rol IAM del runtime de Amplify y definir solo
`BEDROCK_REGION` y `BEDROCK_MODEL_ID`. No guardar access keys AWS de larga vida
en las variables del proyecto. La `service_role` de Supabase y otros tokens
siguen siendo secretos de alto impacto: limitar el acceso a los artefactos de
despliegue y rotarlos ante cualquier sospecha de exposicion.

Por compatibilidad con la instalacion existente, el build tambien reconoce
`BEDROCK_ACCESS_KEY_ID` y `BEDROCK_SECRET_ACCESS_KEY` si ya estan configuradas en
Amplify. Deben migrarse a un rol IAM y eliminarse despues de comprobar que Mavi
responde con las credenciales temporales del runtime.

### 3. Desplegar
- *Save and deploy*. Amplify instala, construye (`npm run build`) y publica.
- Al terminar entrega una URL `https://<rama>.<appid>.amplifyapp.com`.

### 4. Escudo y respaldos (garantias de la propuesta)
- **WAF:** Amplify permite asociar **AWS WAF** a la app (Web ACL con reglas
  administradas + rate limiting) para el "escudo contra ataques".
- **Respaldos:** los datos viven en Supabase (Postgres) con *point-in-time
  recovery*; verificar la retencion en el plan del proyecto.
- **Monitoreo:** CloudWatch para metricas y alarmas de la app en AWS.

## Opcion B — Contenedor en ECS/Fargate

Para un control mas fino (o correr detras de ALB + WAF propio):

1. Activar salida `standalone` en `next.config.mjs`:
   ```js
   const nextConfig = { output: "standalone", reactStrictMode: true };
   ```
2. Construir la imagen con el [`Dockerfile`](../Dockerfile).
3. Publicar en **ECR**, desplegar en **ECS/Fargate** detras de un **ALB**.
4. Asociar **AWS WAF** al ALB. Definir las mismas variables de entorno como
   *secrets* (SSM Parameter Store / Secrets Manager) — la secret key nunca en la
   imagen.

## Checklist previo a abrir a clientes (regla de oro)
- [ ] `schema.sql` y `seed.sql` ejecutados en Supabase.
- [ ] Primer platform admin creado y verificado.
- [ ] Variables de entorno cargadas en Amplify (o secrets en ECS).
- [ ] WAF activo.
- [ ] Respaldos y point-in-time recovery confirmados.
- [ ] Secret key rotada tras la configuracion inicial.
