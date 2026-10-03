create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'like',
      'follow',
      'comment',
      'repost',
      'collab_interest',
      'collab_accepted',
      'collab_declined',
      'message'
    )
  ),
  source_id uuid not null,
  post_id uuid references public.posts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete cascade,
  interest_id uuid references public.collab_interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_not_self check (recipient_id <> actor_id),
  constraint notifications_source_unique unique (notification_type, source_id)
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc, id desc);
create index notifications_unread_recipient_idx
  on public.notifications (recipient_id)
  where read_at is null;
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_post_idx on public.notifications (post_id) where post_id is not null;
create index notifications_conversation_idx on public.notifications (conversation_id) where conversation_id is not null;
create index notifications_interest_idx on public.notifications (interest_id) where interest_id is not null;

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Users can read their own notifications"
  on public.notifications
  for select
  to authenticated
  using ((select auth.uid()) = recipient_id);

create policy "Users can mark their own notifications read"
  on public.notifications
  for update
  to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_reads_user_idx
  on public.conversation_reads (user_id, conversation_id);

insert into public.conversation_reads (conversation_id, user_id, last_read_at)
select conversations.id, participant.user_id, now()
from public.conversations
cross join lateral (
  values (conversations.participant_one), (conversations.participant_two)
) as participant(user_id)
on conflict (conversation_id, user_id) do nothing;

alter table public.conversation_reads enable row level security;
revoke all on public.conversation_reads from public, anon, authenticated;
grant select on public.conversation_reads to authenticated;
grant insert (conversation_id, user_id, last_read_at) on public.conversation_reads to authenticated;
grant update (last_read_at) on public.conversation_reads to authenticated;

create policy "Users can read their own conversation receipts"
  on public.conversation_reads
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations
      where conversations.id = conversation_reads.conversation_id
    )
  );

create policy "Users can create their own conversation receipts"
  on public.conversation_reads
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations
      where conversations.id = conversation_reads.conversation_id
    )
  );

create policy "Users can update their own conversation receipts"
  on public.conversation_reads
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations
      where conversations.id = conversation_reads.conversation_id
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations
      where conversations.id = conversation_reads.conversation_id
    )
  );

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.create_activity_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_recipient uuid;
  notification_actor uuid;
  notification_type text;
  notification_post uuid;
  notification_conversation uuid;
  notification_interest uuid;
  notification_source uuid;
  row_data jsonb;
begin
  row_data := to_jsonb(new);
  notification_source := (row_data ->> 'id')::uuid;

  if tg_table_name = 'follows' then
    notification_recipient := (row_data ->> 'following_id')::uuid;
    notification_actor := (row_data ->> 'follower_id')::uuid;
    notification_type := 'follow';
  elsif tg_table_name = 'messages' then
    notification_actor := (row_data ->> 'sender_id')::uuid;
    notification_conversation := (row_data ->> 'conversation_id')::uuid;
    notification_type := 'message';
    select case
      when conversations.participant_one = notification_actor then conversations.participant_two
      else conversations.participant_one
    end
    into notification_recipient
    from public.conversations
    where conversations.id = notification_conversation;
  elsif tg_table_name = 'collab_interests' then
    notification_actor := (row_data ->> 'applicant_id')::uuid;
    notification_post := (row_data ->> 'post_id')::uuid;
    notification_interest := notification_source;
    notification_type := 'collab_interest';
    select posts.author_id
    into notification_recipient
    from public.posts
    where posts.id = notification_post;
  else
    notification_actor := case
      when tg_table_name = 'comments' then (row_data ->> 'author_id')::uuid
      else (row_data ->> 'user_id')::uuid
    end;
    notification_post := (row_data ->> 'post_id')::uuid;
    notification_type := case
      when tg_table_name = 'likes' then 'like'
      when tg_table_name = 'comments' then 'comment'
      else 'repost'
    end;
    select posts.author_id
    into notification_recipient
    from public.posts
    where posts.id = notification_post;
  end if;

  if notification_recipient is not null
    and notification_actor is not null
    and notification_recipient <> notification_actor
    and notification_actor = (select auth.uid()) then
    insert into public.notifications (
      recipient_id,
      actor_id,
      notification_type,
      source_id,
      post_id,
      conversation_id,
      interest_id
    )
    values (
      notification_recipient,
      notification_actor,
      notification_type,
      notification_source,
      notification_post,
      notification_conversation,
      notification_interest
    )
    on conflict (notification_type, source_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function private.create_collab_response_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  opportunity_owner uuid;
begin
  if old.status = 'pending' and new.status in ('accepted', 'declined') then
    select posts.author_id
    into opportunity_owner
    from public.posts
    where posts.id = new.post_id;

    if opportunity_owner is not null
      and opportunity_owner <> new.applicant_id
      and opportunity_owner = (select auth.uid()) then
      insert into public.notifications (
        recipient_id,
        actor_id,
        notification_type,
        source_id,
        post_id,
        interest_id
      )
      values (
        new.applicant_id,
        opportunity_owner,
        case when new.status = 'accepted' then 'collab_accepted' else 'collab_declined' end,
        new.id,
        new.post_id,
        new.id
      )
      on conflict (notification_type, source_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.create_activity_notification() from public, anon, authenticated;
revoke execute on function private.create_collab_response_notification() from public, anon, authenticated;

create trigger notifications_from_follows
  after insert on public.follows
  for each row execute function private.create_activity_notification();
create trigger notifications_from_likes
  after insert on public.likes
  for each row execute function private.create_activity_notification();
create trigger notifications_from_comments
  after insert on public.comments
  for each row execute function private.create_activity_notification();
create trigger notifications_from_reposts
  after insert on public.reposts
  for each row execute function private.create_activity_notification();
create trigger notifications_from_messages
  after insert on public.messages
  for each row execute function private.create_activity_notification();
create trigger notifications_from_collab_interests
  after insert on public.collab_interests
  for each row execute function private.create_activity_notification();
create trigger notifications_from_collab_responses
  after update of status on public.collab_interests
  for each row execute function private.create_collab_response_notification();

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'The supabase_realtime publication does not exist.';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_reads'
  ) then
    alter publication supabase_realtime add table public.conversation_reads;
  end if;
end
$$;