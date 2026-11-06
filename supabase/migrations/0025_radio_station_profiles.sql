-- Source-backed station profiles share the directory's existing RLS and read-only grants.
begin;
alter table public.radio_directory_entries
 add column if not exists profile jsonb not null default '{}'::jsonb;
alter table public.radio_directory_entries
 add constraint radio_directory_profile_object check(jsonb_typeof(profile) = 'object' and octet_length(profile::text) <= 100000);
commit;
