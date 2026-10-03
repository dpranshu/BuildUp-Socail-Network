alter table public.comments
  add column if not exists parent_comment_id uuid references public.comments(id) on delete set null;

create index if not exists comments_parent_comment_id_idx
  on public.comments (parent_comment_id)
  where parent_comment_id is not null;

grant select (parent_comment_id) on public.comments to anon, authenticated;
grant insert (parent_comment_id) on public.comments to authenticated;