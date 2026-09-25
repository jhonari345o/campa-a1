-- Evidencia versionada de términos, privacidad y consentimiento de tratamiento.

begin;

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  treatment_version text not null,
  required_processing boolean not null default true,
  benchmark_contribution boolean not null default false,
  purposes jsonb not null default '[]'::jsonb,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  acceptance_channel text not null default 'web',
  user_agent text,
  constraint legal_acceptances_versions_not_blank check (
    length(trim(terms_version)) > 0
    and length(trim(privacy_version)) > 0
    and length(trim(treatment_version)) > 0
  ),
  constraint legal_acceptances_channel check (acceptance_channel in ('web', 'admin_assisted')),
  unique (user_id, terms_version, privacy_version, treatment_version)
);

create index if not exists legal_acceptances_user_active_idx
  on public.legal_acceptances (user_id, accepted_at desc)
  where revoked_at is null;

alter table public.legal_acceptances enable row level security;

drop policy if exists legal_acceptances_read_own on public.legal_acceptances;
create policy legal_acceptances_read_own on public.legal_acceptances
  for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists legal_acceptances_insert_own on public.legal_acceptances;
create policy legal_acceptances_insert_own on public.legal_acceptances
  for insert to authenticated with check (user_id = auth.uid());

-- La revocación se ejecuta desde una acción de servidor auditada. No se permite
-- editar versiones o finalidades directamente desde el cliente.
revoke update, delete on public.legal_acceptances from authenticated;
grant select, insert on public.legal_acceptances to authenticated;

commit;
