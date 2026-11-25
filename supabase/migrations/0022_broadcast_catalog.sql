-- Versioned private TV rates and distinct radio study cohorts. No source data in Git.
begin;
create table if not exists public.broadcast_sources (
 id text primary key, kind text not null check(kind in ('tv','radio')), label text not null, provider text not null,
 period_start date not null, period_end date not null check(period_end>=period_start),
 market text not null, market_keys text[] not null default '{}', target text not null,
 age_min integer, age_max integer, sex text not null default 'all' check(sex in ('all','male','female','unspecified')),
 nse text not null default 'all', frequency text not null default '', daypart text not null default '',
 annual_contract boolean not null default false, conditions text not null default '',
 spot_seconds integer, minimum_seconds integer, tax_included boolean, active boolean not null default true,
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'), imported_at timestamptz not null default now()
);
create table if not exists public.broadcast_tv_offers (
 id text primary key, source_id text not null references public.broadcast_sources(id), day text not null,
 title text not null, schedule text not null, price_usd numeric not null check(price_usd>=0),
 target text not null default '', note text not null default ''
);
create table if not exists public.broadcast_radio_metrics (
 id text primary key, source_id text not null references public.broadcast_sources(id), name text not null, genre text not null default '',
 rating numeric check(rating>=0), share numeric check(share between 0 and 100), audience numeric check(audience>=0), rank integer check(rank>0),
 unique(source_id,name)
);
create index if not exists broadcast_tv_source_idx on public.broadcast_tv_offers(source_id);
create index if not exists broadcast_radio_source_idx on public.broadcast_radio_metrics(source_id);
alter table public.broadcast_sources enable row level security;
alter table public.broadcast_tv_offers enable row level security;
alter table public.broadcast_radio_metrics enable row level security;
revoke all on public.broadcast_sources,public.broadcast_tv_offers,public.broadcast_radio_metrics from public,anon,authenticated;
grant select on public.broadcast_sources,public.broadcast_tv_offers,public.broadcast_radio_metrics to authenticated;
grant all on public.broadcast_sources,public.broadcast_tv_offers,public.broadcast_radio_metrics to service_role;
drop policy if exists broadcast_sources_read on public.broadcast_sources;
create policy broadcast_sources_read on public.broadcast_sources for select to authenticated using(active and public.can_use_media_catalog());
drop policy if exists broadcast_tv_read on public.broadcast_tv_offers;
create policy broadcast_tv_read on public.broadcast_tv_offers for select to authenticated using(public.can_use_media_catalog() and exists(select 1 from public.broadcast_sources s where s.id=source_id and s.active));
drop policy if exists broadcast_radio_read on public.broadcast_radio_metrics;
create policy broadcast_radio_read on public.broadcast_radio_metrics for select to authenticated using(public.can_use_media_catalog() and exists(select 1 from public.broadcast_sources s where s.id=source_id and s.active));
commit;
