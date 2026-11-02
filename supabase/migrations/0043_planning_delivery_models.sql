-- Private planning calibration and evidence, never shipped in a public bundle.
begin;
create table if not exists public.planning_delivery_models (
 id text primary key check(id ~ '^[a-z0-9-]{1,150}$'),
 definition jsonb not null check(jsonb_typeof(definition)='object'),
 evidence jsonb not null check(jsonb_typeof(evidence)='object'),
 active boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.planning_delivery_models enable row level security;
revoke all on public.planning_delivery_models from public, anon, authenticated;
grant all on public.planning_delivery_models to service_role;
commit;
