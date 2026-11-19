-- Permite que miembros autorizados de la misma empresa revisen planes y versiones.

begin;

drop policy if exists media_plans_owner_read on public.media_plans;
create policy media_plans_owner_read on public.media_plans
  for select to authenticated using (
    owner_id = auth.uid()
    or public.is_platform_admin()
    or (company_id is not null and public.is_company_member(company_id))
  );

drop policy if exists media_plan_versions_owner_read on public.media_plan_versions;
create policy media_plan_versions_owner_read on public.media_plan_versions
  for select to authenticated using (
    public.is_platform_admin()
    or exists (
      select 1 from public.media_plans plan
      where plan.id = media_plan_versions.plan_id
        and (
          plan.owner_id = auth.uid()
          or (plan.company_id is not null and public.is_company_member(plan.company_id))
        )
    )
  );

commit;
