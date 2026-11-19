-- Reportería y post-buys: campañas, ubicaciones y evidencias.

create table if not exists public.postbuy_campaigns (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies (id) on delete set null,
  client_name      text not null check (char_length(client_name) between 1 and 180),
  execution_month  date not null,
  campaign_name    text not null check (char_length(campaign_name) between 1 and 240),
  status           text not null default 'pending'
    check (status in ('completed', 'partial', 'pending')),
  ooh_reach        numeric(8, 6) check (ooh_reach is null or ooh_reach between 0 and 1),
  radio_reach      numeric(8, 6) check (radio_reach is null or radio_reach between 0 and 1),
  total_reach      numeric(8, 6) check (total_reach is null or total_reach between 0 and 1),
  source_file      text,
  source_sheet     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (client_name, execution_month, campaign_name)
);

create table if not exists public.postbuy_placements (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.postbuy_campaigns (id) on delete cascade,
  channel             text not null check (channel in ('ooh', 'radio', 'btl')),
  media_name          text,
  placement_name      text not null check (char_length(placement_name) between 1 and 500),
  element_quantity    integer check (element_quantity is null or element_quantity >= 0),
  media_rights        integer check (media_rights is null or media_rights >= 0),
  monthly_impacts     bigint check (monthly_impacts is null or monthly_impacts >= 0),
  evidence_image_url  text,
  media_logo_url      text,
  evidence_status     text not null default 'pending'
    check (evidence_status in ('verified', 'pending')),
  source_note         text,
  source_row          integer check (source_row is null or source_row > 0),
  display_order       integer not null default 0 check (display_order >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (campaign_id, source_row)
);

create index if not exists idx_postbuy_campaigns_company_month
  on public.postbuy_campaigns (company_id, execution_month desc);
create index if not exists idx_postbuy_placements_campaign_order
  on public.postbuy_placements (campaign_id, display_order);
create index if not exists idx_postbuy_placements_evidence
  on public.postbuy_placements (evidence_status, campaign_id);

alter table public.postbuy_campaigns enable row level security;
alter table public.postbuy_placements enable row level security;

drop policy if exists postbuy_campaigns_read on public.postbuy_campaigns;
create policy postbuy_campaigns_read on public.postbuy_campaigns
  for select to authenticated using (
    public.is_platform_admin()
    or (company_id is not null and company_id in (select public.my_company_ids()))
  );

drop policy if exists postbuy_campaigns_admin_write on public.postbuy_campaigns;
create policy postbuy_campaigns_admin_write on public.postbuy_campaigns
  for all to authenticated using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists postbuy_placements_read on public.postbuy_placements;
create policy postbuy_placements_read on public.postbuy_placements
  for select to authenticated using (
    exists (
      select 1
      from public.postbuy_campaigns campaign
      where campaign.id = postbuy_placements.campaign_id
        and (
          public.is_platform_admin()
          or (campaign.company_id is not null and campaign.company_id in (select public.my_company_ids()))
        )
    )
  );

drop policy if exists postbuy_placements_admin_write on public.postbuy_placements;
create policy postbuy_placements_admin_write on public.postbuy_placements
  for all to authenticated using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop trigger if exists trg_touch_postbuy_campaigns on public.postbuy_campaigns;
create trigger trg_touch_postbuy_campaigns
  before update on public.postbuy_campaigns
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_postbuy_placements on public.postbuy_placements;
create trigger trg_touch_postbuy_placements
  before update on public.postbuy_placements
  for each row execute function public.touch_updated_at();

grant select on public.postbuy_campaigns, public.postbuy_placements to authenticated;
revoke insert, update, delete on public.postbuy_campaigns, public.postbuy_placements from anon, authenticated;

comment on table public.postbuy_campaigns is
  'Cabecera mensual de una campaña para reportería y post-buy.';
comment on table public.postbuy_placements is
  'Ubicaciones, programas o elementos BTL y su evidencia de ejecución.';
comment on column public.postbuy_placements.evidence_image_url is
  'NULL significa evidencia pendiente y se representa visualmente en amarillo.';
