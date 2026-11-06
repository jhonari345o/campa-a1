-- =====================================================================
--  Migracion 0002 — Los miembros de una empresa pueden ver a su equipo
--
--  Por defecto, profiles solo deja leer el propio perfil (o al platform
--  admin). Para mostrar el equipo en el panel del cliente, permitimos leer
--  el perfil de quienes comparten al menos una empresa contigo. El
--  aislamiento entre empresas distintas se mantiene.
--
--  Aplicar en Supabase -> SQL Editor -> Run. Es seguro re-ejecutarlo.
-- =====================================================================

-- Evita recursion de RLS: consulta company_members con security definer.
create or replace function public.shares_company_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members me
    join public.company_members other on other.company_id = me.company_id
    where me.user_id = auth.uid()
      and other.user_id = p_user
  );
$$;

drop policy if exists profiles_comember_read on public.profiles;
create policy profiles_comember_read on public.profiles
  for select using (public.shares_company_with(id));
