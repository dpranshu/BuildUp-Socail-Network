alter table public.posts
  add column if not exists post_kind text not null default 'post',
  add column if not exists opportunity_kind text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'posts_post_kind_check'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_post_kind_check
        check (post_kind in ('post', 'opportunity'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'posts_opportunity_kind_check'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_opportunity_kind_check
        check (opportunity_kind is null or opportunity_kind in ('cofounder', 'collaborator', 'feedback', 'client', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'posts_kind_consistency_check'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_kind_consistency_check
        check (
          (post_kind = 'post' and opportunity_kind is null)
          or (post_kind = 'opportunity' and opportunity_kind is not null)
        );
  end if;
end
$$;

grant insert (post_kind, opportunity_kind)
  on public.posts
  to authenticated;

create index if not exists posts_opportunities_created_at_idx
  on public.posts (created_at desc, id desc)
  where post_kind = 'opportunity' and deleted_at is null;