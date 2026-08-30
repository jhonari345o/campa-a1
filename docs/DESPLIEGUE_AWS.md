# Despliegue en AWS — Ad Mavericks One

La app es Next.js 15 con SSR y middleware. La ruta recomendada es **AWS Amplify
Hosting**, que soporta Next.js de forma nativa (SSR, rutas dinamicas y middleware)
y entrega HTTPS, dominio y CDN. Alternativa por contenedor (ECS/Fargate) al final.

> **Control de seguridad:** antes de cada despliegue se ejecutan typecheck,
> lint, pruebas, build y auditoria de dependencias. Las credenciales de alto
> impacto deben rotarse ante cualquier sospecha de exposicion.

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
| `COMMERCIAL_PAYMENTS_ENABLED` | `false` hasta aprobar cobros reales |
| `META_PAUSED_DRAFTS_ENABLED` | `false` hasta aprobar la prueba pausada |
| `META_REAL_SPEND_ENABLED` | `false` hasta aprobar pauta con gasto |
| `AI_ASSISTANT_ENABLED` | `false` hasta aprobar proveedor y tratamiento de datos |
| `AI_WEB_TRENDS_ENABLED` | `true` solo si Mavi puede consultar fuentes publicas recientes |
| `AI_PROVIDER` | `openrouter`, `bedrock`, `deepseek` o `compatible` |
| `OPENROUTER_API_KEY` | clave API de inferencia; no usar una Management Key |
| `OPENROUTER_MODEL` | modelo principal aprobado; en Amplify se usa `minimax/minimax-m3:free` por su menor latencia observada |
| `OPENROUTER_FALLBACK_MODELS` | respaldos separados por coma; para cero costo: `google/gemma-4-26b-a4b-it:free,openrouter/free` |
| `AGENT_AUTOMATION_ENABLED` | `false` hasta aprobar el worker automatizado |
| `DLOCALGO_ENV` | `sandbox` hasta aprobar la prueba; luego `live` |
| `DLOCALGO_API_KEY` | API Key de dLocal Go (solo servidor) |
| `DLOCALGO_SECRET_KEY` | Secret Key de dLocal Go (solo servidor) |
| `META_ACCESS_TOKEN` | token de Marketing API (solo servidor) |
| `META_APP_ID` | ID publico de la app de Meta |
| `META_AD_ACCOUNT_ID` | cuenta `act_...` que pagara la pauta |
| `META_PAGE_ID` | pagina de Facebook vinculada |
| `META_INSTAGRAM_USER_ID` | cuenta profesional de Instagram vinculada |
| `META_GRAPH_API_VERSION` | version estable habilitada, por ejemplo `v25.0` |
| `META_MAX_CAMPAIGN_BUDGET_USD` | tope por campaña; empieza en `500` |
| `META_CAMPAIGN_DURATION_DAYS` | duracion del presupuesto, empieza en `7` |

> La `SUPABASE_SERVICE_ROLE_KEY` nunca lleva el prefijo `NEXT_PUBLIC_`: asi jamas
> se envia al navegador. `next.config.mjs` tampoco debe contener secretos en su
> opcion `env`, porque Next.js los incorpora al bundle. `amplify.yml` crea el
> `.env.production` de runtime con una lista cerrada de variables.

Para Bedrock, asignar permisos al rol IAM del runtime de Amplify y definir solo
`BEDROCK_REGION` y `BEDROCK_MODEL_ID`. El build rechaza el uso de access keys AWS
de larga vida como variables del proyecto. La `service_role` de Supabase y otros
tokens siguen siendo secretos de alto impacto: limitar el acceso a los artefactos
de despliegue y rotarlos ante cualquier sospecha de exposicion.

### 3. Desplegar
- *Save and deploy*. Amplify instala, construye (`npm run build`) y publica.
- Al terminar entrega una URL `https://<rama>.<appid>.amplifyapp.com`.

### 4. Escudo y respaldos (pendientes de evidencia)
- **WAF:** asociar AWS WAF a la app, activar reglas administradas y limites por
  IP/ruta, y guardar evidencia de una prueba de bloqueo.
- **Respaldos:** confirmar el plan y retencion de Supabase y ejecutar una
  restauracion de prueba en un entorno separado.
- **Monitoreo:** configurar alarmas de AWS y captura de errores sin registrar
  tokens, PII ni datos licenciados.

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
- [x] Migraciones hasta `0014_legal_acceptances.sql` ejecutadas y políticas RLS verificadas.
- [ ] Primer platform admin creado y verificado.
- [ ] Autorregistro desactivado en Supabase Auth; usuarios creados solo por administracion.
- [ ] Variables de entorno cargadas en Amplify (o secrets en ECS).
- [ ] dLocal Go configurado primero en sandbox, con `notification_url` pública y HTTPS.
- [ ] Firma HMAC, retorno, reintentos e idempotencia dLocal probados con una orden controlada.
- [ ] Conciliación contable aprobada: cobro dLocal y factura Meta son movimientos separados.
- [ ] Meta Marketing API aprobada; campaña de prueba creada en `PAUSED` sin gasto.
- [ ] Boton **Verificar conexion con Meta** confirma activos y permisos sin crear anuncios.
- [ ] Mavi muestra fuentes pertinentes de los ultimos 90 dias y declara el periodo de la base interna.
- [ ] `COMMERCIAL_PAYMENTS_ENABLED=false` y `META_REAL_SPEND_ENABLED=false`
      hasta que los controles P0/P1 tengan evidencia aprobada.
- [ ] Pruebas de aislamiento entre dos empresas y roles ejecutadas.
- [ ] Retencion, exportacion y borrado de datos aprobados por legal.
- [x] Aceptación versionada de términos, privacidad, tratamiento y política de pagos registrada con auditoría; la aprobación jurídica final sigue siendo responsabilidad del negocio.
- [ ] WAF activo.
- [ ] Respaldos y point-in-time recovery confirmados.
- [ ] Secret key rotada tras la configuracion inicial.
