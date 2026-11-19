-- Reviewed radio sale defaults. Commercial sources remain private and client agreements retain priority.
begin;
create table if not exists public.catalog_radio_defaults (
 product_key text primary key check(product_key ~ '^radio:regional:[a-f0-9]{32}$'),
 product jsonb not null check(coalesce(jsonb_typeof(product)='object' and product->>'key'=product_key
  and product->>'kind'='radio' and product#>>'{source,defaultPrice}'='true'
  and product#>>'{source,standingPrice}'='true' and product#>>'{source,seconds}' in ('20','30')
  and product#>>'{source,stationId}' ~ '^[a-z0-9-]{1,150}$'
  and product#>>'{source,workspaceProductId}' is null and product#>>'{source,agreementId}' is null
  and (product->>'priceCents')::bigint between 1 and 100000000,false)),
 evidence jsonb not null check(jsonb_typeof(evidence)='object'),
 active boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.catalog_radio_defaults enable row level security;
revoke all on public.catalog_radio_defaults from public,anon,authenticated;
grant all on public.catalog_radio_defaults to service_role;

-- Keep the existing canonical RPC so the order transaction rechecks these prices too.
-- CNE defaults win over general provincial defaults; the server then applies the account's agreement.
create or replace function public.catalog_cne_radio_products()
returns table(product_key text,product jsonb)
language sql stable security definer set search_path='' as $$
 with selected as (
  select v.evidence->>'code' as code,p.provider,p.name,p.format,p.unit,p.market_keys,p.location,
   p.radio_station_id,r.unit_price_cents,r.tax_included
  from public.workspace_catalog_products p
  join public.catalog_agreed_rates r on r.product_key='radio:workspace:'||p.id::text
  join public.catalog_price_agreements a on a.id=r.agreement_id and a.company_id=p.company_id
  join public.catalog_private_provenance v on v.agreement_id=a.id
  where p.medium='radio' and p.active and a.active and not p.reference_only
   and v.evidence->>'priority'='CNE fallback'
   and v.evidence#>>'{source,file}'='cne-rev7-corte-2026-10-31.xlsx'
   and v.evidence#>>'{source,sheet}'='09 Radio general'
   and v.evidence->>'code' ~ '^cne-radio-[a-f0-9-]{36}$'
   and p.format ~ '^Cuña de (20|30) s$' and r.unit_price_cents between 1 and 100000000
 ), consistent as (
  select code,format,market_keys,location,min(provider) as provider,min(name) as name,
   min(unit) as unit,min(radio_station_id) as station_id,min(unit_price_cents) as price,
   case when count(tax_included)=count(*) then bool_and(tax_included) else null end as tax
  from selected group by code,format,market_keys,location
  having min(unit_price_cents)=max(unit_price_cents) and count(distinct radio_station_id)<=1
   and count(distinct tax_included)<=1
 ), projected as (
  select 'radio:cne:'||md5(jsonb_build_array(code,format,market_keys,location)::text) as key,c.*
  from consistent c
 )
 , cne as (select p.key as product_key,jsonb_build_object('key',p.key,'kind','radio','provider',coalesce(d.name,p.provider),'name',p.name,
  'format',p.format,'unit',p.unit,'marketKeys',to_jsonb(p.market_keys),'location',p.location,
  'priceCents',p.price,'taxIncluded',p.tax,'reference','Tarifa de tu cuenta','conditions','',
  'validFrom','2026-11-02','validTo',null,'image',d.logo_path,
  'source',jsonb_strip_nulls(jsonb_build_object('defaultPrice',true,'standingPrice',true,
   'stationId',p.station_id,'seconds',(regexp_match(p.format,'(20|30)'))[1]::int)))
 as product from projected p left join public.radio_directory_entries d on d.id=p.station_id)
 select c.product_key,c.product from cne c
 union all
 select r.product_key,r.product from public.catalog_radio_defaults r
 join public.radio_directory_entries d on d.id=(r.product#>>'{source,stationId}') and d.active
 where r.active and not exists(select 1 from cne c where c.product#>>'{source,stationId}'=r.product#>>'{source,stationId}')
 order by product_key;
$$;
revoke all on function public.catalog_cne_radio_products() from public,anon,authenticated;
grant execute on function public.catalog_cne_radio_products() to service_role;

commit;
