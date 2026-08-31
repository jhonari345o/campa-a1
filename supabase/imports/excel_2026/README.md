# Importacion auditable de los Excel 2026

Estos archivos convierten los dos libros entregados para el proyecto en SQL
idempotente para Supabase. La capa raw conserva cada fila original como JSONB;
la capa normalizada evita el doble conteo y mantiene el vinculo con el libro y
la fila de origen.

## Orden de ejecucion

Ejecutar primero `supabase/schema.sql` si la base todavia no tiene el esquema
principal del proyecto. Despues ejecutar, en este orden:

1. `00_raw_schema.sql`
2. `01_campaign_raw.sql`
3. `02_campaign_normalized.sql`
4. `03_radio.sql`
5. `99_validate_import.sql`

Los archivos grandes se pueden cargar con `psql` usando la cadena directa de
Supabase:

```powershell
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/imports/excel_2026/00_raw_schema.sql
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/imports/excel_2026/01_campaign_raw.sql
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/imports/excel_2026/02_campaign_normalized.sql
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/imports/excel_2026/03_radio.sql
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/imports/excel_2026/99_validate_import.sql
```

No guardar `SUPABASE_DB_URL`, contrasenas ni claves de servicio en Git.

## Conteos esperados

- 20.892 filas crudas del libro de inversion.
- 3.688 anunciantes normalizados; `Total General` permanece solo en raw.
- 7 resumenes por medio y 6 resumenes mensuales.
- 214 filas crudas de radio y 104 emisoras consolidadas.

`IMPORT_MANIFEST.json` incluye los SHA-256 de ambos Excel, IDs deterministas y
los conteos usados por la validacion final.

## Regeneracion

```powershell
python scripts/generate_excel_sql.py `
  --campaign-book "C:\ruta\20072026164449.xlsx" `
  --radio-book "C:\ruta\Rankings Radios.xlsx"
```

El generador solo crea los archivos de datos y validacion; no sobrescribe
`00_raw_schema.sql`.
