-- Standalone catalog selections and requests. No payment or media-plan approval.
begin;
create table if not exists public.catalog_carts (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 version bigint not null default 0 check(version>=0),
 items jsonb not null default '[]'::jsonb check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=100),
 updated_at timestamptz not null default now()
);
alter table public.catalog_carts enable row level security;
revoke all on public.catalog_carts from public,anon,authenticated;
grant select on public.catalog_carts to authenticated;
grant all on public.catalog_carts to service_role;
drop policy if exists catalog_cart_own_read on public.catalog_carts;
create policy catalog_cart_own_read on public.catalog_carts for select to authenticated
 using(owner_id=auth.uid() and public.can_use_media_catalog());

create or replace function public.save_catalog_cart(p_expected_version bigint,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.catalog_carts; item jsonb;
begin
 if auth.uid() is null or not public.can_use_media_catalog() then raise exception 'Catalog access required' using errcode='42501'; end if;
 if p_expected_version is null or p_expected_version<0 or p_items is null or jsonb_typeof(p_items)<>'array'
   or jsonb_array_length(p_items)>100 or octet_length(p_items::text)>250000 then raise exception 'Invalid cart'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>2
    or not item ? 'productKey' or not item ? 'quantity' or jsonb_typeof(item->'productKey')<>'string'
    or length(item->>'productKey') not between 1 and 2048 or item->>'productKey' !~ '^(creator:|ooh:)'
    or item->>'productKey' ~ '[[:cntrl:]]' or jsonb_typeof(item->'quantity')<>'number'
    or item->>'quantity' !~ '^[1-9][0-9]?$' then raise exception 'Invalid cart item'; end if;
 end loop;
 if (select count(distinct value->>'productKey') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'Duplicate product'; end if;
 insert into public.catalog_carts(owner_id) values(auth.uid()) on conflict do nothing;
 select * into c from public.catalog_carts where owner_id=auth.uid() for update;
 if c.items=p_items then return jsonb_build_object('ok',true,'version',c.version,'items',c.items); end if;
 if c.version<>p_expected_version then return jsonb_build_object('ok',false,'code','conflict','version',c.version,'items',c.items); end if;
 update public.catalog_carts set items=p_items,version=version+1,updated_at=now() where owner_id=auth.uid() returning * into c;
 return jsonb_build_object('ok',true,'version',c.version,'items',c.items);
end; $$;
revoke all on function public.save_catalog_cart(bigint,jsonb) from public,anon;
grant execute on function public.save_catalog_cart(bigint,jsonb) to authenticated;

create table if not exists public.catalog_orders (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null,
 owner_id uuid not null references auth.users(id) on delete cascade,
 company_id uuid references public.companies(id) on delete set null,
 title text not null check(length(title) between 1 and 120),
 desired_start date, notes text not null default '' check(length(notes)<=2000),
 status text not null default 'pending_review' check(status in ('pending_review','quoting','awaiting_client','approved','in_execution','completed','cancelled')),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 100),
 known_subtotal_cents bigint not null check(known_subtotal_cents between 0 and 1000000000),
 total_cents bigint check(total_cents between 0 and 1000000000),
 currency text not null default 'USD' check(currency='USD'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,request_id)
);
create index if not exists catalog_orders_company on public.catalog_orders(company_id,created_at desc);
alter table public.catalog_orders enable row level security;
revoke all on public.catalog_orders from public,anon,authenticated;
grant select on public.catalog_orders to authenticated;
grant all on public.catalog_orders to service_role;
drop policy if exists catalog_order_read on public.catalog_orders;
create policy catalog_order_read on public.catalog_orders for select to authenticated
 using(public.is_platform_admin() or (public.can_use_media_catalog() and (owner_id=auth.uid()
 or public.company_role_allows(company_id,array['admin','planner','analyst','approver','viewer']))));

-- Called only by the authenticated server after it resolves the current catalog.
create or replace function public.submit_catalog_request(p_actor uuid,p_company uuid,p_expected_version bigint,
 p_request_id uuid,p_title text,p_desired_start date,p_notes text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.catalog_carts; order_id uuid; item jsonb; is_admin boolean; subtotal bigint:=0; pending boolean:=false; rate numeric;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server role required' using errcode='42501'; end if;
 select coalesce(is_platform_admin,false) into is_admin from public.profiles where id=p_actor;
 if not coalesce(is_admin,false) and not exists(select 1 from public.company_members m join public.companies co on co.id=m.company_id
  where m.user_id=p_actor and m.company_id=p_company and m.role::text in ('admin','planner') and co.status::text='activa')
 then raise exception 'Request permission required' using errcode='42501'; end if;
 if p_company is not null and not exists(select 1 from public.companies where id=p_company and status::text='activa') then raise exception 'Inactive workspace'; end if;
 if p_request_id is null or p_title is null or length(btrim(p_title)) not between 1 and 120
  or p_notes is null or length(p_notes)>2000 or p_items is null or jsonb_typeof(p_items)<>'array'
  or jsonb_array_length(p_items) not between 1 and 100 or octet_length(p_items::text)>500000 then raise exception 'Invalid request'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,28));
 select id into order_id from public.catalog_orders where owner_id=p_actor and request_id=p_request_id;
 if found then return jsonb_build_object('id',order_id,'reused',true); end if;
 select * into c from public.catalog_carts where owner_id=p_actor for update;
 if not found or c.version is distinct from p_expected_version then raise exception 'CART_CHANGED'; end if;
 if (select jsonb_object_agg(value->>'productKey',value->'quantity') from jsonb_array_elements(c.items)) is distinct from
    (select jsonb_object_agg(value->>'productKey',value->'quantity') from jsonb_array_elements(p_items)) then raise exception 'CART_CHANGED'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item->'quantity')<>'number' or item->>'quantity' !~ '^[1-9][0-9]?$' then raise exception 'Invalid quantity'; end if;
  if item->>'kind'='influencer' then
   select r.amount_usd*100 into rate from public.influencer_rates r join public.influencer_profiles p on p.id=r.profile_id
    where r.id::text=item#>>'{source,rateId}' and p.id::text=item#>>'{source,profileId}' and p.active
    and item->>'productKey'='creator:'||r.id::text
    and r.tax_included=(item->>'taxIncluded')::boolean;
   if not found or rate is distinct from (item->>'unitPriceCents')::numeric then raise exception 'QUOTE_CHANGED'; end if;
  elsif item->>'kind'='ooh' then
   if not exists(select 1 from public.ooh_catalog_assets a where a.id=item#>>'{source,assetId}' and a.active
     and ((item#>'{source,rate}' is null and item->>'unitPriceCents' is null and coalesce(jsonb_array_length(a.details->'rates'),0)=0
       and item->>'productKey'='ooh:'||a.id||':quote')
     or exists(select 1 from jsonb_array_elements(a.details->'rates') as rr(value) where jsonb_build_object('amount',rr.value->'amount','period',rr.value->'period','basis',rr.value->'basis','component',rr.value->'component')=item#>'{source,rate}'
       and round((rr.value->>'amount')::numeric*100)=(item->>'unitPriceCents')::numeric)))
   then raise exception 'QUOTE_CHANGED'; end if;
  else raise exception 'Invalid medium'; end if;
  if item->>'unitPriceCents' is null then pending:=true;
  elsif item->>'unitPriceCents' !~ '^[0-9]+$' then raise exception 'Invalid price';
  else subtotal:=subtotal+(item->>'unitPriceCents')::bigint*(item->>'quantity')::int; end if;
 end loop;
 if subtotal>1000000000 then raise exception 'Amount limit'; end if;
 insert into public.catalog_orders(request_id,owner_id,company_id,title,desired_start,notes,items,known_subtotal_cents,total_cents)
 values(p_request_id,p_actor,p_company,btrim(p_title),p_desired_start,p_notes,p_items,subtotal,case when pending then null else subtotal end)
 returning id into order_id;
 update public.catalog_carts set items='[]'::jsonb,version=version+1,updated_at=now() where owner_id=p_actor returning * into c;
 insert into public.audit_log(actor_id,action,entity,entity_id,metadata)
 values(p_actor,'catalog.request_created','catalog_orders',order_id::text,jsonb_build_object('company_id',p_company,'lines',jsonb_array_length(p_items),'status','pending_review'));
 return jsonb_build_object('id',order_id,'version',c.version,'reused',false);
end; $$;
revoke all on function public.submit_catalog_request(uuid,uuid,bigint,uuid,text,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_catalog_request(uuid,uuid,bigint,uuid,text,date,text,jsonb) to service_role;

-- Acquisition history stays private to platform administrators.
create table if not exists public.ooh_purchase_references (
 id text primary key, provider_slug text not null, asset_id text references public.ooh_catalog_assets(id) on delete set null,
 location text not null, format text not null default '', period_start date, period_end date,
 invoice_number text not null, invoice_date date, paid_at date,
 purchase_net_usd numeric(14,2), paid_usd numeric(14,2), unit_price_usd numeric(14,2), unit text,
 tax_label text not null, payment_status text not null check(payment_status in ('verified','partial','invoiced')),
 scope_note text not null, evidence jsonb not null, created_at timestamptz not null default now(),
 check(purchase_net_usd is null or purchase_net_usd>=0), check(paid_usd is null or paid_usd>=0),
 check(unit_price_usd is null or unit_price_usd>=0)
);
alter table public.ooh_purchase_references enable row level security;
revoke all on public.ooh_purchase_references from public,anon,authenticated;
grant select on public.ooh_purchase_references to authenticated;
grant all on public.ooh_purchase_references to service_role;
drop policy if exists ooh_purchase_admin_read on public.ooh_purchase_references;
create policy ooh_purchase_admin_read on public.ooh_purchase_references for select to authenticated using(public.is_platform_admin());
commit;
