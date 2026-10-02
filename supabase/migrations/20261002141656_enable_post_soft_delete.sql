revoke update on table public.posts from public, anon, authenticated;
grant update (deleted_at) on table public.posts to authenticated;

drop policy if exists "Authors can soft delete their posts" on public.posts;
create policy "Authors can soft delete their posts"
on public.posts
for update
to authenticated
using ((select auth.uid()) = author_id and deleted_at is null)
with check ((select auth.uid()) = author_id and deleted_at is not null);