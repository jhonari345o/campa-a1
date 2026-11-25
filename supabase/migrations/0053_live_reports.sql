-- Private embedded reports. Customer data and provider URLs are configured outside Git.
begin;
create table public.live_reports (
 id uuid primary key default gen_random_uuid(),
 client_key text not null check (client_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(client_key)<=80),
 client_name text not null check (length(trim(client_name)) between 1 and 180),
 client_logo text check (client_logo ~ '^/partners/[a-z0-9-]+/[a-z0-9-]+\.(png|webp|svg)$'),
 channel_key text not null check (channel_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(channel_key)<=80),
 channel_name text not null check (length(trim(channel_name)) between 1 and 100),
 period date not null check (extract(day from period)=1),
 title text not null check (length(trim(title)) between 1 and 240),
 embed_url text not null check (length(embed_url)<=500 and embed_url ~ '^https://(datastudio|lookerstudio)\.google\.com/embed/reporting/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/page/[a-zA-Z0-9_-]+$'),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 unique(client_key,channel_key,period,title)
);
create table public.live_report_access (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.live_reports(id),
 company_id uuid not null references public.companies(id),
 user_id uuid references auth.users(id),
 enabled boolean not null default false,
 created_at timestamptz not null default now()
);
create unique index live_report_user_grant on public.live_report_access(report_id,company_id,user_id) where user_id is not null;
create unique index live_report_company_grant on public.live_report_access(report_id,company_id) where user_id is null;
create index live_report_access_company on public.live_report_access(company_id,report_id) where enabled;
alter table public.live_reports enable row level security;
alter table public.live_report_access enable row level security;

create function public.can_view_live_report(p_report uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false)
 and exists (
  select 1 from public.live_report_access a
  join public.company_members m on m.company_id=a.company_id and m.user_id=auth.uid()
  join public.companies c on c.id=a.company_id
  where a.report_id=p_report and a.enabled
   and (a.user_id is null or a.user_id=auth.uid())
   and c.status::text='activa' and c.portal_kind in ('agency','client')
   and m.role::text in ('admin','planner','analyst','approver','viewer')
 );
$$;
revoke all on function public.can_view_live_report(uuid) from public,anon;
grant execute on function public.can_view_live_report(uuid) to authenticated,service_role;
create policy live_reports_read on public.live_reports for select to authenticated using (
 not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false)
 and (public.is_platform_admin() or (published and public.can_view_live_report(id)))
);
create policy live_report_access_admin_read on public.live_report_access for select to authenticated using (
 not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false) and public.is_platform_admin()
);
revoke all on public.live_reports,public.live_report_access from public,anon,authenticated;
grant select on public.live_reports,public.live_report_access to authenticated;
grant all on public.live_reports,public.live_report_access to service_role;
commit;
