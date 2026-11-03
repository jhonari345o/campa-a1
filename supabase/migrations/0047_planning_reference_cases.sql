-- Reviewed case definitions and their private provenance stay server-side.
create table if not exists public.planning_reference_cases (
 id uuid primary key default gen_random_uuid(),
 company_id uuid references public.companies(id),
 client_id uuid references public.workspace_clients(id),
 sharing text not null check(sharing in ('client','method')),
 definition jsonb not null check(jsonb_typeof(definition)='object'),
 provenance jsonb not null default '{}'::jsonb check(jsonb_typeof(provenance)='object'),
 reviewed_at timestamptz,
 active boolean not null default false,
 updated_at timestamptz not null default now(),
 check((sharing='method' and company_id is null and client_id is null) or (sharing='client' and company_id is not null)),
 check(not active or reviewed_at is not null),
 foreign key(company_id,client_id) references public.workspace_clients(company_id,id)
);
alter table public.planning_reference_cases enable row level security;
revoke all on public.planning_reference_cases from anon,authenticated;
grant select,insert,update,delete on public.planning_reference_cases to service_role;
create index if not exists planning_reference_cases_scope on public.planning_reference_cases(company_id,client_id) where active;
