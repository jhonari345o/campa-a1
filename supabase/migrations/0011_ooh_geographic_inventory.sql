-- Inventario geográfico para recomendaciones de vía pública.
-- Separa activos comerciales reales de zonas candidatas: una zona candidata
-- jamás debe mostrarse como valla disponible ni con una tarifa inventada.

begin;

create table if not exists public.ooh_locations (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  status text not null default 'zone_candidate'
    check (status in ('inventory', 'zone_candidate', 'inactive')),
  catalog_item_id uuid references public.media_catalog_items(id) on delete set null,
  catalog_rate_id uuid references public.media_catalog_rates(id) on delete set null,
  provider_name text,
  asset_name text not null,
  city text not null,
  province text not null,
  address text not null,
  latitude numeric(9, 6) not null check (latitude between -5.5 and 2.0),
  longitude numeric(9, 6) not null check (longitude between -92.0 and -75.0),
  format text,
  monthly_rate_usd numeric(14, 2) check (monthly_rate_usd is null or monthly_rate_usd >= 0),
  production_rate_usd numeric(14, 2) check (production_rate_usd is null or production_rate_usd >= 0),
  audience_tags text[] not null default '{}'::text[],
  context_tags text[] not null default '{}'::text[],
  affluence_index numeric(6, 2) check (affluence_index is null or affluence_index between 0 and 100),
  affluence_source text,
  photo_url text,
  street_view_pano_id text,
  source_note text not null,
  verified_at date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ooh_locations_lookup_idx
  on public.ooh_locations (active, city, status, monthly_rate_usd);

alter table public.ooh_locations enable row level security;

drop policy if exists ooh_locations_read on public.ooh_locations;
create policy ooh_locations_read on public.ooh_locations
  for select to authenticated using (public.can_use_media_catalog());

drop policy if exists ooh_locations_admin_write on public.ooh_locations;
create policy ooh_locations_admin_write on public.ooh_locations
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop trigger if exists trg_touch_ooh_locations on public.ooh_locations;
create trigger trg_touch_ooh_locations before update on public.ooh_locations
  for each row execute function public.touch_updated_at();

grant select on public.ooh_locations to authenticated;

comment on table public.ooh_locations is
  'Activos OOH verificables y zonas candidatas. status=zone_candidate no representa disponibilidad comercial.';
comment on column public.ooh_locations.affluence_index is
  'Índice opcional de movilidad normalizado 0-100; solo completar junto con affluence_source.';

-- Puntos de referencia para muestreo visual. Son zonas de prospección, no
-- inventario contratado: tarifa, proveedor, flujo, foto y disponibilidad
-- permanecen pendientes hasta que un proveedor cargue su ficha comercial.
insert into public.ooh_locations (
  asset_code, status, asset_name, city, province, address, latitude, longitude,
  format, audience_tags, context_tags, source_note, verified_at
) values
  (
    'ZONE-GYE-MALL-DELSOL', 'zone_candidate', 'Entorno Mall del Sol · Av. Joaquín Orrantia',
    'Guayaquil', 'Guayas', 'Mall del Sol, Ciudadela Vernaza Norte', -2.155041, -79.892686,
    'Zona para búsqueda de vallas y pantallas',
    array['adultos 25-45 (hipótesis de planificación)', 'compradores', 'profesionales'],
    array['centro comercial', 'oficinas', 'movilidad urbana', 'aeropuerto'],
    'Coordenada de referencia OpenStreetMap/Nominatim verificada el 2026-08-27. No implica inventario, afluencia medida ni disponibilidad.',
    '2026-08-27'
  ),
  (
    'ZONE-GYE-SANMARINO', 'zone_candidate', 'Entorno San Marino Shopping · Kennedy',
    'Guayaquil', 'Guayas', 'San Marino Shopping, Kennedy', -2.169141, -79.898269,
    'Zona para búsqueda de vallas y pantallas',
    array['adultos 25-45 (hipótesis de planificación)', 'compradores', 'profesionales'],
    array['centro comercial', 'oficinas', 'movilidad urbana'],
    'Coordenada de referencia OpenStreetMap/Nominatim verificada el 2026-08-27. No implica inventario, afluencia medida ni disponibilidad.',
    '2026-08-27'
  ),
  (
    'ZONE-GYE-CJAROSEMENA', 'zone_candidate', 'Corredor Av. Carlos Julio Arosemena · Albán Borja',
    'Guayaquil', 'Guayas', 'Centro Comercial Albán Borja, Av. Carlos Julio Arosemena', -2.168693, -79.916651,
    'Zona para búsqueda de vallas y pantallas',
    array['adultos 25-45 (hipótesis de planificación)', 'estudiantes', 'compradores'],
    array['universidades', 'retail', 'movilidad urbana'],
    'Coordenada de referencia OpenStreetMap/Nominatim verificada el 2026-08-27. No implica inventario, afluencia medida ni disponibilidad.',
    '2026-08-27'
  ),
  (
    'ZONE-GYE-ORELLANA', 'zone_candidate', 'Corredor Av. Francisco de Orellana · WTC',
    'Guayaquil', 'Guayas', 'World Trade Center, Av. Francisco de Orellana', -2.163501, -79.897987,
    'Zona para búsqueda de vallas y pantallas',
    array['adultos 25-45 (hipótesis de planificación)', 'profesionales', 'ejecutivos'],
    array['oficinas', 'servicios', 'movilidad urbana'],
    'Coordenada de referencia OpenStreetMap/Nominatim verificada el 2026-08-27. No implica inventario, afluencia medida ni disponibilidad.',
    '2026-08-27'
  ),
  (
    'ZONE-GYE-25JULIO', 'zone_candidate', 'Corredor Av. 25 de Julio · Mall del Sur',
    'Guayaquil', 'Guayas', 'Mall del Sur, Av. 25 de Julio', -2.227227, -79.897963,
    'Zona para búsqueda de vallas y pantallas',
    array['adultos 25-45 (hipótesis de planificación)', 'familias', 'compradores'],
    array['retail', 'transporte', 'sur de Guayaquil', 'movilidad urbana'],
    'Coordenada de referencia OpenStreetMap/Nominatim verificada el 2026-08-27. No implica inventario, afluencia medida ni disponibilidad.',
    '2026-08-27'
  ),
  (
    'ZONE-GYE-URDESA', 'zone_candidate', 'Corredor Urdesa · Víctor Emilio Estrada',
    'Guayaquil', 'Guayas', 'Urdesa Central / Parque Urdesa', -2.176354, -79.905004,
    'Zona para búsqueda de vallas y pantallas',
    array['adultos 25-45 (hipótesis de planificación)', 'residentes', 'profesionales'],
    array['gastronomía', 'servicios', 'residencial', 'movilidad urbana'],
    'Coordenada de referencia OpenStreetMap/Nominatim verificada el 2026-08-27. No implica inventario, afluencia medida ni disponibilidad.',
    '2026-08-27'
  ),
  (
    'ZONE-SAM-PLAZALAGOS', 'zone_candidate', 'Entorno Plaza Lagos · Av. Samborondón',
    'Samborondón', 'Guayas', 'Plaza Lagos, Avenida Samborondón', -2.098392, -79.875193,
    'Zona para búsqueda de vallas y pantallas',
    array['adultos 25-45 (hipótesis de planificación)', 'familias', 'profesionales'],
    array['gastronomía', 'retail', 'movilidad urbana'],
    'Coordenada de referencia OpenStreetMap/Nominatim verificada el 2026-08-27. No implica inventario, afluencia medida ni disponibilidad.',
    '2026-08-27'
  ),
  (
    'ZONE-UIO-ELJARDIN', 'zone_candidate', 'Entorno Mall El Jardín · Av. de la República',
    'Quito', 'Pichincha', 'Mall El Jardín, La Carolina, Iñaquito', -0.190190, -78.487031,
    'Zona para búsqueda de vallas y pantallas',
    array['adultos 25-45 (hipótesis de planificación)', 'compradores', 'profesionales'],
    array['centro comercial', 'oficinas', 'movilidad urbana'],
    'Coordenada de referencia OpenStreetMap/Nominatim verificada el 2026-08-27. No implica inventario, afluencia medida ni disponibilidad.',
    '2026-08-27'
  ),
  (
    'ZONE-CUE-MALLDELRIO', 'zone_candidate', 'Entorno Mall del Río · Av. Felipe II',
    'Cuenca', 'Azuay', 'Mall del Río, Yanuncay', -2.919048, -79.015708,
    'Zona para búsqueda de vallas y pantallas',
    array['adultos 25-45 (hipótesis de planificación)', 'familias', 'compradores'],
    array['centro comercial', 'retail', 'movilidad urbana'],
    'Coordenada de referencia OpenStreetMap/Nominatim verificada el 2026-08-27. No implica inventario, afluencia medida ni disponibilidad.',
    '2026-08-27'
  )
on conflict (asset_code) do nothing;

commit;
