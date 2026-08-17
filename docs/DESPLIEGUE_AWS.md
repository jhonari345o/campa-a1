# Despliegue en AWS — Ad Mavericks One

La app es Next.js 15 con SSR y middleware. La ruta recomendada es **AWS Amplify
Hosting**, que soporta Next.js de forma nativa (SSR, rutas dinamicas, middleware)
y entrega HTTPS, dominio y CDN. Alternativa por contenedor (ECS/Fargate) al final.

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
> se envia al navegador.

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

## Solución de problemas: la conexión con Supabase se cae en AWS

Si en local funciona pero al subir a AWS "se corta la conexión con la base"
(páginas que redirigen a *Falta configurar Supabase*, o los formularios que no
guardan), casi siempre es una de estas causas — revísalas en orden:

1. **Variables `NEXT_PUBLIC_*` ausentes en el build.** Estas se "hornean" en el
   momento del `npm run build`, no en tiempo de ejecución. Si las cargaste en
   Amplify *después* del primer deploy, hay que **volver a construir** (Redeploy /
   *Clear cache and redeploy*), no solo reiniciar. Sin ellas, el navegador apunta
   a `undefined` y toda llamada a Supabase falla.

2. **Llaves cruzadas.** `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la *publishable*
   (`sb_publishable_...`); `SUPABASE_SERVICE_ROLE_KEY` = la *secret*
   (`sb_secret_...`) y **sin** el prefijo `NEXT_PUBLIC_`. Si se invierten, el
   servidor no autentica y el cliente queda sin permisos.

3. **La app se sirvió como estático, no como SSR.** El middleware y los Server
   Actions necesitan cómputo. En Amplify confirma que la app quedó como
   **Next.js (Web Compute / SSR)**, no como *Static*. Si no, la sesión no se
   refresca y las acciones no corren.

4. **Proyecto Supabase pausado.** En el plan gratuito, Supabase **pausa** el
   proyecto por inactividad y rechaza conexiones hasta reanudarlo desde el panel.
   Súbelo a un plan con actividad continua antes de abrir a clientes.

5. **Egress bloqueado (solo ECS/Fargate).** Si usas la Opción B detrás de un ALB
   en subredes privadas, la tarea necesita salida a internet (NAT Gateway) para
   llegar a `*.supabase.co` por HTTPS. Sin NAT, la conexión "se cuelga".

> El sitio habla con Supabase por **HTTPS (API REST)**, no por una conexión
> Postgres directa: no hay pooler ni `DATABASE_URL` que configurar aquí. Si el
> corte fue al **pegar `schema.sql` en el SQL Editor**, es independiente de AWS —
> el script es idempotente, vuelve a ejecutarlo (o por secciones si el editor
> corta los bloques `do $$ ... $$` largos).

## Checklist previo a abrir a clientes (regla de oro)
- [ ] `schema.sql` y `seed.sql` ejecutados en Supabase.
- [ ] Primer platform admin creado y verificado.
- [ ] Variables de entorno cargadas en Amplify (o secrets en ECS).
- [ ] WAF activo.
- [ ] Respaldos y point-in-time recovery confirmados.
- [ ] Secret key rotada tras la configuracion inicial.
