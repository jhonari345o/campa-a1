-- Presentation identity stays attached to an authenticated company membership.
begin;
alter table public.companies drop constraint if exists companies_brand_key_check;
alter table public.companies add constraint companies_brand_key_check check(brand_key in ('one','lettera','ucsg'));
create or replace function public.workspace_brand_ready() returns text language sql stable security definer set search_path='' as $$
 select case when auth.role()='service_role' or public.is_platform_admin() then '0032' else null end;
$$;
revoke all on function public.workspace_brand_ready() from public,anon;
grant execute on function public.workspace_brand_ready() to authenticated,service_role;
commit;
