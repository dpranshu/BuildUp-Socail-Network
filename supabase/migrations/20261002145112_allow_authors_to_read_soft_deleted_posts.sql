drop policy if exists "Posts are publicly readable" on public.posts;
create policy "Posts are publicly readable"
on public.posts
for select
to anon, authenticated
using (deleted_at is null or (select auth.uid()) = author_id);