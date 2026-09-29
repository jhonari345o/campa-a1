-- Catálogo público y acotado de emisoras.
-- La función expone únicamente métricas de planificación; las filas fuente,
-- workbooks y demás tablas de importación conservan sus políticas privadas.

begin;

create or replace function public.get_radio_catalog()
returns table (
  station_name text,
  genre text,
  rating numeric,
  share numeric,
  rating_audience numeric,
  reach_audience numeric,
  reach_pct numeric,
  audience_rank integer,
  reach_rank integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    data.station_name,
    data.genre,
    data.rating,
    data.share,
    data.rating_audience,
    data.reach_audience,
    data.reach_pct,
    data.audience_rank,
    data.reach_rank
  from public.radio_station_metrics data
  join public.source_workbooks source on source.id = data.workbook_id
  where source.is_current
  order by data.audience_rank asc nulls last, data.station_name asc
  limit 150
$$;

revoke all on function public.get_radio_catalog() from public;
grant execute on function public.get_radio_catalog() to anon, authenticated;

comment on function public.get_radio_catalog() is
  'Catálogo público limitado de emisoras; no expone fuentes ni datos crudos de anunciantes.';

commit;
