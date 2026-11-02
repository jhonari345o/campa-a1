-- Private agency library. No customer records or documents belong in Git.
begin;
create table if not exists public.workspace_clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 180),
  category text not null default '' check (char_length(category) <= 180),
  campaign_kind text not null default 'campaign' check (campaign_kind in ('film','campaign')),
  unique(company_id,id), unique(company_id,name)
);
create table if not exists public.workspace_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null,
  name text not null check (char_length(name) between 1 and 240),
  period text not null default '' check (char_length(period) <= 120),
  status text not null default 'planning' check (status in ('planning','running','reported')),
  poster text check (poster is null or poster ~ '^/postbuy/warner/posters/[a-z0-9-]+[.]jpg$'),
  summary text not null default '' check (char_length(summary) <= 2000),
  sort_order integer not null default 0,
  foreign key(company_id,client_id) references public.workspace_clients(company_id,id) on delete cascade,
  unique(company_id,id)
);
create table if not exists public.workspace_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null,
  title text not null check (char_length(title) between 1 and 240),
  kind text not null check (kind in ('plan','report')),
  version text not null default '' check (char_length(version) <= 100),
  issued_on date,
  summary text not null default '' check (char_length(summary) <= 4000),
  sections jsonb not null default '[]' check (jsonb_typeof(sections)='array'),
  downloadable boolean not null default false,
  storage_path text,
  foreign key(company_id,campaign_id) references public.workspace_campaigns(company_id,id) on delete cascade,
  unique(company_id,campaign_id,id),
  unique(storage_path),
  check (not downloadable or storage_path is not null),
  check (storage_path is null or (
    storage_path like company_id::text || '/' || campaign_id::text || '/' || id::text || '/%'
    and storage_path ~ '^[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+/[a-zA-Z0-9_-]+[.](pdf|xlsx|pptx|png|jpg|webp)$'
  ))
);
create table if not exists public.workspace_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null,
  plan_document_id uuid,
  report_document_id uuid,
  label text not null check (char_length(label) between 1 and 180),
  unit text not null check (unit in ('USD','number','percent')),
  planned jsonb check (planned is null or jsonb_typeof(planned)='object'),
  reported jsonb check (reported is null or jsonb_typeof(reported)='object'),
  sort_order integer not null default 0,
  foreign key(company_id,campaign_id) references public.workspace_campaigns(company_id,id) on delete cascade,
  foreign key(company_id,campaign_id,plan_document_id) references public.workspace_documents(company_id,campaign_id,id),
  foreign key(company_id,campaign_id,report_document_id) references public.workspace_documents(company_id,campaign_id,id),
  check (planned is not null or reported is not null),
  check (planned is null or plan_document_id is not null),
  check (reported is null or report_document_id is not null)
);
create index if not exists workspace_clients_company on public.workspace_clients(company_id);
create index if not exists workspace_campaigns_client on public.workspace_campaigns(company_id,client_id,sort_order);
create index if not exists workspace_documents_campaign on public.workspace_documents(company_id,campaign_id);
create index if not exists workspace_metrics_campaign on public.workspace_metrics(company_id,campaign_id,sort_order);

-- Only service-side imports write. A planner cannot create links to another workspace,
-- enable downloads, replace source documents, or publish client-facing results.
do $$
declare t text;
begin
  foreach t in array array['workspace_clients','workspace_campaigns','workspace_documents','workspace_metrics']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists workspace_library_read on public.%I',t);
    execute format('create policy workspace_library_read on public.%I for select to authenticated using (
      public.is_platform_admin() or public.company_role_allows(company_id,array[''admin'',''planner'',''approver'',''viewer'']))',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('workspace-documents','workspace-documents',false,52428800,
  array['application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false;
drop policy if exists workspace_document_read on storage.objects;
create policy workspace_document_read on storage.objects for select to authenticated using (
  bucket_id='workspace-documents' and exists (
    select 1 from public.workspace_documents d
    where d.storage_path=storage.objects.name and d.downloadable
      and (public.is_platform_admin() or public.company_role_allows(d.company_id,array['admin','planner','approver','viewer']))
  )
);
-- Restrictive boundary protects this bucket even if another existing policy is broad.
drop policy if exists workspace_document_boundary on storage.objects;
create policy workspace_document_boundary on storage.objects as restrictive for select to authenticated using (
  bucket_id <> 'workspace-documents' or exists (
    select 1 from public.workspace_documents d
    where d.storage_path=storage.objects.name and d.downloadable
      and (public.is_platform_admin() or public.company_role_allows(d.company_id,array['admin','planner','approver','viewer']))
  )
);
do $$
declare operation text;
begin
  foreach operation in array array['insert','update','delete'] loop
    execute format('drop policy if exists workspace_document_no_%s on storage.objects',operation);
    if operation='insert' then
      execute 'create policy workspace_document_no_insert on storage.objects as restrictive for insert to authenticated,anon with check(bucket_id <> ''workspace-documents'')';
    elsif operation='update' then
      execute 'create policy workspace_document_no_update on storage.objects as restrictive for update to authenticated,anon using(bucket_id <> ''workspace-documents'') with check(bucket_id <> ''workspace-documents'')';
    else
      execute 'create policy workspace_document_no_delete on storage.objects as restrictive for delete to authenticated,anon using(bucket_id <> ''workspace-documents'')';
    end if;
  end loop;
end $$;
drop policy if exists workspace_document_anon_boundary on storage.objects;
create policy workspace_document_anon_boundary on storage.objects as restrictive for select to anon using(bucket_id <> 'workspace-documents');
commit;

