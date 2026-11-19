-- Catalogo comercial controlado y planes privados por usuario.
-- Los datos crudos siguen siendo exclusivos del equipo de plataforma.

begin;

do $$ begin
  create type public.catalog_kind as enum (
    'television', 'radio', 'ooh', 'press', 'digital', 'influencer'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.catalog_status as enum (
    'cotizable', 'validacion', 'directorio'
  );
exception when duplicate_object then null; end $$;

create or replace function public.can_use_media_catalog()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_platform_admin()
    or exists (
      select 1
      from public.company_members membership
      join public.companies company on company.id = membership.company_id
      where membership.user_id = auth.uid()
        and company.status::text = 'activa'
    )
  );
$$;

create table if not exists public.media_catalog_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind public.catalog_kind not null,
  name text not null,
  category text,
  coverage text,
  owner_name text,
  summary text not null,
  status public.catalog_status not null default 'directorio',
  status_note text,
  source_note text,
  valid_at date,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_catalog_items_kind_idx
  on public.media_catalog_items (kind, active, name);

create table if not exists public.media_catalog_rates (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.media_catalog_items(id) on delete cascade,
  label text not null,
  amount_usd numeric(14, 2),
  unit text,
  tax_included boolean not null default false,
  status public.catalog_status not null default 'validacion',
  conditions text,
  valid_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists media_catalog_rates_item_idx
  on public.media_catalog_rates (item_id, label);

create table if not exists public.influencer_profiles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null check (category in ('deportes', 'foodie', 'beauty')),
  name text not null,
  handle text,
  platform text,
  profile_url text,
  followers bigint,
  avg_views bigint,
  engagement_pct numeric(8, 4),
  follower_quality_pct numeric(8, 4),
  status public.catalog_status not null default 'validacion',
  source_note text not null default 'Referencia comercial; vigencia y disponibilidad por reconfirmar.',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists influencer_profiles_category_idx
  on public.influencer_profiles (category, active, name);

create table if not exists public.influencer_rates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.influencer_profiles(id) on delete cascade,
  format text not null,
  amount_usd numeric(12, 2) not null check (amount_usd >= 0),
  tax_included boolean not null default false,
  conditions text,
  created_at timestamptz not null default now(),
  unique (profile_id, format)
);

create table if not exists public.media_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null default 'Plan sin marca',
  status text not null default 'borrador' check (status in ('borrador', 'revision', 'aprobado', 'archivado')),
  mode text not null default 'guiado' check (mode in ('guiado', 'manual')),
  stage text not null default 'brief' check (stage in ('brief', 'analisis', 'propuesta', 'personaliza', 'aprobado')),
  version integer not null default 1 check (version > 0),
  progress smallint not null default 0 check (progress between 0 and 100),
  brief jsonb not null default '{}'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  proposal jsonb not null default '{}'::jsonb,
  selection jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_plans_owner_idx
  on public.media_plans (owner_id, updated_at desc);

create table if not exists public.media_plan_versions (
  id bigint generated always as identity primary key,
  plan_id uuid not null references public.media_plans(id) on delete cascade,
  version integer not null check (version > 0),
  actor_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (plan_id, version)
);

alter table public.media_catalog_items enable row level security;
alter table public.media_catalog_rates enable row level security;
alter table public.influencer_profiles enable row level security;
alter table public.influencer_rates enable row level security;
alter table public.media_plans enable row level security;
alter table public.media_plan_versions enable row level security;

drop policy if exists catalog_items_read on public.media_catalog_items;
create policy catalog_items_read on public.media_catalog_items
  for select to authenticated using (public.can_use_media_catalog());
drop policy if exists catalog_items_admin_write on public.media_catalog_items;
create policy catalog_items_admin_write on public.media_catalog_items
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists catalog_rates_read on public.media_catalog_rates;
create policy catalog_rates_read on public.media_catalog_rates
  for select to authenticated using (public.can_use_media_catalog());
drop policy if exists catalog_rates_admin_write on public.media_catalog_rates;
create policy catalog_rates_admin_write on public.media_catalog_rates
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists influencer_profiles_read on public.influencer_profiles;
create policy influencer_profiles_read on public.influencer_profiles
  for select to authenticated using (public.can_use_media_catalog());
drop policy if exists influencer_profiles_admin_write on public.influencer_profiles;
create policy influencer_profiles_admin_write on public.influencer_profiles
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists influencer_rates_read on public.influencer_rates;
create policy influencer_rates_read on public.influencer_rates
  for select to authenticated using (public.can_use_media_catalog());
drop policy if exists influencer_rates_admin_write on public.influencer_rates;
create policy influencer_rates_admin_write on public.influencer_rates
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists media_plans_owner_read on public.media_plans;
create policy media_plans_owner_read on public.media_plans
  for select to authenticated using (owner_id = auth.uid() or public.is_platform_admin());
drop policy if exists media_plans_owner_insert on public.media_plans;
create policy media_plans_owner_insert on public.media_plans
  for insert to authenticated with check (
    owner_id = auth.uid()
    and (company_id is null or public.is_company_member(company_id) or public.is_platform_admin())
  );
drop policy if exists media_plans_owner_update on public.media_plans;
create policy media_plans_owner_update on public.media_plans
  for update to authenticated using (owner_id = auth.uid() or public.is_platform_admin())
  with check (owner_id = auth.uid() or public.is_platform_admin());

drop policy if exists media_plan_versions_owner_read on public.media_plan_versions;
create policy media_plan_versions_owner_read on public.media_plan_versions
  for select to authenticated using (
    public.is_platform_admin()
    or exists (
      select 1 from public.media_plans plan
      where plan.id = media_plan_versions.plan_id and plan.owner_id = auth.uid()
    )
  );
drop policy if exists media_plan_versions_owner_insert on public.media_plan_versions;
create policy media_plan_versions_owner_insert on public.media_plan_versions
  for insert to authenticated with check (
    actor_id = auth.uid()
    and exists (
      select 1 from public.media_plans plan
      where plan.id = media_plan_versions.plan_id and plan.owner_id = auth.uid()
    )
  );

drop trigger if exists trg_touch_media_catalog_items on public.media_catalog_items;
create trigger trg_touch_media_catalog_items before update on public.media_catalog_items
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_influencer_profiles on public.influencer_profiles;
create trigger trg_touch_influencer_profiles before update on public.influencer_profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_media_plans on public.media_plans;
create trigger trg_touch_media_plans before update on public.media_plans
  for each row execute function public.touch_updated_at();

grant select on public.media_catalog_items, public.media_catalog_rates,
  public.influencer_profiles, public.influencer_rates to authenticated;
grant select, insert, update on public.media_plans to authenticated;
grant select, insert on public.media_plan_versions to authenticated;

commit;
