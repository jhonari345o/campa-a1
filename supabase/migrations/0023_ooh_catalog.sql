-- Private supplier inventory. Source records and photographs are imported separately.
begin;
create table if not exists public.ooh_catalog_assets (
 id text primary key check(id ~ '^[a-z0-9-]{1,150}$'),
 provider_slug text not null,
 provinces text[] not null default '{}',
 details jsonb not null check(jsonb_typeof(details)='object'),
 photo_path text check(photo_path is null or photo_path ~ '^[a-f0-9]{64}[.](jpg|jpeg|png|webp)$'),
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 active boolean not null default true,
 imported_at timestamptz not null default now()
);
create index if not exists ooh_catalog_provider_idx on public.ooh_catalog_assets(provider_slug,active);
alter table public.ooh_catalog_assets enable row level security;
revoke all on public.ooh_catalog_assets from public,anon,authenticated;
grant select on public.ooh_catalog_assets to authenticated;
grant all on public.ooh_catalog_assets to service_role;
drop policy if exists ooh_catalog_read on public.ooh_catalog_assets;
create policy ooh_catalog_read on public.ooh_catalog_assets for select to authenticated
 using(active and public.can_use_media_catalog());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('ooh-catalog','ooh-catalog',false,10485760,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false;
drop policy if exists ooh_photo_read on storage.objects;
create policy ooh_photo_read on storage.objects for select to authenticated using(
 bucket_id='ooh-catalog' and public.can_use_media_catalog() and exists(
 select 1 from public.ooh_catalog_assets a where a.photo_path=storage.objects.name and a.active));
drop policy if exists ooh_photo_boundary on storage.objects;
create policy ooh_photo_boundary on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'ooh-catalog' or (public.can_use_media_catalog() and exists(
 select 1 from public.ooh_catalog_assets a where a.photo_path=storage.objects.name and a.active)));
drop policy if exists ooh_photo_anon_boundary on storage.objects;
create policy ooh_photo_anon_boundary on storage.objects as restrictive for select to anon using(bucket_id<>'ooh-catalog');
-- Uploads are performed by the project administration, never by catalog readers.
drop policy if exists ooh_photo_no_insert on storage.objects;
create policy ooh_photo_no_insert on storage.objects as restrictive for insert to authenticated,anon with check(bucket_id<>'ooh-catalog');
drop policy if exists ooh_photo_no_update on storage.objects;
create policy ooh_photo_no_update on storage.objects as restrictive for update to authenticated,anon using(bucket_id<>'ooh-catalog') with check(bucket_id<>'ooh-catalog');
drop policy if exists ooh_photo_no_delete on storage.objects;
create policy ooh_photo_no_delete on storage.objects as restrictive for delete to authenticated,anon using(bucket_id<>'ooh-catalog');
commit;
