-- Client workspaces: explicit branding, atomic membership provisioning and
-- database-enforced separation of planning, requesting and approving.
begin;

alter table public.companies add column if not exists brand_key text not null default 'one'
  check (brand_key in ('one', 'lettera'));

create or replace function public.company_role_allows(p_company uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m join public.companies c on c.id=m.company_id
    where m.user_id=auth.uid() and m.company_id=p_company and c.status::text='activa'
      and m.role::text=any(p_roles));
$$;
revoke all on function public.company_role_allows(uuid,text[]) from public,anon;
grant execute on function public.company_role_allows(uuid,text[]) to authenticated,service_role;

-- Restrictive policies remain effective even if an older permissive policy survives.
drop policy if exists customer_plan_read_boundary on public.media_plans;
create policy customer_plan_read_boundary on public.media_plans as restrictive for select to authenticated
using (public.is_platform_admin() or public.company_role_allows(company_id,array['admin','planner','analyst','approver','viewer']));
drop policy if exists customer_plan_insert_boundary on public.media_plans;
create policy customer_plan_insert_boundary on public.media_plans as restrictive for insert to authenticated
with check (public.is_platform_admin() or (owner_id=auth.uid() and public.company_role_allows(company_id,array['admin','planner','analyst'])));
drop policy if exists media_plans_owner_update on public.media_plans;
create policy media_plans_owner_update on public.media_plans for update to authenticated
using (public.is_platform_admin() or (owner_id=auth.uid() and public.company_role_allows(company_id,array['admin','planner','analyst']))
  or public.company_role_allows(company_id,array['admin','approver']))
with check (public.is_platform_admin() or (owner_id=auth.uid() and public.company_role_allows(company_id,array['admin','planner','analyst']))
  or public.company_role_allows(company_id,array['admin','approver']));

create or replace function public.guard_customer_plan()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.role()='service_role' or public.is_platform_admin() then return new; end if;
  if tg_op='UPDATE' and (new.owner_id is distinct from old.owner_id or new.company_id is distinct from old.company_id) then
    raise exception 'Plan ownership and company are immutable' using errcode='42501';
  end if;
  if not public.company_role_allows(new.company_id,array['admin','approver']) then
    if new.status='aprobado' or new.stage='aprobado' then
      raise exception 'Approval role required' using errcode='42501';
    end if;
  elsif tg_op='UPDATE' and old.owner_id<>auth.uid() then
    if (to_jsonb(new)-array['status','stage','progress','updated_at']) is distinct from
       (to_jsonb(old)-array['status','stage','progress','updated_at']) then
      raise exception 'Approvers may only update the decision' using errcode='42501';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists guard_customer_plan on public.media_plans;
create trigger guard_customer_plan before insert or update on public.media_plans
for each row execute function public.guard_customer_plan();

-- A plan owner is not automatically an approver.
drop policy if exists media_plan_approvals_insert on public.media_plan_approvals;
create policy media_plan_approvals_insert on public.media_plan_approvals for insert to authenticated
with check (actor_id=auth.uid() and exists (select 1 from public.media_plans p
  where p.id=plan_id and (public.is_platform_admin() or public.company_role_allows(p.company_id,array['admin','approver']))));

-- A customer can request coordination, never set an order as approved/paid/executed.
drop policy if exists media_orders_insert on public.media_orders;
create policy media_orders_insert on public.media_orders for insert to authenticated
with check (public.is_platform_admin() or (owner_id=auth.uid() and status='pending_review'
  and approved_at is null and completed_at is null
  and public.company_role_allows(company_id,array['admin','planner'])
  and exists (select 1 from public.media_plans p where p.id=plan_id and p.owner_id=auth.uid() and p.company_id=media_orders.company_id)));
drop policy if exists media_orders_update on public.media_orders;
create policy media_orders_update on public.media_orders for update to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists customer_orders_write_boundary on public.media_orders;
create policy customer_orders_write_boundary on public.media_orders as restrictive for update to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists customer_orders_read_boundary on public.media_orders;
create policy customer_orders_read_boundary on public.media_orders as restrictive for select to authenticated
using (public.is_platform_admin() or public.company_role_allows(company_id,array['admin','planner','analyst','approver','viewer']));

drop policy if exists customer_job_insert_boundary on public.campaign_jobs;
create policy customer_job_insert_boundary on public.campaign_jobs as restrictive for insert to authenticated
with check (public.is_platform_admin() or (created_by=auth.uid() and status::text='pendiente'
  and public.company_role_allows(company_id,array['admin','planner'])));

-- The browser cannot call this procedure. The server checks its administrator,
-- and this transaction checks that actor again, locks seats, and records the grant.
create or replace function public.provision_customer_membership(
  p_actor_id uuid,p_user_id uuid,p_company_id uuid,p_full_name text,p_email text,p_role text)
returns void language plpgsql security definer set search_path=public as $$
declare c public.companies;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=p_actor_id and is_platform_admin) then
    raise exception 'Platform administrator required' using errcode='42501';
  end if;
  if p_role not in ('planner','viewer') then raise exception 'Invalid customer role'; end if;
  select * into c from public.companies where id=p_company_id for update;
  if not found or c.status::text<>'activa' then raise exception 'Active company required'; end if;
  if (select count(*) from public.company_members where company_id=p_company_id)>=c.seats then raise exception 'No seats available'; end if;
  if exists(select 1 from public.company_members where user_id=p_user_id)
    or exists(select 1 from public.profiles where id=p_user_id and is_platform_admin) then
    raise exception 'User already has access';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id and lower(email)=lower(p_email)) then raise exception 'User mismatch'; end if;
  insert into public.profiles(id,full_name,email,is_platform_admin) values(p_user_id,p_full_name,p_email,false)
    on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,is_platform_admin=false;
  insert into public.company_members(company_id,user_id,role) values(p_company_id,p_user_id,p_role::public.company_role);
  insert into public.audit_log(actor_id,action,entity,entity_id,metadata)
    values(p_actor_id,'customer_user.created','profiles',p_user_id::text,
      jsonb_build_object('company_id',p_company_id,'role',p_role,'email',p_email,'provisioning','web_admin_console'));
end; $$;
revoke all on function public.provision_customer_membership(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.provision_customer_membership(uuid,uuid,uuid,text,text,text) to service_role;

create or replace function public.customer_access_ready()
returns text language sql stable security definer set search_path=public as $$
  select case when auth.role()='service_role' or public.is_platform_admin() then '0017' else null end;
$$;
revoke all on function public.customer_access_ready() from public,anon;
grant execute on function public.customer_access_ready() to authenticated,service_role;
commit;
