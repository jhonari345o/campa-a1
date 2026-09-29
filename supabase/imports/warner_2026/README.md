# Importación Warner 2026

1. Ejecuta `supabase/migrations/0015_reporting_postbuys.sql`.
2. Ejecuta `01_seed_warner_2026.sql`.
3. Los registros quedan visibles únicamente para administradores porque se importan con `company_id = NULL`.
4. Cuando exista la empresa cliente en `public.companies`, asígnala explícitamente:

```sql
update public.postbuy_campaigns
set company_id = 'UUID-DE-LA-EMPRESA'
where client_name = 'Warner Bros. Discovery Ecuador';
```

El generador valida ambos libros, extrae las imágenes del Excel visual y conserva `NULL` cuando la nota fuente indica que la foto está pendiente. Para regenerar:

```powershell
python scripts/generate_warner_postbuy.py
```
