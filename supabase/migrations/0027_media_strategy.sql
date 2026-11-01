-- Private measurement contracts and owner-scoped AI cache. No observations or credentials.
begin;
create table if not exists public.tv_audience_observations (
 id text primary key check(id ~ '^[a-z0-9-]{1,150}$'),
 study text not null check(length(study) between 1 and 300),
 period_start date not null, period_end date not null check(period_end>=period_start),
 market text not null, market_keys text[] not null check(cardinality(market_keys) between 1 and 25),
 target text not null, age_min integer check(age_min between 0 and 99), age_max integer check(age_max between coalesce(age_min,0) and 99),
 sex text not null check(sex in ('all','female','male','unknown')), nse text not null,
 channel text not null, program text not null,
 basis text not null check(basis in ('period_average','premiere','unknown')),
 offer_ids text[] not null check(cardinality(offer_ids) between 0 and 500),
 rating_pct numeric check(rating_pct between 0 and 100), reach_pct numeric check(reach_pct between 0 and 100),
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'), active boolean not null default true,
 imported_at timestamptz not null default now(), check(rating_pct is not null or reach_pct is not null)
);
alter table public.tv_audience_observations enable row level security;
revoke all on public.tv_audience_observations from public,anon,authenticated;
grant select on public.tv_audience_observations to authenticated;
grant all on public.tv_audience_observations to service_role;
drop policy if exists tv_audience_catalog_read on public.tv_audience_observations;
create policy tv_audience_catalog_read on public.tv_audience_observations for select to authenticated using(active and public.can_use_media_catalog());

create table if not exists public.media_strategy_cache (
 owner_id uuid not null references auth.users(id) on delete cascade,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 status text not null check(status in ('pending','ready','failed')),
 model_id text, result jsonb not null default '{}'::jsonb check(jsonb_typeof(result)='object' and octet_length(result::text)<=40000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours', primary key(owner_id,fingerprint)
);
alter table public.media_strategy_cache enable row level security;
revoke all on public.media_strategy_cache from public,anon,authenticated;
grant select on public.media_strategy_cache to authenticated;
grant all on public.media_strategy_cache to service_role;
drop policy if exists media_strategy_own_read on public.media_strategy_cache;
create policy media_strategy_own_read on public.media_strategy_cache for select to authenticated using(owner_id=auth.uid() and public.can_access_infomedia());

-- Single flight per owner/fingerprint, plus the existing atomic account/user ceiling.
create or replace function public.claim_media_strategy_ai_request(p_fingerprint text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.can_access_infomedia() or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(20261101);
 if exists(select 1 from public.media_strategy_cache where owner_id=auth.uid() and fingerprint=p_fingerprint and ((status='ready' and expires_at>now()) or (status='pending' and updated_at>now()-interval '30 seconds'))) then return false; end if;
 if not public.claim_infomedia_ai_request() then return false; end if;
 insert into public.media_strategy_cache(owner_id,fingerprint,status) values(auth.uid(),p_fingerprint,'pending')
 on conflict(owner_id,fingerprint) do update set status='pending',result='{}'::jsonb,updated_at=now(),expires_at=now()+interval '24 hours';
 return true;
end;
$$;
revoke all on function public.claim_media_strategy_ai_request(text) from public,anon;
grant execute on function public.claim_media_strategy_ai_request(text) to authenticated;
commit;
