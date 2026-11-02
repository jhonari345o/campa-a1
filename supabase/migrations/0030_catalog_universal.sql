-- Cross-medium, per-account catalog selections with two-hour inactivity expiry.
begin;
create or replace function public.load_catalog_cart() returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.catalog_carts;
begin
 if auth.uid() is null or not public.can_use_media_catalog() then raise exception 'Catalog access required' using errcode='42501'; end if;
 select * into c from public.catalog_carts where owner_id=auth.uid() for update;
 if not found then return jsonb_build_object('version',0,'items','[]'::jsonb); end if;
 if c.updated_at<=now()-interval '2 hours' and c.items<>'[]'::jsonb then
  update public.catalog_carts set items='[]',version=version+1,updated_at=now() where owner_id=auth.uid() returning * into c;
 end if;
 return jsonb_build_object('version',c.version,'items',c.items,'expiresAt',c.updated_at+interval '2 hours');
end; $$;
revoke all on function public.load_catalog_cart() from public,anon;
grant execute on function public.load_catalog_cart() to authenticated;

create or replace function public.save_catalog_cart(p_expected_version bigint,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.catalog_carts; item jsonb;
begin
 if auth.uid() is null or not public.can_use_media_catalog() then raise exception 'Catalog access required' using errcode='42501'; end if;
 if p_expected_version is null or p_expected_version<0 or p_items is null or jsonb_typeof(p_items)<>'array'
   or jsonb_array_length(p_items)>100 or octet_length(p_items::text)>250000 then raise exception 'Invalid cart'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>2
    or jsonb_typeof(item->'productKey') is distinct from 'string' or length(item->>'productKey') not between 1 and 2048
    or item->>'productKey' !~ '^(creator:|ooh:|tv:|radio:|press:|digital:)' or item->>'productKey' ~ '[[:cntrl:]]'
    or jsonb_typeof(item->'quantity') is distinct from 'number' or item->>'quantity' !~ '^[1-9][0-9]{0,4}$' or (item->>'quantity')::int>10000 then raise exception 'Invalid cart item'; end if;
 end loop;
 if (select count(distinct value->>'productKey') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'Duplicate product'; end if;
 insert into public.catalog_carts(owner_id) values(auth.uid()) on conflict do nothing;
 select * into c from public.catalog_carts where owner_id=auth.uid() for update;
 if c.items<>'[]'::jsonb and c.updated_at<=now()-interval '2 hours' then
  update public.catalog_carts set items='[]',version=version+1,updated_at=now() where owner_id=auth.uid() returning * into c;
  return jsonb_build_object('ok',false,'code','expired','version',c.version,'items',c.items);
 end if;
 if c.items=p_items then return jsonb_build_object('ok',true,'version',c.version,'items',c.items,'expiresAt',c.updated_at+interval '2 hours'); end if;
 if c.version<>p_expected_version then return jsonb_build_object('ok',false,'code','conflict','version',c.version,'items',c.items); end if;
 update public.catalog_carts set items=p_items,version=version+1,updated_at=now() where owner_id=auth.uid() returning * into c;
 return jsonb_build_object('ok',true,'version',c.version,'items',c.items,'expiresAt',c.updated_at+interval '2 hours');
end; $$;

-- The server resolves identifiers and quantities against its authorized catalog projection.
-- A browser cannot call this RPC or provide prices directly.
create or replace function public.submit_catalog_request(p_actor uuid,p_company uuid,p_expected_version bigint,
 p_request_id uuid,p_title text,p_desired_start date,p_notes text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.catalog_carts; order_id uuid; item jsonb; is_admin boolean; subtotal bigint:=0; pending boolean:=false;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server role required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=p_actor and not coalesce((raw_app_meta_data->>'must_change_password')::boolean,false)) then raise exception 'Account activation required' using errcode='42501'; end if;
 select coalesce(is_platform_admin,false) into is_admin from public.profiles where id=p_actor;
 if not coalesce(is_admin,false) and not exists(select 1 from public.company_members m join public.companies co on co.id=m.company_id
  where m.user_id=p_actor and m.company_id=p_company and m.role::text in ('admin','planner') and co.status::text='activa' and co.portal_kind='agency')
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
   if not coalesce(is_admin,false) and item->>'kind'<>'digital' and not exists(
    select 1 from public.catalog_agreed_rates r join public.catalog_price_agreements a on a.id=r.agreement_id
    where a.company_id=p_company and a.active and a.valid_from<=current_date and a.valid_to>=current_date
     and a.id::text=item#>>'{source,agreementId}' and r.product_key=item->>'productKey'
     and r.unit_price_cents=(item->>'unitPriceCents')::bigint and r.tax_included is not distinct from (item->>'taxIncluded')::boolean)
   then raise exception 'QUOTE_CHANGED'; end if;
   if item->>'kind'='digital' and (item->>'unitPriceCents')::bigint<>100 then raise exception 'QUOTE_CHANGED'; end if;
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
revoke all on function public.submit_catalog_request(uuid,uuid,bigint,uuid,text,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_catalog_request(uuid,uuid,bigint,uuid,text,date,text,jsonb) to service_role;
commit;
