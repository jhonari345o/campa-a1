-- =====================================================================
--  AD MAVERICKS ONE — Esquema de base de datos (Supabase / PostgreSQL)
--  Version 1.0 · Agosto 2026
--
--  Contenido:
--    1. Extensiones y tipos
--    2. Tenancy: empresas, perfiles, miembros y roles
--    3. Codigos de registro (Consola de Alta de Clientes)
--    4. Auditoria
--    5. Funciones de ayuda para RLS (aislamiento por cliente)
--    6. Politicas RLS (cada empresa en su propio "cuarto")
--    7. Base de inversion publicitaria (inteligencia de mercado)
--    8. Triggers (perfil automatico, updated_at)
--
--  Como aplicarlo:
--    Supabase -> SQL Editor -> pegar todo -> Run.
--    Es seguro re-ejecutarlo: usa IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY.
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. Extensiones y tipos
-- ------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";        -- correos case-insensitive

do $$ begin
  create type company_role as enum ('admin', 'planner', 'analyst', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type company_status as enum ('activa', 'suspendida', 'pendiente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type data_status as enum ('verificado', 'pendiente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_type as enum (
    'tv_abierta', 'tv_paga', 'radio', 'prensa', 'revistas', 'via_publica',
    'cine', 'buscadores', 'redes_sociales', 'video_streaming', 'sitios_apps',
    'influencers', 'email', 'retail_media', 'otros'
  );
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------
-- 2. Tenancy: empresas, perfiles, miembros
-- ------------------------------------------------------------------

-- Empresa cliente (tenant). Cada una vive aislada de las demas.
create table if not exists public.companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  legal_id     text,                       -- RUC / identificacion fiscal
  status       company_status not null default 'pendiente',
  seats        integer not null default 5, -- numero de usuarios contratados
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Perfil 1:1 con auth.users. is_platform_admin = equipo Ad Mavericks.
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text,
  email              citext,
  is_platform_admin  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Relacion usuario <-> empresa con su rol. Varias personas por empresa.
create table if not exists public.company_members (
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        company_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index if not exists idx_company_members_user on public.company_members (user_id);
create index if not exists idx_companies_created_by on public.companies (created_by);

-- ------------------------------------------------------------------
-- 3. Codigos de registro (Consola de Alta de Clientes)
--    Ej.: AMK-2026-CRESA-7F3Q. El cliente entra con su codigo y queda
--    ligado a su propia empresa aislada.
-- ------------------------------------------------------------------
create table if not exists public.registration_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  company_id   uuid not null references public.companies (id) on delete cascade,
  email        citext,                     -- correo esperado (opcional)
  role         company_role not null default 'admin',
  max_uses     integer not null default 1,
  uses         integer not null default 0,
  expires_at   timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_reg_codes_company on public.registration_codes (company_id);

-- Genera un codigo unico AMK-<anio>-<prefijo>-<sufijo>.
create or replace function public.generate_registration_code(p_name text)
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_suffix text;
  v_code   text;
begin
  -- Prefijo: hasta 5 letras del nombre, en mayusculas y sin acentos/espacios.
  v_prefix := upper(regexp_replace(unaccent_fallback(p_name), '[^a-zA-Z]', '', 'g'));
  v_prefix := left(coalesce(nullif(v_prefix, ''), 'AMK'), 5);

  loop
    v_suffix := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
    v_code := format('AMK-%s-%s-%s', to_char(now(), 'YYYY'), v_prefix, v_suffix);
    exit when not exists (select 1 from public.registration_codes where code = v_code);
  end loop;

  return v_code;
end;
$$;

-- Quita acentos sin depender de la extension unaccent (por si no esta habilitada).
create or replace function public.unaccent_fallback(txt text)
returns text
language sql
immutable
as $$
  select translate(
    txt,
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
  );
$$;

-- ------------------------------------------------------------------
-- 4. Auditoria — queda registro de quien hizo que y cuando.
-- ------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,              -- p.ej. 'company.created', 'code.generated'
  entity      text,                       -- tabla o recurso afectado
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_actor on public.audit_log (actor_id);
create index if not exists idx_audit_created on public.audit_log (created_at desc);

-- ------------------------------------------------------------------
-- 5. Funciones de ayuda para RLS
-- ------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Empresas a las que pertenece el usuario actual.
create or replace function public.my_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.company_members where user_id = auth.uid();
$$;

create or replace function public.is_company_member(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where user_id = auth.uid() and company_id = p_company
  );
$$;

-- ------------------------------------------------------------------
-- 6. Politicas RLS — aislamiento por cliente
-- ------------------------------------------------------------------
alter table public.companies          enable row level security;
alter table public.profiles           enable row level security;
alter table public.company_members    enable row level security;
alter table public.registration_codes enable row level security;
alter table public.audit_log          enable row level security;

-- companies -------------------------------------------------------
drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies
  for select using (
    public.is_platform_admin() or id in (select public.my_company_ids())
  );

drop policy if exists companies_admin_write on public.companies;
create policy companies_admin_write on public.companies
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- profiles --------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_platform_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and is_platform_admin = (
    select is_platform_admin from public.profiles where id = auth.uid()
  ));

-- company_members -------------------------------------------------
drop policy if exists members_read on public.company_members;
create policy members_read on public.company_members
  for select using (
    public.is_platform_admin()
    or user_id = auth.uid()
    or company_id in (select public.my_company_ids())
  );

drop policy if exists members_admin_write on public.company_members;
create policy members_admin_write on public.company_members
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- registration_codes (solo equipo Ad Mavericks) -------------------
drop policy if exists reg_codes_admin_all on public.registration_codes;
create policy reg_codes_admin_all on public.registration_codes
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- audit_log -------------------------------------------------------
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select using (public.is_platform_admin());

-- ------------------------------------------------------------------
-- 7. Base de inversion publicitaria (inteligencia de mercado)
--    Datos de referencia compartidos, NO por tenant. Lectura para
--    usuarios autenticados; escritura solo para el equipo Ad Mavericks.
--    Regla: si un dato no esta verificado, status = 'pendiente'.
-- ------------------------------------------------------------------

-- Catalogo de fuentes de datos.
create table if not exists public.data_sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,     -- 'Superintendencia de Companias', 'Banco', 'Canal TV', 'Google Ads', 'Meta Ads'
  category    text,              -- 'oficial', 'medio', 'plataforma'
  url         text,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Anunciantes (empresas que invierten en publicidad).
create table if not exists public.advertisers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  legal_id    text,              -- RUC (Superintendencia de Companias)
  sector      text,              -- sector economico
  province    text,
  source_id   uuid references public.data_sources (id) on delete set null,
  status      data_status not null default 'pendiente',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_advertisers_name on public.advertisers (name);
create index if not exists idx_advertisers_sector on public.advertisers (sector);

-- Medios / canales del mercado.
create table if not exists public.media_channels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,     -- 'Ecuavisa', 'Teleamazonas', 'Google', 'Meta'...
  media_type  media_type not null,
  owner       text,
  source_id   uuid references public.data_sources (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_media_channels_type on public.media_channels (media_type);

-- Inversion publicitaria por anunciante, medio y periodo.
create table if not exists public.ad_investments (
  id             uuid primary key default gen_random_uuid(),
  advertiser_id  uuid references public.advertisers (id) on delete cascade,
  channel_id     uuid references public.media_channels (id) on delete set null,
  media_type     media_type,
  period_year    smallint not null,
  period_month   smallint check (period_month between 1 and 12),
  amount_usd     numeric(16, 2),
  source_id      uuid references public.data_sources (id) on delete set null,
  status         data_status not null default 'pendiente',
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_investments_advertiser on public.ad_investments (advertiser_id);
create index if not exists idx_investments_period on public.ad_investments (period_year, period_month);

-- Metricas digitales (Google Ads, Meta Ads, Google Analytics).
create table if not exists public.digital_metrics (
  id             uuid primary key default gen_random_uuid(),
  advertiser_id  uuid references public.advertisers (id) on delete cascade,
  platform       text not null,           -- 'google_ads', 'meta_ads', 'google_analytics'
  period_year    smallint not null,
  period_month   smallint check (period_month between 1 and 12),
  impressions    bigint,
  clicks         bigint,
  ctr            numeric(6, 4),
  cpc            numeric(12, 4),
  cpm            numeric(12, 4),
  cpa            numeric(12, 4),
  spend_usd      numeric(16, 2),
  conversions    bigint,
  source_id      uuid references public.data_sources (id) on delete set null,
  status         data_status not null default 'pendiente',
  created_at     timestamptz not null default now()
);

create index if not exists idx_metrics_advertiser on public.digital_metrics (advertiser_id);
create index if not exists idx_metrics_platform on public.digital_metrics (platform);

-- RLS de la base de mercado: lectura autenticada, escritura solo staff.
alter table public.data_sources    enable row level security;
alter table public.advertisers     enable row level security;
alter table public.media_channels  enable row level security;
alter table public.ad_investments  enable row level security;
alter table public.digital_metrics enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'data_sources', 'advertisers', 'media_channels', 'ad_investments', 'digital_metrics'
  ] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format(
      'create policy %I_read on public.%I for select using (auth.role() = ''authenticated'')',
      t, t
    );
    execute format('drop policy if exists %I_admin_write on public.%I', t, t);
    execute format(
      'create policy %I_admin_write on public.%I for all using (public.is_platform_admin()) with check (public.is_platform_admin())',
      t, t
    );
  end loop;
end $$;

-- ------------------------------------------------------------------
-- 8. Triggers
-- ------------------------------------------------------------------

-- Crea automaticamente un perfil cuando se registra un usuario en auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantiene updated_at al dia.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['companies', 'profiles', 'advertisers'] loop
    execute format('drop trigger if exists trg_touch_%I on public.%I', t, t);
    execute format(
      'create trigger trg_touch_%I before update on public.%I for each row execute function public.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- =====================================================================
--  Fin del esquema. Siguiente paso sugerido: crear el primer
--  platform_admin (ver supabase/seed.sql).
-- =====================================================================
