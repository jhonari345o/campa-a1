-- Workspace portal types, exact-domain provisioning and private publications.
begin;
alter table public.companies add column if not exists portal_kind text not null default 'agency' check(portal_kind in ('agency','client','provider'));
alter table public.companies add column if not exists allowed_email_domains text[] not null default '{}';
create or replace function public.portal_access_ready() returns text language sql stable security definer set search_path='' as $$
 select case when auth.role()='service_role' or public.is_platform_admin() then '0029' else null end;
$$;
revoke all on function public.portal_access_ready() from public,anon;
grant execute on function public.portal_access_ready() to authenticated,service_role;

create or replace function public.company_role_allows(p_company uuid,p_roles text[])
returns boolean language sql stable security definer set search_path='' as $$
 select not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false)
 and exists(select 1 from public.company_members m join public.companies c on c.id=m.company_id
 where m.user_id=auth.uid() and m.company_id=p_company and c.status::text='activa' and m.role::text=any(p_roles) and (c.portal_kind='agency' or 'viewer'=any(p_roles)));
$$;
create or replace function public.can_use_media_catalog()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false)
 and (public.is_platform_admin() or exists(select 1 from public.company_members m join public.companies c on c.id=m.company_id
 where m.user_id=auth.uid() and c.status::text='activa' and c.portal_kind in ('agency','client')));
$$;
revoke all on function public.can_use_media_catalog() from public,anon;
grant execute on function public.can_use_media_catalog() to authenticated,service_role;

create or replace function public.provision_customer_membership(p_actor_id uuid,p_user_id uuid,p_company_id uuid,p_full_name text,p_email text,p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.companies; domain text;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.profiles where id=p_actor_id and is_platform_admin) then raise exception 'Platform administrator required' using errcode='42501'; end if;
 if p_role not in ('planner','viewer') then raise exception 'Invalid customer role'; end if;
 select * into c from public.companies where id=p_company_id for update;
 if not found or c.status::text<>'activa' then raise exception 'Active company required'; end if;
 domain:=lower(split_part(p_email,'@',2));
 if cardinality(c.allowed_email_domains)>0 and not domain=any(c.allowed_email_domains) then raise exception 'Email domain does not match workspace'; end if;
 if c.portal_kind='client' and p_role<>'viewer' then raise exception 'Client portal is read-only'; end if;
 if (select count(*) from public.company_members where company_id=p_company_id)>=c.seats then raise exception 'No seats available'; end if;
 if exists(select 1 from public.company_members where user_id=p_user_id) or exists(select 1 from public.profiles where id=p_user_id and is_platform_admin) then raise exception 'User already has access'; end if;
 if not exists(select 1 from auth.users where id=p_user_id and lower(email)=lower(p_email)) then raise exception 'User mismatch'; end if;
 insert into public.profiles(id,full_name,email,is_platform_admin) values(p_user_id,p_full_name,p_email,false)
 on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,is_platform_admin=false;
 insert into public.company_members(company_id,user_id,role) values(p_company_id,p_user_id,p_role::public.company_role);
 insert into public.audit_log(actor_id,action,entity,entity_id,metadata) values(p_actor_id,'customer_user.created','profiles',p_user_id::text,jsonb_build_object('company_id',p_company_id,'role',p_role,'portal',c.portal_kind,'email',p_email));
end; $$;

create table if not exists public.company_report_publications (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 title text not null check(length(title) between 1 and 240),
 library jsonb not null check(jsonb_typeof(library)='object' and octet_length(library::text)<=5000000),
 published_by uuid not null references auth.users(id), published_at timestamptz not null default now(),
 active boolean not null default true
);
alter table public.company_report_publications enable row level security;
revoke all on public.company_report_publications from public,anon,authenticated;
grant select on public.company_report_publications to authenticated;
grant all on public.company_report_publications to service_role;
drop policy if exists company_reports_read on public.company_report_publications;
create policy company_reports_read on public.company_report_publications for select to authenticated using(
 public.is_platform_admin() or (active and public.company_role_allows(company_id,array['admin','planner','approver','viewer'])));
create index if not exists company_report_workspace on public.company_report_publications(company_id,published_at desc);

create table if not exists public.provider_submissions (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),owner_id uuid not null references auth.users(id),
 kind text not null check(kind in ('tariff','offer','promotion','news','availability')),
 medium text not null check(medium in ('tv','radio','ooh','press','digital','influencers')),
 title text not null check(length(title) between 2 and 180),description text not null default '' check(length(description)<=6000),
 amount_cents bigint check(amount_cents between 0 and 1000000000),tax_included boolean,
 valid_from date,valid_to date, status text not null default 'submitted' check(status in ('draft','submitted','approved','rejected')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(valid_from is null or valid_to is null or valid_to>=valid_from)
);
alter table public.provider_submissions enable row level security;
revoke all on public.provider_submissions from public,anon,authenticated;
grant select,insert on public.provider_submissions to authenticated;
grant all on public.provider_submissions to service_role;
drop policy if exists provider_submission_read on public.provider_submissions;
create policy provider_submission_read on public.provider_submissions for select to authenticated using(public.is_platform_admin() or public.company_role_allows(company_id,array['admin','planner','viewer']));
drop policy if exists provider_submission_insert on public.provider_submissions;
create policy provider_submission_insert on public.provider_submissions for insert to authenticated with check(
 owner_id=auth.uid() and status='submitted' and not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false)
 and exists(select 1 from public.companies c join public.company_members m on m.company_id=c.id where c.id=provider_submissions.company_id and c.portal_kind='provider' and c.status::text='activa' and m.user_id=auth.uid() and m.role::text in ('admin','planner')));
create index if not exists provider_submission_workspace on public.provider_submissions(company_id,created_at desc);

-- Client-specific price agreements. Base acquisition prices never become a client quote by default.
create table if not exists public.catalog_price_agreements (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 client_id uuid references public.workspace_clients(id),label text not null check(length(label) between 1 and 180),
 valid_from date not null,valid_to date not null,annual_commitment_cents bigint check(annual_commitment_cents>=0),
 conditions text not null default '' check(length(conditions)<=4000),active boolean not null default true,
 check(valid_to>=valid_from)
);
create table if not exists public.catalog_agreed_rates (
 agreement_id uuid not null references public.catalog_price_agreements(id) on delete cascade,
 product_key text not null check(length(product_key) between 1 and 2048),unit_price_cents bigint not null check(unit_price_cents between 0 and 1000000000),
 tax_included boolean,conditions text not null default '' check(length(conditions)<=2000),
 primary key(agreement_id,product_key)
);
alter table public.catalog_price_agreements enable row level security;
alter table public.catalog_agreed_rates enable row level security;
revoke all on public.catalog_price_agreements,public.catalog_agreed_rates from public,anon,authenticated;
grant select on public.catalog_price_agreements,public.catalog_agreed_rates to authenticated;
grant all on public.catalog_price_agreements,public.catalog_agreed_rates to service_role;
drop policy if exists agreement_own_read on public.catalog_price_agreements;
create policy agreement_own_read on public.catalog_price_agreements for select to authenticated using(public.is_platform_admin() or public.company_role_allows(company_id,array['admin','planner','analyst','approver','viewer']));
drop policy if exists agreed_rate_own_read on public.catalog_agreed_rates;
create policy agreed_rate_own_read on public.catalog_agreed_rates for select to authenticated using(exists(
 select 1 from public.catalog_price_agreements a where a.id=agreement_id and (public.is_platform_admin() or public.company_role_allows(a.company_id,array['admin','planner','analyst','approver','viewer']))));

-- Client viewers receive only agreements explicitly published into their own workspace.
create table if not exists public.catalog_agreement_viewers (
 agreement_id uuid not null references public.catalog_price_agreements(id) on delete cascade,
 company_id uuid not null references public.companies(id), primary key(agreement_id,company_id)
);
alter table public.catalog_agreement_viewers enable row level security;
revoke all on public.catalog_agreement_viewers from public,anon,authenticated;
grant select on public.catalog_agreement_viewers to authenticated;
grant all on public.catalog_agreement_viewers to service_role;
drop policy if exists agreement_viewer_own on public.catalog_agreement_viewers;
create policy agreement_viewer_own on public.catalog_agreement_viewers for select to authenticated using(public.is_platform_admin() or public.company_role_allows(company_id,array['admin','planner','analyst','approver','viewer']));
drop policy if exists agreement_own_read on public.catalog_price_agreements;
create policy agreement_own_read on public.catalog_price_agreements for select to authenticated using(public.is_platform_admin() or public.company_role_allows(company_id,array['admin','planner','analyst','approver','viewer']) or exists(select 1 from public.catalog_agreement_viewers v where v.agreement_id=catalog_price_agreements.id and public.company_role_allows(v.company_id,array['viewer'])));
drop policy if exists agreed_rate_own_read on public.catalog_agreed_rates;
create policy agreed_rate_own_read on public.catalog_agreed_rates for select to authenticated using(exists(select 1 from public.catalog_price_agreements a where a.id=agreement_id));

-- Raw tariff tables contain supplier costs and cross-client terms. Clients use the authorized server projection.
do $boundary$ declare t text; begin
 foreach t in array array['broadcast_sources','broadcast_tv_offers','radio_directory_entries','press_directory_entries','ooh_catalog_assets','influencer_rates','media_catalog_rates','ooh_locations'] loop
 execute format('drop policy if exists negotiated_price_boundary on public.%I',t);
 execute format('create policy negotiated_price_boundary on public.%I as restrictive for select to authenticated using(public.is_platform_admin())',t);
 end loop;
end $boundary$;
commit;
