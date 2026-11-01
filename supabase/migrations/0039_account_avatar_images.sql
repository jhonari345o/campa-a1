begin;
alter table public.account_preferences add column if not exists avatar_image_path text;
alter table public.account_preferences add column if not exists use_custom_avatar boolean not null default false;
alter table public.account_preferences drop constraint if exists account_avatar_owned_path;
alter table public.account_preferences add constraint account_avatar_owned_path check (
 avatar_image_path is null or (split_part(avatar_image_path,'/',1)=user_id::text and avatar_image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$')
);
alter table public.account_preferences drop constraint if exists account_avatar_image_required;
alter table public.account_preferences add constraint account_avatar_image_required check(not use_custom_avatar or avatar_image_path is not null);
grant update(avatar_image_path,use_custom_avatar) on public.account_preferences to authenticated;

create or replace function public.save_my_account_preferences(p_name text,p_avatar text,p_tone text,p_reduced_motion boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false) then raise exception 'Active account required' using errcode='42501'; end if;
 insert into public.account_preferences(user_id,display_name,avatar_key,avatar_tone,reduced_motion) values(auth.uid(),btrim(p_name),p_avatar,p_tone,p_reduced_motion)
 on conflict(user_id) do update set display_name=excluded.display_name,avatar_key=excluded.avatar_key,avatar_tone=excluded.avatar_tone,reduced_motion=excluded.reduced_motion,use_custom_avatar=false;
end; $$;
create or replace function public.save_my_account_profile(p_name text,p_avatar text,p_tone text,p_reduced_motion boolean,p_use_photo boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform public.save_my_account_preferences(p_name,p_avatar,p_tone,p_reduced_motion);
 update public.account_preferences set use_custom_avatar=coalesce(p_use_photo,false) where user_id=auth.uid();
end; $$;
revoke all on function public.save_my_account_profile(text,text,text,boolean,boolean) from public,anon;
grant execute on function public.save_my_account_profile(text,text,text,boolean,boolean) to authenticated;

create table if not exists public.account_avatar_upload_limits(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 window_start timestamptz not null default now(), attempts integer not null check(attempts between 1 and 10)
);
alter table public.account_avatar_upload_limits enable row level security;
revoke all on public.account_avatar_upload_limits from public,anon,authenticated;
grant all on public.account_avatar_upload_limits to service_role;
create or replace function public.reserve_my_avatar_upload() returns boolean language plpgsql security definer set search_path='' as $$
declare claimed integer;
begin
 if auth.uid() is null or coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false) then raise exception 'Active account required' using errcode='42501'; end if;
 insert into public.account_avatar_upload_limits(user_id,window_start,attempts) values(auth.uid(),now(),1)
 on conflict(user_id) do update set
  window_start=case when account_avatar_upload_limits.window_start<=now()-interval '1 hour' then now() else account_avatar_upload_limits.window_start end,
  attempts=case when account_avatar_upload_limits.window_start<=now()-interval '1 hour' then 1 else account_avatar_upload_limits.attempts+1 end
 where account_avatar_upload_limits.window_start<=now()-interval '1 hour' or account_avatar_upload_limits.attempts<10
 returning attempts into claimed;
 return claimed is not null;
end; $$;
revoke all on function public.reserve_my_avatar_upload() from public,anon;
grant execute on function public.reserve_my_avatar_upload() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('account-avatars','account-avatars',false,1048576,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=1048576,allowed_mime_types=array['image/webp'];
drop policy if exists account_avatar_self_read on storage.objects;
create policy account_avatar_self_read on storage.objects for select to authenticated using(
 bucket_id='account-avatars' and (storage.foldername(name))[1]=auth.uid()::text and not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false)
);
drop policy if exists account_avatar_read_boundary on storage.objects;
create policy account_avatar_read_boundary on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'account-avatars' or ((storage.foldername(name))[1]=auth.uid()::text and not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false))
);
drop policy if exists account_avatar_anon_boundary on storage.objects;
create policy account_avatar_anon_boundary on storage.objects as restrictive for select to anon using(bucket_id<>'account-avatars');
-- Only the authenticated server action may write a decoded image with the service client.
drop policy if exists account_avatar_no_insert on storage.objects;
create policy account_avatar_no_insert on storage.objects as restrictive for insert to authenticated,anon with check(bucket_id<>'account-avatars');
drop policy if exists account_avatar_no_update on storage.objects;
create policy account_avatar_no_update on storage.objects as restrictive for update to authenticated,anon using(bucket_id<>'account-avatars') with check(bucket_id<>'account-avatars');
drop policy if exists account_avatar_no_delete on storage.objects;
create policy account_avatar_no_delete on storage.objects as restrictive for delete to authenticated,anon using(bucket_id<>'account-avatars');
commit;
