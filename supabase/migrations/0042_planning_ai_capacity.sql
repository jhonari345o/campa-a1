-- Free planning uses the provider's actual daily allowance, not a three-call
-- local quota. Keep entitlement checks, atomic throttling and usage history.
begin;
create table if not exists public.planning_ai_request_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index if not exists planning_ai_request_events_time on public.planning_ai_request_events(requested_at);
alter table public.planning_ai_request_events enable row level security;
revoke all on public.planning_ai_request_events from public, anon, authenticated;
grant all on public.planning_ai_request_events to service_role;

create or replace function public.claim_infomedia_ai_request()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_last timestamptz; v_recent integer; v_day date := (now() at time zone 'UTC')::date;
begin
  if not public.can_access_infomedia() then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(201030);
  select last_call into v_last from public.infomedia_ai_usage
    where user_id = auth.uid() and usage_day = v_day;
  select count(*) into v_recent from public.planning_ai_request_events
    where requested_at > now() - interval '60 seconds';
  if v_recent >= 20 or v_last > now() - interval '30 seconds' then return false; end if;
  insert into public.planning_ai_request_events(user_id) values(auth.uid());
  insert into public.infomedia_ai_usage(user_id, usage_day, calls) values(auth.uid(), v_day, 1)
    on conflict(user_id, usage_day) do update set calls = public.infomedia_ai_usage.calls + 1, last_call = now();
  return true;
end;
$$;
revoke all on function public.claim_infomedia_ai_request() from public, anon;
grant execute on function public.claim_infomedia_ai_request() to authenticated;
commit;
