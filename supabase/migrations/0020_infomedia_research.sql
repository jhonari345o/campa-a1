-- Private Infomedia source. No licensed data or customer grants in this migration.
begin;
create table if not exists public.infomedia_categories (
  id text primary key check (id ~ '^im_[a-f0-9]{24}$'),
  label text not null check (length(label) between 1 and 180),
  periods jsonb not null default '[]'::jsonb check (jsonb_typeof(periods) = 'array'),
  active boolean not null default true
);
create table if not exists public.infomedia_research (
  category_id text primary key references public.infomedia_categories(id),
  data_through date not null,
  payload jsonb not null check (jsonb_typeof(payload->'periods') = 'array'),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now()
);
create table if not exists public.infomedia_entitlements (
  company_id uuid primary key references public.companies(id) on delete cascade,
  expires_at timestamptz not null,
  enabled boolean not null default true
);
alter table public.infomedia_categories enable row level security;
alter table public.infomedia_research enable row level security;
alter table public.infomedia_entitlements enable row level security;
revoke all on public.infomedia_categories, public.infomedia_research, public.infomedia_entitlements from public, anon, authenticated;
grant select on public.infomedia_categories to authenticated;
grant all on public.infomedia_categories, public.infomedia_research, public.infomedia_entitlements to service_role;
create or replace function public.can_access_infomedia()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    public.is_platform_admin() or exists (
      select 1 from public.infomedia_entitlements e
      join public.company_members m on m.company_id = e.company_id
      join public.companies c on c.id = e.company_id
      where m.user_id = auth.uid() and c.status::text = 'activa'
        and m.role::text in ('admin', 'planner', 'analyst', 'approver')
        and e.enabled and e.expires_at > now()
    )
  );
$$;
revoke all on function public.can_access_infomedia() from public, anon;
grant execute on function public.can_access_infomedia() to authenticated;
drop policy if exists infomedia_categories_read on public.infomedia_categories;
create policy infomedia_categories_read on public.infomedia_categories for select to authenticated
  using (active and public.can_access_infomedia());

-- Atomic request ceiling, enforced in the database across all app instances.
create table if not exists public.infomedia_ai_usage (
  user_id uuid not null, usage_day date not null, calls integer not null default 0,
  last_call timestamptz not null default now(), primary key(user_id, usage_day)
);
alter table public.infomedia_ai_usage enable row level security;
revoke all on public.infomedia_ai_usage from public, anon, authenticated;
grant all on public.infomedia_ai_usage to service_role;
create or replace function public.claim_infomedia_ai_request()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_calls integer; v_last timestamptz; v_total integer; v_day date := (now() at time zone 'UTC')::date;
begin
  if not public.can_access_infomedia() then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(201030);
  select coalesce(sum(calls), 0) into v_total from public.infomedia_ai_usage where usage_day = v_day;
  select calls, last_call into v_calls, v_last from public.infomedia_ai_usage where user_id = auth.uid() and usage_day = v_day;
  if v_total >= 50 or coalesce(v_calls, 0) >= 3 or v_last > now() - interval '30 seconds' then return false; end if;
  insert into public.infomedia_ai_usage(user_id, usage_day, calls) values(auth.uid(), v_day, 1)
    on conflict(user_id, usage_day) do update set calls = public.infomedia_ai_usage.calls + 1, last_call = now();
  return true;
end;
$$;
revoke all on function public.claim_infomedia_ai_request() from public, anon;
grant execute on function public.claim_infomedia_ai_request() to authenticated;
commit;
