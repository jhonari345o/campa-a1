-- =====================================================================
--  Migracion 0006 — Cobros PayPhone y entrega real de pauta en Meta
--  Aplicar en Supabase -> SQL Editor -> Run. Seguro re-ejecutar.
-- =====================================================================

alter type public.job_status add value if not exists 'esperando_pago';
alter type public.job_status add value if not exists 'pagada';
alter type public.job_status add value if not exists 'lista_para_publicar';
alter type public.job_status add value if not exists 'publicando';

create table if not exists public.campaign_payments (
  id                       uuid primary key default gen_random_uuid(),
  job_id                   uuid not null unique references public.campaign_jobs (id) on delete cascade,
  company_id               uuid not null references public.companies (id) on delete cascade,
  provider                 text not null default 'payphone' check (provider = 'payphone'),
  client_transaction_id    text not null unique,
  provider_payment_id      text unique,
  provider_transaction_id  text unique,
  authorization_code       text,
  status                   text not null default 'payment_preparing'
                           check (status in (
                             'payment_preparing', 'payment_open', 'paid',
                             'cancelled', 'failed', 'requires_attention', 'reversed'
                           )),
  currency                 text not null default 'usd' check (currency = 'usd'),
  base_cents               integer not null check (base_cents > 0),
  tax_cents                integer not null check (tax_cents >= 0),
  fee_cents                integer not null check (fee_cents >= 0),
  total_cents              integer not null check (total_cents = base_cents + tax_cents + fee_cents),
  checkout_url             text,
  metadata                 jsonb not null default '{}'::jsonb,
  paid_at                  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_campaign_payments_company
  on public.campaign_payments (company_id, created_at desc);
create index if not exists idx_campaign_payments_status
  on public.campaign_payments (status, created_at);

create table if not exists public.campaign_payment_confirmations (
  id                        uuid primary key default gen_random_uuid(),
  provider                  text not null default 'payphone' check (provider = 'payphone'),
  provider_confirmation_id  text not null unique,
  client_transaction_id     text not null,
  payment_id                uuid references public.campaign_payments (id) on delete set null,
  transaction_status        text,
  processed_at              timestamptz,
  error                     text,
  created_at                timestamptz not null default now()
);

create table if not exists public.campaign_deliveries (
  id                    uuid primary key default gen_random_uuid(),
  job_id                uuid not null references public.campaign_jobs (id) on delete cascade,
  company_id            uuid not null references public.companies (id) on delete cascade,
  provider              text not null default 'meta' check (provider = 'meta'),
  status                text not null default 'ready'
                        check (status in ('ready', 'creating', 'paused', 'active', 'error', 'cancelled')),
  provider_campaign_id  text,
  provider_adset_id     text,
  provider_creative_id  text,
  provider_ad_id        text,
  error                 text,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (job_id, provider)
);

create index if not exists idx_campaign_deliveries_company
  on public.campaign_deliveries (company_id, created_at desc);
create index if not exists idx_campaign_deliveries_status
  on public.campaign_deliveries (status, created_at);

alter table public.campaign_payments enable row level security;
alter table public.campaign_payment_confirmations enable row level security;
alter table public.campaign_deliveries enable row level security;

drop policy if exists campaign_payments_read on public.campaign_payments;
create policy campaign_payments_read on public.campaign_payments
  for select using (
    public.is_platform_admin() or company_id in (select public.my_company_ids())
  );

drop policy if exists campaign_deliveries_read on public.campaign_deliveries;
create policy campaign_deliveries_read on public.campaign_deliveries
  for select using (
    public.is_platform_admin() or company_id in (select public.my_company_ids())
  );

drop policy if exists campaign_payment_confirmations_admin_read on public.campaign_payment_confirmations;
create policy campaign_payment_confirmations_admin_read on public.campaign_payment_confirmations
  for select using (public.is_platform_admin());

-- No hay politicas INSERT/UPDATE publicas. La preparacion/confirmacion PayPhone
-- y la integracion Meta escriben con service_role exclusivamente en servidor.

drop trigger if exists trg_touch_campaign_payments on public.campaign_payments;
create trigger trg_touch_campaign_payments
  before update on public.campaign_payments
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_campaign_deliveries on public.campaign_deliveries;
create trigger trg_touch_campaign_deliveries
  before update on public.campaign_deliveries
  for each row execute function public.touch_updated_at();

