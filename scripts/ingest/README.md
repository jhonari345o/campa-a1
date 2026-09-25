# Ingesta de datos de mercado

Alimenta la base de **inversion publicitaria** con datos de fuentes reales.
Todo entra como **`pendiente`** salvo que se indique `verificado` — regla de
"datos honestos": nada se trata como definitivo sin verificar.

## Requisitos

- Node 20.6+ (para `--env-file`).
- `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- `schema.sql` ya ejecutado en Supabase.

Las claves secretas viven solo en tu maquina o en el entorno del job; nunca se
commitean.

## 1) Importar desde CSV

```bash
npx tsx --env-file=.env.local scripts/ingest/import.ts advertisers  data/samples/advertisers.csv
npx tsx --env-file=.env.local scripts/ingest/import.ts channels     data/samples/channels.csv
npx tsx --env-file=.env.local scripts/ingest/import.ts investments  data/samples/investments.csv
npx tsx --env-file=.env.local scripts/ingest/import.ts metrics      data/samples/metrics.csv
```

### Datos reales ya incluidos

En `data/` hay datos reales listos para cargar (monitoreo de medios y radios):

```bash
npx tsx --env-file=.env.local scripts/ingest/import.ts investments data/inversion_medios_2026.csv  # ~5.000 registros, ~3.700 anunciantes
npx tsx --env-file=.env.local scripts/ingest/import.ts channels    data/radios.csv                 # 104 emisoras
```

Entran como `pendiente` (por verificar). Marca `verificado` desde la Consola cuando confirmes contra la fuente.

Los importadores son **idempotentes**: si vuelves a correrlos, actualizan en
vez de duplicar (dedup por RUC/nombre, y por anunciante+medio/plataforma+periodo).

### Columnas admitidas (acepta español o inglés)
- **advertisers:** `name`/`nombre`, `ruc`/`legal_id`, `sector`, `province`/`provincia`, `status`/`estado`, `source`/`fuente`.
- **investments:** `advertiser`/`anunciante`, `ruc`, `media_type`/`medio`, `year`/`anio`, `month`/`mes`, `amount_usd`/`monto`, `status`, `source`, `notes`.
- **metrics:** `advertiser`, `ruc`, `platform`/`plataforma`, `year`, `month`, `impressions`, `clicks`, `spend_usd`, `conversions`, `status`, `source`.

### De dónde salen los CSV
- **Superintendencia de Companias / Bancos:** exporta el directorio de companias
  (RUC, razon social, actividad, provincia) y mapea a `advertisers`.
- **Canales de television:** inversion publicitaria de informacion publica →
  `investments` con `source = "Canales de television (informacion publica)"`.

## 2) Conectores de APIs (metricas propias de cuenta)

```bash
npx tsx --env-file=.env.local scripts/ingest/connectors/meta-ads.ts   "Cerveceria del Litoral" 2026 7
npx tsx --env-file=.env.local scripts/ingest/connectors/google-ads.ts "Cerveceria del Litoral" 2026 7
```

Variables necesarias (ver `.env.example`):
- **Meta Ads:** `META_ADS_ACCESS_TOKEN`, `META_ADS_ACCOUNT_ID`.
- **Google Ads:** `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`,
  `GOOGLE_ADS_OAUTH_ACCESS_TOKEN` (y opcional `GOOGLE_ADS_LOGIN_CUSTOMER_ID`).

## 3) Automatizar (opcional)

Programa la ingesta con un cron o un GitHub Action nocturno que corra los
comandos de arriba con las claves como *secrets*. Ver
`.github/workflows/ingest.yml` como punto de partida.
