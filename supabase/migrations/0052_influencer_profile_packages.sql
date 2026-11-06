begin;
alter table public.influencer_profiles drop constraint if exists influencer_profiles_category_check;
alter table public.influencer_profiles add constraint influencer_profiles_category_check
 check(category in ('deportes','foodie','beauty','general'));
-- Package prices remain in the existing tenant/client agreements, not in the global profile.
alter table public.workspace_catalog_products add column if not exists influencer_profile_id uuid
 references public.influencer_profiles(id);
create index if not exists workspace_catalog_influencer on public.workspace_catalog_products(influencer_profile_id)
 where influencer_profile_id is not null;
commit;
