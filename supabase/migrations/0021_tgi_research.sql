-- Private audience reference; observations are imported separately, never committed.
begin;
create table if not exists public.tgi_research (
  id text primary key,
  payload jsonb not null check (jsonb_typeof(payload->'indicators') = 'array'),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  active boolean not null default false,
  imported_at timestamptz not null default now()
);
alter table public.tgi_research enable row level security;
revoke all on public.tgi_research from public, anon, authenticated;
grant all on public.tgi_research to service_role;
commit;
