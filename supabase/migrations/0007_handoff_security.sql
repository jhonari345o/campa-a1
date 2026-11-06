-- =====================================================================
-- Migracion 0007 — Controles P0 del handoff tecnico (12-08-2026)
-- Aditiva e idempotente. Refuerza permisos, datos restringidos y auditoria.
-- =====================================================================

alter type public.company_role add value if not exists 'approver';

-- La auditoria conserva contexto operativo sin almacenar IP/UA en claro.
alter table public.audit_log
  add column if not exists organization_id uuid,
  add column if not exists actor_role text,
  add column if not exists result text not null default 'success',
  add column if not exists request_id text,
  add column if not exists change_hash text,
  add column if not exists ip_hash text,
  add column if not exists user_agent_hash text;

-- La evidencia conserva los UUID aunque despues se borre el usuario o empresa.
-- No usamos FK con ON DELETE SET NULL porque eso modificaria el log inmutable.
alter table public.audit_log drop constraint if exists audit_log_actor_id_fkey;
alter table public.audit_log drop constraint if exists audit_log_organization_id_fkey;

create index if not exists idx_audit_organization_created
  on public.audit_log (organization_id, created_at desc);
create index if not exists idx_audit_request_id
  on public.audit_log (request_id) where request_id is not null;

create or replace function public.reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

drop trigger if exists trg_audit_log_immutable on public.audit_log;
create trigger trg_audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function public.reject_audit_mutation();

-- Un usuario nunca puede elevar su propio privilegio ni cambiar su correo
-- espejo. La administracion con service_role conserva esa capacidad.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role')
     and coalesce(auth.role(), '') <> 'service_role' then
    new.is_platform_admin := old.is_platform_admin;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privileges on public.profiles;
create trigger trg_guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Solo administradores y planificadores de una empresa activa pueden crear
-- solicitudes de campana para esa empresa.
create or replace function public.can_create_campaign(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members membership
    join public.companies company on company.id = membership.company_id
    where membership.user_id = auth.uid()
      and membership.company_id = p_company
      and membership.role::text in ('admin', 'planner')
      and company.status::text = 'activa'
  );
$$;

drop policy if exists jobs_insert on public.campaign_jobs;
create policy jobs_insert on public.campaign_jobs
  for insert with check (
    public.can_create_campaign(company_id)
    and created_by = auth.uid()
  );

-- Defensa en profundidad: los datasets y la base de conocimiento permanecen
-- solo para platform admins o service_role. El cliente recibe derivados.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'data_sources', 'advertisers', 'media_channels', 'ad_investments',
    'digital_metrics', 'ad_investments_monthly'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists %I_read on public.%I', table_name, table_name);
      if table_name = 'ad_investments_monthly' then
        execute 'drop policy if exists inv_monthly_read on public.ad_investments_monthly';
        execute 'create policy inv_monthly_read on public.ad_investments_monthly for select using (public.is_platform_admin())';
      else
        execute format(
          'create policy %I_read on public.%I for select using (public.is_platform_admin())',
          table_name,
          table_name
        );
      end if;
    end if;
  end loop;
end $$;
