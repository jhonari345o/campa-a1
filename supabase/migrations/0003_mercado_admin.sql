-- =====================================================================
--  Migracion 0003 — La base de inversion publicitaria es SOLO de Ad Mavericks
--
--  Los clientes (terceros) ya NO pueden leer los datos de mercado directamente.
--  El Planificador de medios los consulta del lado del servidor con la clave
--  de servicio y solo devuelve el plan derivado, nunca la data cruda.
--
--  Aplicar en Supabase -> SQL Editor -> Run. Seguro re-ejecutar.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'data_sources', 'advertisers', 'media_channels', 'ad_investments', 'digital_metrics'
  ] loop
    -- Lectura: antes 'authenticated'; ahora solo platform_admin.
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format(
      'create policy %I_read on public.%I for select using (public.is_platform_admin())',
      t, t
    );
  end loop;
end $$;
