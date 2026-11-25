-- Negotiated postpaid credit: monthly purchasing cap is independent from receivables.
begin;
create table if not exists public.company_credit_accounts (
 company_id uuid primary key references public.companies(id),monthly_limit_cents bigint not null default 0 check(monthly_limit_cents between 0 and 1000000000),
 payment_term_days int not null default 30 check(payment_term_days in (30,60)),active boolean not null default false,
 updated_by uuid references auth.users(id),updated_at timestamptz not null default now()
);
create table if not exists public.company_credit_commitments (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.company_credit_accounts(company_id),
 catalog_order_id uuid not null unique references public.catalog_orders(id),period_month date not null check(extract(day from period_month)=1),
 amount_cents bigint not null check(amount_cents between 1 and 1000000000),status text not null check(status in ('reserved','consumed','released')),
 approved_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create table if not exists public.company_invoices (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 catalog_order_id uuid not null unique references public.catalog_orders(id),external_id text unique,number text,
 issue_date date not null,due_date date not null,amount_cents bigint not null check(amount_cents>0),paid_cents bigint not null default 0 check(paid_cents>=0 and paid_cents<=amount_cents),
 status text not null check(status in ('draft','pending','authorized','paid','cancelled','error')),check(due_date>=issue_date)
);
alter table public.company_credit_accounts enable row level security;
alter table public.company_credit_commitments enable row level security;
alter table public.company_invoices enable row level security;
revoke all on public.company_credit_accounts,public.company_credit_commitments,public.company_invoices from public,anon,authenticated;
grant select on public.company_credit_accounts,public.company_credit_commitments,public.company_invoices to authenticated;
grant all on public.company_credit_accounts,public.company_credit_commitments,public.company_invoices to service_role;
drop policy if exists credit_account_own on public.company_credit_accounts;
create policy credit_account_own on public.company_credit_accounts for select to authenticated using(public.is_platform_admin() or public.company_role_allows(company_id,array['admin','planner','approver']));
drop policy if exists credit_commitment_own on public.company_credit_commitments;
create policy credit_commitment_own on public.company_credit_commitments for select to authenticated using(public.is_platform_admin() or public.company_role_allows(company_id,array['admin','planner','approver']));
drop policy if exists invoice_own on public.company_invoices;
create policy invoice_own on public.company_invoices for select to authenticated using(public.is_platform_admin() or public.company_role_allows(company_id,array['admin','planner','approver']));
-- There are no customer write grants. Approval and billing integrations remain server-only.
create index if not exists credit_month_company on public.company_credit_commitments(company_id,period_month);
commit;
