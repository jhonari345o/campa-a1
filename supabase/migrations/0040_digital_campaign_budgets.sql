-- Preserve legacy USD-unit carts and accept bounded, server-resolved campaign budgets.
begin;
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
 if c.active_client_id is not null and not exists(select 1 from public.workspace_clients where id=c.active_client_id and company_id=p_company) then raise exception 'CLIENT_CHANGED'; end if;
 if not coalesce(is_admin,false) and exists(select 1 from public.companies co join public.workspace_clients wc on wc.company_id=co.id where co.id=p_company and co.portal_kind='agency') and c.active_client_id is null then raise exception 'CLIENT_REQUIRED'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item->'quantity') is distinct from 'number' or item->>'quantity' !~ '^[1-9][0-9]{0,4}$' or (item->>'quantity')::int>10000
    or item->>'kind' not in ('influencer','ooh','tv','radio','press','digital') then raise exception 'Invalid product'; end if;
  if item->>'unitPriceCents' is null then pending:=true;
  elsif item->>'unitPriceCents' !~ '^[0-9]+$' then raise exception 'Invalid price';
  else
   if not coalesce(is_admin,false) and (item->>'kind'<>'digital' or item#>>'{source,workspaceProductId}' is not null) and not exists(
    select 1 from public.catalog_agreed_rates r join public.catalog_price_agreements a on a.id=r.agreement_id
    where a.company_id=p_company and (a.client_id is null or a.client_id=c.active_client_id) and a.active and a.valid_from<=current_date and a.valid_to>=current_date
     and a.id::text=item#>>'{source,agreementId}' and r.product_key=item->>'productKey'
     and r.unit_price_cents=(item->>'unitPriceCents')::bigint and r.tax_included is not distinct from (item->>'taxIncluded')::boolean)
   then raise exception 'QUOTE_CHANGED'; end if;
   if item->>'kind'='digital' and item#>>'{source,workspaceProductId}' is null then
    if item->>'productKey' ~ '^digital:(google-ads|meta-ads|linkedin-ads|tiktok-ads|spotify-ads|pinterest-ads|programmatic-dsp):budget:(impressions|views|reach|clicks|forms|whatsapp|sales):[1-9][0-9]{0,9}$' then
     if (item->>'quantity')::int<>1 or pg_catalog.split_part(item->>'productKey',':',5)::bigint not between 1 and 1000000000
       or (item->>'unitPriceCents')::bigint<>pg_catalog.split_part(item->>'productKey',':',5)::bigint then raise exception 'QUOTE_CHANGED'; end if;
    elsif (item->>'unitPriceCents')::bigint<>100 or item->>'productKey' like '%:budget:%' then raise exception 'QUOTE_CHANGED';
    end if;
   end if;
   subtotal:=subtotal+(item->>'unitPriceCents')::bigint*(item->>'quantity')::int;
  end if;
 end loop;
 if subtotal>1000000000 then raise exception 'Amount limit'; end if;
 insert into public.catalog_orders(request_id,owner_id,company_id,client_id,title,desired_start,notes,items,known_subtotal_cents,total_cents)
 values(p_request_id,p_actor,p_company,c.active_client_id,btrim(p_title),p_desired_start,p_notes,p_items,subtotal,case when pending then null else subtotal end) returning id into order_id;
 update public.catalog_carts set items='[]',version=version+1,updated_at=now() where owner_id=p_actor returning * into c;
 insert into public.audit_log(actor_id,action,entity,entity_id,metadata) values(p_actor,'catalog.request_created','catalog_orders',order_id::text,jsonb_build_object('company_id',p_company,'lines',jsonb_array_length(p_items),'status','pending_review'));
 return jsonb_build_object('id',order_id,'version',c.version,'reused',false);
end; $$;

revoke all on function public.submit_catalog_request(uuid,uuid,bigint,uuid,text,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_catalog_request(uuid,uuid,bigint,uuid,text,date,text,jsonb) to service_role;
commit;
