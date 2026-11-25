-- Post-approval campaign configuration. Existing order ownership, prices and approvals are unchanged.
begin;
alter table public.catalog_orders add column if not exists digital_brief jsonb not null default '{}'::jsonb check(jsonb_typeof(digital_brief)='object' and octet_length(digital_brief::text)<=24000);
alter table public.catalog_orders add column if not exists digital_brief_version bigint not null default 0 check(digital_brief_version>=0);
create or replace function public.save_catalog_digital_brief(p_order uuid,p_expected_version bigint,p_brief jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.catalog_orders; item record; next_version bigint;
begin
 if auth.uid() is null or not public.can_use_media_catalog() then raise exception 'Access required' using errcode='42501'; end if;
 select * into o from public.catalog_orders where id=p_order for update;
 if not found or not (
  exists(select 1 from public.profiles where id=auth.uid() and is_platform_admin)
  or (o.owner_id=auth.uid() and public.company_role_allows(o.company_id,array['admin','planner']))
  or public.company_role_allows(o.company_id,array['admin','planner'])
 ) then raise exception 'Order access required' using errcode='42501'; end if;
 if o.status not in ('approved','in_execution') or o.total_cents is null or not exists(select 1 from jsonb_array_elements(o.items)i where i->>'kind'='digital') then raise exception 'Digital approval required'; end if;
 if p_expected_version is null or p_expected_version<>o.digital_brief_version then raise exception 'BRIEF_CHANGED'; end if;
 if p_brief is null or jsonb_typeof(p_brief)<>'object' or octet_length(p_brief::text)>24000 then raise exception 'Invalid brief'; end if;
 for item in select * from jsonb_each(p_brief) loop
  if item.key not in ('campaignName','startDate','endDate','geography','audience','interests','destination','whatsapp','creativeLinks','copy','measurement','notes')
    or jsonb_typeof(item.value)<>'string' or length(item.value#>>'{}')>4000 then raise exception 'Invalid brief field'; end if;
 end loop;
 update public.catalog_orders set digital_brief=p_brief,digital_brief_version=digital_brief_version+1 where id=p_order returning digital_brief_version into next_version;
 insert into public.audit_log(actor_id,action,entity,entity_id,metadata) values(auth.uid(),'catalog.digital_brief_saved','catalog_orders',p_order::text,jsonb_build_object('version',next_version));
 return jsonb_build_object('version',next_version);
end; $$;
revoke all on function public.save_catalog_digital_brief(uuid,bigint,jsonb) from public,anon;
grant execute on function public.save_catalog_digital_brief(uuid,bigint,jsonb) to authenticated;
commit;
