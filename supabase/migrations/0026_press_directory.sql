begin;
create table if not exists public.press_directory_entries (
 id text primary key check(id ~ '^[a-z0-9-]{1,150}$'),
 name text not null check(length(trim(name)) between 1 and 180),
 region_keys text[] not null check(cardinality(region_keys) between 1 and 25),
 city text, description text not null default '', logo_path text, website text,
 coverage text not null default '',
 editions jsonb not null default '[]'::jsonb check(jsonb_typeof(editions) = 'array' and octet_length(editions::text) <= 1000000),
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 active boolean not null default true, imported_at timestamptz not null default now()
);
alter table public.press_directory_entries enable row level security;
revoke all on public.press_directory_entries from public,anon,authenticated;
grant select on public.press_directory_entries to authenticated;
grant all on public.press_directory_entries to service_role;
drop policy if exists press_directory_read on public.press_directory_entries;
create policy press_directory_read on public.press_directory_entries
 for select to authenticated using(active and public.can_use_media_catalog());
commit;
