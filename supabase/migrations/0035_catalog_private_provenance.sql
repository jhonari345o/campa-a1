-- Source documents and negotiation provenance are internal, never customer catalog fields.
begin;
create table if not exists public.catalog_private_provenance (
 agreement_id uuid primary key references public.catalog_price_agreements(id) on delete cascade,
 evidence jsonb not null check(jsonb_typeof(evidence)='object' and octet_length(evidence::text)<=100000),
 recorded_at timestamptz not null default now()
);
alter table public.catalog_private_provenance enable row level security;
revoke all on public.catalog_private_provenance from public,anon,authenticated;
grant select on public.catalog_private_provenance to authenticated;
grant all on public.catalog_private_provenance to service_role;
drop policy if exists catalog_provenance_admin_read on public.catalog_private_provenance;
create policy catalog_provenance_admin_read on public.catalog_private_provenance for select to authenticated using(public.is_platform_admin());
commit;
