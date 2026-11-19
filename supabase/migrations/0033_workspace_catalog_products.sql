-- Explicit client agreements can include a contracted package without inventing a global asset match.
begin;
create table if not exists public.workspace_catalog_products (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 medium text not null check(medium in ('tv','radio','ooh','press','digital','influencer')),
 provider text not null check(length(provider) between 1 and 180),name text not null check(length(name) between 1 and 180),
 format_group text not null default 'other' check(format_group in ('other','totem_standard','totem_special')),
 format text not null default '' check(length(format)<=240),unit text not null check(length(unit) between 1 and 120),
 market_keys text[] not null default '{}',
 location text not null default '' check(length(location)<=400),reference text not null default '' check(length(reference)<=300),
 conditions text not null default '' check(length(conditions)<=2000),active boolean not null default true,
 radio_station_id text references public.radio_directory_entries(id),publication_id text references public.press_directory_entries(id),asset_id text references public.ooh_catalog_assets(id),
 created_at timestamptz not null default now()
);
alter table public.workspace_catalog_products enable row level security;
revoke all on public.workspace_catalog_products from public,anon,authenticated;
grant select on public.workspace_catalog_products to authenticated;
grant all on public.workspace_catalog_products to service_role;
drop policy if exists workspace_catalog_own_read on public.workspace_catalog_products;
create policy workspace_catalog_own_read on public.workspace_catalog_products for select to authenticated using(public.is_platform_admin() or (active and public.company_role_allows(company_id,array['admin','planner','analyst','approver','viewer'])));
create index if not exists workspace_catalog_company on public.workspace_catalog_products(company_id,medium);
commit;
