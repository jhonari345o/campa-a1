-- =====================================================================
--  Migracion 0006 — Inversion publicitaria MENSUAL (enero-junio 2026)
--
--  Tabla NUEVA y aparte de ad_investments (que guarda el total por medio).
--  Aqui va el detalle mes a mes por anunciante, para analizar estacionalidad
--  (en que meses invierte mas la competencia). No se mezcla con el total anual,
--  asi que no hay riesgo de duplicar ni inflar sumas.
--
--  Datos SOLO para el equipo Ad Mavericks (misma regla que la base de mercado).
--  Aplicar en Supabase -> SQL Editor -> Run. Seguro re-ejecutar.
-- =====================================================================

create table if not exists public.ad_investments_monthly (
  id             uuid primary key default gen_random_uuid(),
  advertiser_id  uuid not null references public.advertisers (id) on delete cascade,
  period_year    smallint not null,
  period_month   smallint not null check (period_month between 1 and 12),
  amount_usd     numeric(16, 2),
  avisos         integer,
  status         data_status not null default 'pendiente',
  source_id      uuid references public.data_sources (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- Clave natural: un registro por anunciante/anio/mes. Permite carga idempotente.
create unique index if not exists uq_inv_monthly
  on public.ad_investments_monthly (advertiser_id, period_year, period_month);

create index if not exists idx_inv_monthly_period
  on public.ad_investments_monthly (period_year, period_month);

-- RLS: lectura y escritura SOLO para el equipo Ad Mavericks (platform admin).
alter table public.ad_investments_monthly enable row level security;

drop policy if exists inv_monthly_read on public.ad_investments_monthly;
create policy inv_monthly_read on public.ad_investments_monthly
  for select using (public.is_platform_admin());

drop policy if exists inv_monthly_admin_write on public.ad_investments_monthly;
create policy inv_monthly_admin_write on public.ad_investments_monthly
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
