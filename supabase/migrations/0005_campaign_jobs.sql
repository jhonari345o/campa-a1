-- =====================================================================
--  Migracion 0005 — Trabajos de campana (ejecucion por el agente Mavi)
--  Aplicar en Supabase -> SQL Editor -> Run. Seguro re-ejecutar.
-- =====================================================================

do $$ begin
  create type job_status as enum (
    'pendiente', 'en_proceso', 'listo_para_revision', 'publicada', 'error', 'cancelada'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.campaign_jobs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  platform    text not null,                 -- meta | google | tiktok | whatsapp
  spec        jsonb not null default '{}'::jsonb,
  status      job_status not null default 'pendiente',
  log         text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_jobs_company on public.campaign_jobs (company_id, created_at desc);
create index if not exists idx_jobs_status on public.campaign_jobs (status);

alter table public.campaign_jobs enable row level security;

-- Lectura: la empresa ve sus trabajos; el equipo Ad Mavericks ve todos.
drop policy if exists jobs_read on public.campaign_jobs;
create policy jobs_read on public.campaign_jobs
  for select using (
    public.is_platform_admin() or company_id in (select public.my_company_ids())
  );

-- Crear: solo miembros de la empresa, para su propia empresa.
drop policy if exists jobs_insert on public.campaign_jobs;
create policy jobs_insert on public.campaign_jobs
  for insert with check (company_id in (select public.my_company_ids()));

-- Actualizar/cancelar: solo el equipo Ad Mavericks (el agente usa la clave de servicio).
drop policy if exists jobs_admin_update on public.campaign_jobs;
create policy jobs_admin_update on public.campaign_jobs
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

drop trigger if exists trg_touch_campaign_jobs on public.campaign_jobs;
create trigger trg_touch_campaign_jobs
  before update on public.campaign_jobs
  for each row execute function public.touch_updated_at();
