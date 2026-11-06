-- Geographic radio directory, kept separate from licensed study cohorts.
begin;
create table if not exists public.radio_directory_entries (
 id text primary key check(id ~ '^[a-z0-9-]{1,150}$'),
 name text not null check(length(trim(name)) between 1 and 180),
 region_keys text[] not null check(cardinality(region_keys) between 1 and 25),
 city text,
 dial text,
 genres text[] not null default '{}',
 description text not null default '',
 logo_path text,
 reviewed_at date,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 active boolean not null default true,
 imported_at timestamptz not null default now()
);
alter table public.radio_directory_entries enable row level security;
revoke all on public.radio_directory_entries from public,anon,authenticated;
grant select on public.radio_directory_entries to authenticated;
grant all on public.radio_directory_entries to service_role;
drop policy if exists radio_directory_read on public.radio_directory_entries;
create policy radio_directory_read on public.radio_directory_entries
 for select to authenticated using(active and public.can_use_media_catalog());
commit;
