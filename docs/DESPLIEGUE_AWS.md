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

## Checklist previo a abrir a clientes (regla de oro)
- [ ] `schema.sql` y `seed.sql` ejecutados en Supabase.
- [ ] Primer platform admin creado y verificado.
- [ ] Variables de entorno cargadas en Amplify (o secrets en ECS).
- [ ] WAF activo.
- [ ] Respaldos y point-in-time recovery confirmados.
- [ ] Secret key rotada tras la configuracion inicial.
