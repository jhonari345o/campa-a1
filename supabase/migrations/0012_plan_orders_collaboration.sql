-- Convierte planes aprobados en órdenes trazables y añade colaboración/versionado visible.

begin;

create table if not exists public.media_orders (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references public.media_plans(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'quoting', 'awaiting_client', 'approved', 'in_execution', 'completed', 'cancelled')),
  currency text not null default 'USD' check (currency = 'USD'),
  media_budget_usd numeric(14, 2) not null default 0 check (media_budget_usd >= 0),
  summary jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_orders_owner_idx on public.media_orders (owner_id, updated_at desc);
create index if not exists media_orders_company_idx on public.media_orders (company_id, status, updated_at desc);

create table if not exists public.media_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.media_orders(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists media_order_events_order_idx on public.media_order_events (order_id, created_at desc);

create table if not exists public.media_plan_comments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.media_plans(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists media_plan_comments_plan_idx on public.media_plan_comments (plan_id, created_at);

create table if not exists public.media_plan_approvals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.media_plans(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('approved', 'changes_requested')),
  note text check (note is null or char_length(note) <= 2000),
  plan_version integer not null check (plan_version > 0),
  created_at timestamptz not null default now()
);

create index if not exists media_plan_approvals_plan_idx on public.media_plan_approvals (plan_id, created_at desc);

alter table public.media_orders enable row level security;
alter table public.media_order_events enable row level security;
alter table public.media_plan_comments enable row level security;
alter table public.media_plan_approvals enable row level security;

drop policy if exists media_orders_read on public.media_orders;
create policy media_orders_read on public.media_orders
  for select to authenticated using (
    owner_id = auth.uid()
    or public.is_platform_admin()
    or (company_id is not null and public.is_company_member(company_id))
  );

drop policy if exists media_orders_insert on public.media_orders;
create policy media_orders_insert on public.media_orders
  for insert to authenticated with check (
    (owner_id = auth.uid() or public.is_platform_admin())
    and exists (
      select 1 from public.media_plans plan
      where plan.id = media_orders.plan_id
        and (plan.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

drop policy if exists media_orders_update on public.media_orders;
create policy media_orders_update on public.media_orders
  for update to authenticated using (owner_id = auth.uid() or public.is_platform_admin())
  with check (owner_id = auth.uid() or public.is_platform_admin());

drop policy if exists media_order_events_read on public.media_order_events;
create policy media_order_events_read on public.media_order_events
  for select to authenticated using (
    exists (
      select 1 from public.media_orders media_order
      where media_order.id = media_order_events.order_id
        and (
          media_order.owner_id = auth.uid()
          or public.is_platform_admin()
          or (media_order.company_id is not null and public.is_company_member(media_order.company_id))
        )
    )
  );

drop policy if exists media_order_events_insert on public.media_order_events;
create policy media_order_events_insert on public.media_order_events
  for insert to authenticated with check (
    actor_id = auth.uid()
    and exists (
      select 1 from public.media_orders media_order
      where media_order.id = media_order_events.order_id
        and (media_order.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

drop policy if exists media_plan_comments_read on public.media_plan_comments;
create policy media_plan_comments_read on public.media_plan_comments
  for select to authenticated using (
    exists (
      select 1 from public.media_plans plan
      where plan.id = media_plan_comments.plan_id
        and (
          plan.owner_id = auth.uid()
          or public.is_platform_admin()
          or (plan.company_id is not null and public.is_company_member(plan.company_id))
        )
    )
  );

drop policy if exists media_plan_comments_insert on public.media_plan_comments;
create policy media_plan_comments_insert on public.media_plan_comments
  for insert to authenticated with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.media_plans plan
      where plan.id = media_plan_comments.plan_id
        and (
          plan.owner_id = auth.uid()
          or public.is_platform_admin()
          or (plan.company_id is not null and public.is_company_member(plan.company_id))
        )
    )
  );

drop policy if exists media_plan_approvals_read on public.media_plan_approvals;
create policy media_plan_approvals_read on public.media_plan_approvals
  for select to authenticated using (
    exists (
      select 1 from public.media_plans plan
      where plan.id = media_plan_approvals.plan_id
        and (
          plan.owner_id = auth.uid()
          or public.is_platform_admin()
          or (plan.company_id is not null and public.is_company_member(plan.company_id))
        )
    )
  );

drop policy if exists media_plan_approvals_insert on public.media_plan_approvals;
create policy media_plan_approvals_insert on public.media_plan_approvals
  for insert to authenticated with check (
    actor_id = auth.uid()
    and exists (
      select 1 from public.media_plans plan
      where plan.id = media_plan_approvals.plan_id
        and (plan.owner_id = auth.uid() or public.is_platform_admin())
    )
  );

drop trigger if exists trg_touch_media_orders on public.media_orders;
create trigger trg_touch_media_orders before update on public.media_orders
  for each row execute function public.touch_updated_at();

grant select, insert, update on public.media_orders to authenticated;
grant select, insert on public.media_order_events, public.media_plan_comments, public.media_plan_approvals to authenticated;
grant usage, select on sequence public.media_order_events_id_seq to authenticated;

commit;
