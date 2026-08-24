-- Ad Mavericks One · Verificación posterior a la importación
-- Ejecutar al final. Una diferencia detiene la transacción con un mensaje claro.

do $$
begin
  if (select count(*) from public.source_sheet_rows where workbook_id = 'f8f920cd-8c07-5713-98f1-19fb63c8cb4f'::uuid) <> 20892 then
    raise exception 'Filas crudas de inversión incompletas';
  end if;
  if (select count(*) from public.advertiser_media_investment where workbook_id = 'f8f920cd-8c07-5713-98f1-19fb63c8cb4f'::uuid) <> 3688 then
    raise exception 'Anunciantes normalizados incompletos';
  end if;
  if (select count(*) from public.market_media_summary where workbook_id = 'f8f920cd-8c07-5713-98f1-19fb63c8cb4f'::uuid) <> 7 then
    raise exception 'Resumen por medios incompleto';
  end if;
  if (select count(*) from public.market_monthly_summary where workbook_id = 'f8f920cd-8c07-5713-98f1-19fb63c8cb4f'::uuid) <> 6 then
    raise exception 'Resumen mensual incompleto';
  end if;
  if (select count(*) from public.source_sheet_rows where workbook_id = '1d9a2753-2977-5837-a3b3-1335e5bc665f'::uuid) <> 214 then
    raise exception 'Filas crudas de radio incompletas';
  end if;
  if (select count(*) from public.radio_station_metrics where workbook_id = '1d9a2753-2977-5837-a3b3-1335e5bc665f'::uuid) <> 104 then
    raise exception 'Radios normalizadas incompletas';
  end if;
end $$;

select file_name, sha256, imported_at, metadata
from public.source_workbooks
order by imported_at desc;
