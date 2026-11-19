-- PagoPlux/PLUX: soporte de Paybox y conciliación autenticada por webhook.

alter table public.campaign_payments
  drop constraint if exists campaign_payments_provider_check;
alter table public.campaign_payments
  alter column provider set default 'pagoplux';
alter table public.campaign_payments
  add constraint campaign_payments_provider_check
  check (provider in ('pagoplux', 'dlocal', 'payphone'));

alter table public.campaign_payment_confirmations
  drop constraint if exists campaign_payment_confirmations_provider_check;
alter table public.campaign_payment_confirmations
  alter column provider set default 'pagoplux';
alter table public.campaign_payment_confirmations
  add constraint campaign_payment_confirmations_provider_check
  check (provider in ('pagoplux', 'dlocal', 'payphone'));

alter table public.campaign_payment_confirmations
  add column if not exists amount_cents integer
    check (amount_cents is null or amount_cents >= 0),
  add column if not exists payload_fingerprint text;

create index if not exists idx_campaign_confirmations_pagoplux_transaction
  on public.campaign_payment_confirmations (provider, provider_confirmation_id)
  where provider = 'pagoplux';

comment on column public.campaign_payment_confirmations.payload_fingerprint is
  'SHA-256 del cuerpo recibido; nunca contiene tarjeta, token ni datos personales.';
