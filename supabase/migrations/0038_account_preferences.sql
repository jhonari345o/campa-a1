begin;
create table if not exists public.account_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 display_name text not null default '' check(char_length(display_name)<=120 and display_name !~ '[[:cntrl:]<>]'),
 avatar_key text check(avatar_key in ('iguana','capuchin','macaw','ocelot','crab')),
 avatar_tone text not null default 'forest' check(avatar_tone in ('forest','mangrove','olive')),
 reduced_motion boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.account_preferences enable row level security;
revoke all on public.account_preferences from public,anon,authenticated;
grant select,insert on public.account_preferences to authenticated;
grant update(display_name,avatar_key,avatar_tone,reduced_motion) on public.account_preferences to authenticated;
grant all on public.account_preferences to service_role;
drop policy if exists account_preferences_self_read on public.account_preferences;
create policy account_preferences_self_read on public.account_preferences for select to authenticated using(user_id=auth.uid() and not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false));
drop policy if exists account_preferences_self_insert on public.account_preferences;
create policy account_preferences_self_insert on public.account_preferences for insert to authenticated with check(user_id=auth.uid() and not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false));
drop policy if exists account_preferences_self_update on public.account_preferences;
create policy account_preferences_self_update on public.account_preferences for update to authenticated using(user_id=auth.uid() and not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false)) with check(user_id=auth.uid() and not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false));
create or replace function public.touch_account_preferences() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists account_preferences_touch on public.account_preferences;
create trigger account_preferences_touch before update on public.account_preferences for each row execute function public.touch_account_preferences();
create or replace function public.save_my_account_preferences(p_name text,p_avatar text,p_tone text,p_reduced_motion boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false) then raise exception 'Active account required' using errcode='42501'; end if;
 insert into public.account_preferences(user_id,display_name,avatar_key,avatar_tone,reduced_motion) values(auth.uid(),btrim(p_name),p_avatar,p_tone,p_reduced_motion)
 on conflict(user_id) do update set display_name=excluded.display_name,avatar_key=excluded.avatar_key,avatar_tone=excluded.avatar_tone,reduced_motion=excluded.reduced_motion;
end; $$;
revoke all on function public.save_my_account_preferences(text,text,text,boolean) from public,anon;
grant execute on function public.save_my_account_preferences(text,text,text,boolean) to authenticated;
commit;
