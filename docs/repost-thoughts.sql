alter table public.reposts
  add column if not exists thoughts text not null default '';

alter table public.reposts
  drop constraint if exists reposts_thoughts_length_check;

alter table public.reposts
  add constraint reposts_thoughts_length_check check (char_length(thoughts) <= 500);

alter table public.reposts enable row level security;

grant select on public.reposts to anon, authenticated;
grant insert, delete on public.reposts to authenticated;

drop policy if exists "Anyone can view reposts" on public.reposts;

create policy "Anyone can view reposts"
  on public.reposts
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can create their own reposts" on public.reposts;

create policy "Users can create their own reposts"
  on public.reposts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own reposts" on public.reposts;

create policy "Users can delete their own reposts"
  on public.reposts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.likes to anon, authenticated;
grant insert, delete on public.likes to authenticated;

drop policy if exists "Anyone can view likes" on public.likes;

create policy "Anyone can view likes"
  on public.likes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can create their own likes" on public.likes;

create policy "Users can create their own likes"
  on public.likes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own likes" on public.likes;

create policy "Users can delete their own likes"
  on public.likes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.comments to anon, authenticated;
grant insert on public.comments to authenticated;

drop policy if exists "Anyone can view comments" on public.comments;

create policy "Anyone can view comments"
  on public.comments
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can create their own comments" on public.comments;

create policy "Users can create their own comments"
  on public.comments
  for insert
  to authenticated
  with check ((select auth.uid()) = author_id);
