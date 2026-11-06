-- Client planning is an explicit company capability; it never grants purchase approval.
begin;
alter table public.companies add column if not exists client_planning_enabled boolean not null default false;
create or replace function public.company_role_allows(p_company uuid,p_roles text[])
returns boolean language sql stable security definer set search_path='' as $$
 select not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false)
 and exists(select 1 from public.company_members m join public.companies c on c.id=m.company_id
 where m.user_id=auth.uid() and m.company_id=p_company and c.status::text='activa' and m.role::text=any(p_roles)
 and (c.portal_kind='agency' or 'viewer'=any(p_roles) or (c.portal_kind='client' and c.client_planning_enabled and m.role::text in ('planner','analyst'))));
$$;
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
 if c.portal_kind='client' and not c.client_planning_enabled and p_role<>'viewer' then raise exception 'Client portal is read-only'; end if;
 if (select count(*) from public.company_members where company_id=p_company_id)>=c.seats then raise exception 'No seats available'; end if;
 if exists(select 1 from public.company_members where user_id=p_user_id) or exists(select 1 from public.profiles where id=p_user_id and is_platform_admin) then raise exception 'User already has access'; end if;
 if not exists(select 1 from auth.users where id=p_user_id and lower(email)=lower(p_email)) then raise exception 'User mismatch'; end if;
 insert into public.profiles(id,full_name,email,is_platform_admin) values(p_user_id,p_full_name,p_email,false)
 on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,is_platform_admin=false;
 insert into public.company_members(company_id,user_id,role) values(p_company_id,p_user_id,p_role::public.company_role);
 insert into public.audit_log(actor_id,action,entity,entity_id,metadata) values(p_actor_id,'customer_user.created','profiles',p_user_id::text,jsonb_build_object('company_id',p_company_id,'role',p_role,'portal',c.portal_kind,'email',p_email));
end; $$;
create or replace function public.can_access_infomedia()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false)
 and (public.is_platform_admin() or exists(select 1 from public.infomedia_entitlements e
 join public.company_members m on m.company_id=e.company_id join public.companies c on c.id=e.company_id
 where m.user_id=auth.uid() and c.status::text='activa' and e.enabled and e.expires_at>now()
 and ((c.portal_kind='agency' and m.role::text in ('admin','planner','analyst','approver')) or (c.portal_kind='client' and c.client_planning_enabled and m.role::text in ('planner','analyst')))));
$$;
create or replace function public.submit_catalog_request(p_actor uuid,p_company uuid,p_expected_version bigint,
 p_request_id uuid,p_title text,p_desired_start date,p_notes text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.catalog_carts; order_id uuid; item jsonb; is_admin boolean; subtotal bigint:=0; pending boolean:=false;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server role required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=p_actor and not coalesce((raw_app_meta_data->>'must_change_password')::boolean,false)) then raise exception 'Account activation required' using errcode='42501'; end if;
 select coalesce(is_platform_admin,false) into is_admin from public.profiles where id=p_actor;
 if not coalesce(is_admin,false) and not exists(select 1 from public.company_members m join public.companies co on co.id=m.company_id
  where m.user_id=p_actor and m.company_id=p_company and m.role::text in ('admin','planner') and co.status::text='activa' and (co.portal_kind='agency' or (co.portal_kind='client' and co.client_planning_enabled and m.role::text='planner')))
 then raise exception 'Request permission required' using errcode='42501'; end if;
 if p_company is not null and not exists(select 1 from public.companies where id=p_company and status::text='activa') then raise exception 'Inactive workspace'; end if;
 if p_request_id is null or p_title is null or length(btrim(p_title)) not between 1 and 120
  or p_notes is null or length(p_notes)>2000 or p_items is null or jsonb_typeof(p_items)<>'array'
  or jsonb_array_length(p_items) not between 1 and 100 or octet_length(p_items::text)>500000 then raise exception 'Invalid request'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,28));
 select id into order_id from public.catalog_orders where owner_id=p_actor and request_id=p_request_id;
 if found then return jsonb_build_object('id',order_id,'reused',true); end if;
 select * into c from public.catalog_carts where owner_id=p_actor for update;
 if not found or c.version is distinct from p_expected_version or c.updated_at<=now()-interval '2 hours' then raise exception 'CART_CHANGED'; end if;
 if (select jsonb_object_agg(value->>'productKey',value->'quantity') from jsonb_array_elements(c.items)) is distinct from
    (select jsonb_object_agg(value->>'productKey',value->'quantity') from jsonb_array_elements(p_items)) then raise exception 'CART_CHANGED'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item->'quantity') is distinct from 'number' or item->>'quantity' !~ '^[1-9][0-9]{0,4}$' or (item->>'quantity')::int>10000
    or item->>'kind' not in ('influencer','ooh','tv','radio','press','digital') then raise exception 'Invalid product'; end if;
  if item->>'unitPriceCents' is null then pending:=true;
  elsif item->>'unitPriceCents' !~ '^[0-9]+$' then raise exception 'Invalid price';
  else
   if not coalesce(is_admin,false) and (item->>'kind'<>'digital' or item#>>'{source,workspaceProductId}' is not null) and not exists(
    select 1 from public.catalog_agreed_rates r join public.catalog_price_agreements a on a.id=r.agreement_id
    where a.company_id=p_company and a.active and a.valid_from<=current_date and a.valid_to>=current_date
     and a.id::text=item#>>'{source,agreementId}' and r.product_key=item->>'productKey'
     and r.unit_price_cents=(item->>'unitPriceCents')::bigint and r.tax_included is not distinct from (item->>'taxIncluded')::boolean)
   then raise exception 'QUOTE_CHANGED'; end if;
   if item->>'kind'='digital' and item#>>'{source,workspaceProductId}' is null and (item->>'unitPriceCents')::bigint<>100 then raise exception 'QUOTE_CHANGED'; end if;
   subtotal:=subtotal+(item->>'unitPriceCents')::bigint*(item->>'quantity')::int;
  end if;
 end loop;
 if subtotal>1000000000 then raise exception 'Amount limit'; end if;
 insert into public.catalog_orders(request_id,owner_id,company_id,title,desired_start,notes,items,known_subtotal_cents,total_cents)
 values(p_request_id,p_actor,p_company,btrim(p_title),p_desired_start,p_notes,p_items,subtotal,case when pending then null else subtotal end) returning id into order_id;
 update public.catalog_carts set items='[]',version=version+1,updated_at=now() where owner_id=p_actor returning * into c;
 insert into public.audit_log(actor_id,action,entity,entity_id,metadata) values(p_actor,'catalog.request_created','catalog_orders',order_id::text,jsonb_build_object('company_id',p_company,'lines',jsonb_array_length(p_items),'status','pending_review'));
 return jsonb_build_object('id',order_id,'version',c.version,'reused',false);
end; $$;
commit;
