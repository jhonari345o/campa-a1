-- Client brand assets and editorial calendars. All access uses the caller's session.
begin;
create or replace function public.social_access(p_company uuid,p_mode text default 'read')
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and not coalesce((auth.jwt()->'app_metadata'->>'must_change_password')::boolean,false)
 and p_mode in ('read','edit','approve','create')
 and exists(select 1 from public.companies c where c.id=p_company and c.status::text='activa' and c.portal_kind in ('agency','client')
 and (public.is_platform_admin() or exists(select 1 from public.company_members m where m.company_id=c.id and m.user_id=auth.uid()
 and case p_mode
 when 'read' then m.role::text in ('admin','planner','analyst','approver','viewer')
 when 'edit' then (c.portal_kind='agency' and m.role::text in ('admin','planner')) or (c.portal_kind='client' and c.client_planning_enabled and m.role::text='planner')
 when 'approve' then c.portal_kind='agency' and m.role::text in ('admin','approver')
 when 'create' then c.portal_kind='agency' and m.role::text in ('admin','planner') else false end)));
$$;
revoke all on function public.social_access(uuid,text) from public,anon;
grant execute on function public.social_access(uuid,text) to authenticated;
create policy social_client_read on public.workspace_clients for select to authenticated using(public.social_access(company_id));

create or replace function public.social_text_fields(p_data jsonb,p_keys text[],p_max integer)
returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(p_data)='object' and not exists(select 1 from unnest(p_keys) k where
 jsonb_typeof(p_data->k) is distinct from 'string' or length(p_data->>k)>p_max);
$$;
create table public.social_assets (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,client_id uuid not null,
 kind text not null check(kind in ('logo','manual')),name text not null check(length(name) between 1 and 180),
 mime text not null,size integer not null check(size between 1 and 12582912),
 storage_path text not null unique,created_at timestamptz not null default now(),
 foreign key(company_id,client_id) references public.workspace_clients(company_id,id) on delete cascade,
 check((kind='logo' and mime in ('image/png','image/jpeg','image/webp')) or (kind='manual' and mime='application/pdf')),
 check(storage_path=company_id::text||'/'||client_id::text||'/'||id::text||case mime when 'image/png' then '.png' when 'image/jpeg' then '.jpg' when 'image/webp' then '.webp' else '.pdf' end)
);
create table public.social_brands (
 company_id uuid not null,client_id uuid not null,profile jsonb not null,
 version integer not null default 1 check(version>0),updated_at timestamptz not null default now(),updated_by uuid not null default auth.uid() references auth.users(id),
 primary key(company_id,client_id),foreign key(company_id,client_id) references public.workspace_clients(company_id,id) on delete cascade,
 check(octet_length(profile::text)<=50000 and public.social_text_fields(profile,array['description','audience','tone','rules','forbidden','colors','typography','hashtags','references'],4000)),
 check(profile ?& array['logoAssetId','manualAssetId'])
);
create or replace function public.valid_social_calendar(p_start date,p_end date,p_brief jsonb,p_posts jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare p jsonb; channel text; seen text[]:='{}'; post_date date;
begin
 if p_start is null or p_end is null or p_start>p_end or p_end-p_start>366 or extract(year from p_start) not between 2000 and 2099 or extract(year from p_end) not between 2000 and 2099
 or not coalesce(public.social_text_fields(p_brief,array['objective','audience','offer','pillars','keyDates'],4000),false)
 or jsonb_typeof(p_brief->'channels') is distinct from 'array' or jsonb_array_length(p_brief->'channels') not between 1 and 6
 or jsonb_typeof(p_posts) is distinct from 'array' or jsonb_array_length(p_posts)>120 or octet_length(p_posts::text)>750000 then return false; end if;
 for channel in select jsonb_array_elements_text(p_brief->'channels') loop
  if channel is null or channel<>all(array['Instagram','Facebook','TikTok','LinkedIn','YouTube','X']) or channel=any(seen) then return false; end if;
  seen:=array_append(seen,channel);
 end loop;
 seen:='{}';
 for p in select value from jsonb_array_elements(p_posts) loop
  if not coalesce(public.social_text_fields(p,array['id','title','date','time','channel','format','pillar','direction','caption','cta','status'],4000),false)
   or p->>'id' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   or p->>'id'=any(seen) or length(btrim(p->>'title')) not between 1 and 180 or length(p->>'pillar')>200 or length(p->>'cta')>500
   or p->>'date' !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or p->>'time' !~ '^($|([01][0-9]|2[0-3]):[0-5][0-9])$'
   or not (p_brief->'channels' ? (p->>'channel')) or p->>'format'<>all(array['Imagen','Carrusel','Reel','Historia','Video','Texto'])
   or p->>'status'<>all(array['draft','review','approved'])
   or not(p ? 'approvedBrandVersion') or not (p->'approvedBrandVersion'='null'::jsonb or (jsonb_typeof(p->'approvedBrandVersion')='number' and p->>'approvedBrandVersion' ~ '^[1-9][0-9]{0,8}$')) then return false; end if;
  post_date:=(p->>'date')::date;
  if to_char(post_date,'YYYY-MM-DD')<>p->>'date' or post_date<p_start or post_date>p_end then return false; end if;
  seen:=array_append(seen,p->>'id');
 end loop;
 return true;
exception when others then return false;
end; $$;
create table public.social_periods (
 id uuid primary key,company_id uuid not null,client_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 120),starts_on date not null,ends_on date not null,
 brief jsonb not null,posts jsonb not null default '[]',version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now(),updated_by uuid not null default auth.uid() references auth.users(id),
 foreign key(company_id,client_id) references public.workspace_clients(company_id,id) on delete cascade,
 check(public.valid_social_calendar(starts_on,ends_on,brief,posts))
);
create index social_periods_client on public.social_periods(company_id,client_id,starts_on desc);
create index social_assets_client on public.social_assets(company_id,client_id,created_at desc);
alter table public.social_assets enable row level security;
alter table public.social_brands enable row level security;
alter table public.social_periods enable row level security;
do $$ declare t text; begin
 foreach t in array array['social_assets','social_brands','social_periods'] loop
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy social_read on public.%I for select to authenticated using(public.social_access(company_id))',t);
 end loop;
end $$;
grant insert on public.social_assets to authenticated;
create policy social_asset_insert on public.social_assets for insert to authenticated with check(public.social_access(company_id,'edit'));

create or replace function public.save_social_brand(p_company uuid,p_client uuid,p_version integer,p_profile jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare next_version integer; asset_id uuid;
begin
 if not public.social_access(p_company,'edit') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_version is null or p_version<0 or not coalesce(public.social_text_fields(p_profile,array['description','audience','tone','rules','forbidden','colors','typography','hashtags','references'],4000),false)
 or not(p_profile ?& array['logoAssetId','manualAssetId']) or octet_length(p_profile::text)>50000 then raise exception 'Invalid brand'; end if;
 if p_profile->'logoAssetId'<>'null'::jsonb then
  asset_id:=(p_profile->>'logoAssetId')::uuid;
  if not exists(select 1 from public.social_assets where id=asset_id and company_id=p_company and client_id=p_client and kind='logo') then raise exception 'Invalid logo'; end if;
 end if;
 if p_profile->'manualAssetId'<>'null'::jsonb then
  asset_id:=(p_profile->>'manualAssetId')::uuid;
  if not exists(select 1 from public.social_assets where id=asset_id and company_id=p_company and client_id=p_client and kind='manual') then raise exception 'Invalid manual'; end if;
 end if;
 if p_version=0 then
  insert into public.social_brands(company_id,client_id,profile) values(p_company,p_client,p_profile) on conflict do nothing returning version into next_version;
 else
  update public.social_brands set profile=p_profile,version=version+1,updated_at=now(),updated_by=auth.uid()
  where company_id=p_company and client_id=p_client and version=p_version returning version into next_version;
 end if;
 if next_version is null then raise exception 'SOCIAL_CONFLICT'; end if;
 return next_version;
end; $$;

create or replace function public.save_social_period(p_id uuid,p_company uuid,p_client uuid,p_version integer,p_name text,p_start date,p_end date,p_brief jsonb,p_posts jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.social_periods; next_version integer; cleaned jsonb:='[]'; p jsonb; previous jsonb; context_same boolean;
begin
 if not public.social_access(p_company,'edit') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_version is null or p_version<0 or p_name is null or length(btrim(p_name)) not between 1 and 120 or not coalesce(public.valid_social_calendar(p_start,p_end,p_brief,p_posts),false) then raise exception 'Invalid calendar'; end if;
 select * into old from public.social_periods where id=p_id for update;
 if (found and (old.company_id<>p_company or old.client_id<>p_client or old.version<>p_version)) or (not found and p_version<>0) then raise exception 'SOCIAL_CONFLICT'; end if;
 context_same:=old.brief=p_brief and old.starts_on=p_start and old.ends_on=p_end;
 for p in select value from jsonb_array_elements(p_posts) loop
  previous:=null;
  select value into previous from jsonb_array_elements(coalesce(old.posts,'[]')) where value->>'id'=p->>'id';
  -- Approvals survive only identical content and briefing. Editing always revokes them.
  if context_same and previous->>'status'='approved' and (previous-'status'-'approvedBrandVersion')=(p-'status'-'approvedBrandVersion') then
   p:=jsonb_set(jsonb_set(p,'{status}','"approved"'),'{approvedBrandVersion}',previous->'approvedBrandVersion');
  else
   p:=jsonb_set(jsonb_set(p,'{status}',to_jsonb(case when p->>'status'='review' then 'review'::text else 'draft'::text end)),'{approvedBrandVersion}','null');
  end if;
  cleaned:=cleaned||jsonb_build_array(p);
 end loop;
 if p_version=0 then
  insert into public.social_periods(id,company_id,client_id,name,starts_on,ends_on,brief,posts)
  values(p_id,p_company,p_client,btrim(p_name),p_start,p_end,p_brief,cleaned) on conflict do nothing returning version into next_version;
 else
  update public.social_periods set name=btrim(p_name),starts_on=p_start,ends_on=p_end,brief=p_brief,posts=cleaned,version=version+1,updated_at=now(),updated_by=auth.uid()
  where id=p_id and version=p_version returning version into next_version;
 end if;
 if next_version is null then raise exception 'SOCIAL_CONFLICT'; end if;
 return jsonb_build_object('version',next_version,'posts',cleaned);
end; $$;

create or replace function public.review_social_post(p_period uuid,p_post uuid,p_version integer,p_approve boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cal public.social_periods; brand public.social_brands; changed jsonb; next_version integer;
begin
 select * into cal from public.social_periods where id=p_period for update;
 if not found or not public.social_access(cal.company_id,'approve') then raise exception 'Access denied' using errcode='42501'; end if;
 if cal.version<>p_version or p_version is null or p_approve is null then raise exception 'SOCIAL_CONFLICT'; end if;
 select * into brand from public.social_brands where company_id=cal.company_id and client_id=cal.client_id for share;
 if p_approve and (brand.version is null or brand.profile->>'logoAssetId' is null or length(btrim(brand.profile->>'tone'))=0 or length(btrim(brand.profile->>'rules'))=0) then raise exception 'BRAND_REQUIRED'; end if;
 if not exists(select 1 from jsonb_array_elements(cal.posts) p where p->>'id'=p_post::text and (not p_approve or length(btrim(p->>'caption'))>0)) then raise exception 'CAPTION_REQUIRED'; end if;
 select jsonb_agg(case when p->>'id'=p_post::text then jsonb_set(jsonb_set(p,'{status}',to_jsonb(case when p_approve then 'approved' else 'review' end)),'{approvedBrandVersion}',case when p_approve then to_jsonb(brand.version) else 'null'::jsonb end) else p end order by ord)
 into changed from jsonb_array_elements(cal.posts) with ordinality a(p,ord);
 update public.social_periods set posts=changed,version=version+1,updated_at=now(),updated_by=auth.uid() where id=p_period returning version into next_version;
 return jsonb_build_object('version',next_version,'posts',changed);
end; $$;

create or replace function public.create_social_client(p_company uuid,p_name text,p_category text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.workspace_clients;
begin
 if not public.social_access(p_company,'create') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 180 or p_category is null or length(p_category)>180 then raise exception 'Invalid client'; end if;
 insert into public.workspace_clients(company_id,name,category) values(p_company,btrim(p_name),btrim(p_category))
 on conflict(company_id,name) do nothing returning * into c;
 if c.id is null then select * into c from public.workspace_clients where company_id=p_company and name=btrim(p_name); end if;
 return jsonb_build_object('id',c.id,'name',c.name,'category',c.category);
end; $$;

create table public.social_ai_usage(user_id uuid primary key references auth.users(id) on delete cascade,last_call timestamptz not null);
alter table public.social_ai_usage enable row level security;
revoke all on public.social_ai_usage from public,anon,authenticated;
create or replace function public.claim_social_caption(p_company uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare claimed uuid;
begin
 if not public.social_access(p_company,'edit') then return false; end if;
 insert into public.social_ai_usage(user_id,last_call) values(auth.uid(),now())
 on conflict(user_id) do update set last_call=now() where social_ai_usage.last_call<now()-interval '30 seconds' returning user_id into claimed;
 return claimed is not null;
end; $$;
revoke all on function public.save_social_brand(uuid,uuid,integer,jsonb),public.save_social_period(uuid,uuid,uuid,integer,text,date,date,jsonb,jsonb),public.review_social_post(uuid,uuid,integer,boolean),public.create_social_client(uuid,text,text),public.claim_social_caption(uuid) from public,anon;
grant execute on function public.save_social_brand(uuid,uuid,integer,jsonb),public.save_social_period(uuid,uuid,uuid,integer,text,date,date,jsonb,jsonb),public.review_social_post(uuid,uuid,integer,boolean),public.create_social_client(uuid,text,text),public.claim_social_caption(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('social-brand-assets','social-brand-assets',false,12582912,array['image/png','image/jpeg','image/webp','application/pdf']);
create policy social_asset_read on storage.objects for select to authenticated using(bucket_id='social-brand-assets' and exists(select 1 from public.social_assets a where a.storage_path=storage.objects.name and public.social_access(a.company_id)));
create policy social_asset_read_boundary on storage.objects as restrictive for select to authenticated using(bucket_id<>'social-brand-assets' or exists(select 1 from public.social_assets a where a.storage_path=storage.objects.name and public.social_access(a.company_id)));
create policy social_asset_anon_boundary on storage.objects as restrictive for select to anon using(bucket_id<>'social-brand-assets');
create policy social_asset_upload on storage.objects for insert to authenticated with check(bucket_id='social-brand-assets' and exists(select 1 from public.workspace_clients c where c.company_id::text=split_part(storage.objects.name,'/',1) and c.id::text=split_part(storage.objects.name,'/',2) and public.social_access(c.company_id,'edit')));
create policy social_asset_upload_boundary on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'social-brand-assets' or exists(select 1 from public.workspace_clients c where c.company_id::text=split_part(storage.objects.name,'/',1) and c.id::text=split_part(storage.objects.name,'/',2) and public.social_access(c.company_id,'edit')));
create policy social_asset_no_replace on storage.objects as restrictive for update to authenticated,anon using(bucket_id<>'social-brand-assets') with check(bucket_id<>'social-brand-assets');
-- Failed uploads can remove their orphan object; a registered version is immutable.
create policy social_asset_orphan_remove on storage.objects for delete to authenticated using(bucket_id='social-brand-assets' and not exists(select 1 from public.social_assets a where a.storage_path=storage.objects.name) and exists(select 1 from public.workspace_clients c where c.company_id::text=split_part(storage.objects.name,'/',1) and c.id::text=split_part(storage.objects.name,'/',2) and public.social_access(c.company_id,'edit')));
create policy social_asset_delete_boundary on storage.objects as restrictive for delete to authenticated using(bucket_id<>'social-brand-assets' or (not exists(select 1 from public.social_assets a where a.storage_path=storage.objects.name) and exists(select 1 from public.workspace_clients c where c.company_id::text=split_part(storage.objects.name,'/',1) and c.id::text=split_part(storage.objects.name,'/',2) and public.social_access(c.company_id,'edit'))));
create policy social_asset_anon_insert on storage.objects as restrictive for insert to anon with check(bucket_id<>'social-brand-assets');
create policy social_asset_anon_delete on storage.objects as restrictive for delete to anon using(bucket_id<>'social-brand-assets');
commit;
