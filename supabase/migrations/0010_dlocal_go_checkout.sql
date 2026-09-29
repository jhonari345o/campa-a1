-- =====================================================================
-- Migración 0010 — Checkout dLocal Go y conciliación contable
-- Conserva pagos históricos PayPhone; las nuevas órdenes usan dLocal Go.
-- Aplicar después de 0006_payphone_meta_pauta.sql.
-- =====================================================================

alter table public.campaign_payments
  drop constraint if exists campaign_payments_provider_check;
alter table public.campaign_payments
  alter column provider set default 'dlocal';
alter table public.campaign_payments
  add constraint campaign_payments_provider_check
  check (provider in ('dlocal', 'payphone'));

alter table public.campaign_payment_confirmations
  drop constraint if exists campaign_payment_confirmations_provider_check;
alter table public.campaign_payment_confirmations
  alter column provider set default 'dlocal';
alter table public.campaign_payment_confirmations
  add constraint campaign_payment_confirmations_provider_check
  check (provider in ('dlocal', 'payphone'));

alter table public.campaign_payments
  add column if not exists provider_net_cents integer
    check (provider_net_cents is null or provider_net_cents >= 0),
  add column if not exists provider_fee_cents integer
    check (provider_fee_cents is null or provider_fee_cents >= 0),
  add column if not exists provider_balance_currency text;

create index if not exists idx_campaign_payments_provider_payment
  on public.campaign_payments (provider, provider_payment_id);

comment on column public.campaign_payments.base_cents is
  'Inversión reservada para medios; Meta la factura por separado al método de pago de la cuenta publicitaria.';
comment on column public.campaign_payments.tax_cents is
  'Cargo comercial del 22% registrado por separado; su tratamiento tributario debe validarse contablemente.';
comment on column public.campaign_payments.fee_cents is
  'Comisión de asistencia de Ad Mavericks (25% de la inversión base).';
comment on column public.campaign_payments.provider_net_cents is
  'Neto reportado por dLocal Go después de su comisión de procesamiento; no equivale a la inversión Meta.';

-- Las escrituras siguen reservadas a service_role en servidor. El webhook
-- firmado solo registra el pago después de consultar de nuevo la API oficial.
