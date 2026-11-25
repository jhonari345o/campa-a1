-- Licensed studies remain private. Only authorized server-side planning reads them.
begin;
create table if not exists public.planning_audience_sources (
 id text primary key check(id ~ '^[a-z0-9-]{1,150}$'),
 medium text not null check(medium in ('press','ooh')),
 object_path text not null unique check(object_path ~ '^[a-z0-9-]+\.json\.gz$'),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 original_sha256 text not null check(original_sha256 ~ '^[a-f0-9]{64}$'),
 record_count integer not null check(record_count between 1 and 10000),
 evidence jsonb not null check(jsonb_typeof(evidence)='object'),
 active boolean not null default true,
 imported_at timestamptz not null default now()
);
alter table public.planning_audience_sources enable row level security;
revoke all on public.planning_audience_sources from public, anon, authenticated;
grant all on public.planning_audience_sources to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('planning-audience','planning-audience',false,5242880,array['application/gzip','application/x-gzip','application/octet-stream'])
on conflict(id) do nothing;
-- Restrictive boundary also protects this bucket from unrelated permissive policies.
create policy planning_audience_no_select on storage.objects as restrictive for select to authenticated,anon using(bucket_id <> 'planning-audience');
create policy planning_audience_no_insert on storage.objects as restrictive for insert to authenticated,anon with check(bucket_id <> 'planning-audience');
create policy planning_audience_no_update on storage.objects as restrictive for update to authenticated,anon using(bucket_id <> 'planning-audience') with check(bucket_id <> 'planning-audience');
create policy planning_audience_no_delete on storage.objects as restrictive for delete to authenticated,anon using(bucket_id <> 'planning-audience');
commit;
