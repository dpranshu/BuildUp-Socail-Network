create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_one uuid not null references public.profiles(id) on delete cascade,
  participant_two uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint conversations_distinct_participants check (participant_one <> participant_two),
  constraint conversations_canonical_participants check (participant_one < participant_two),
  constraint conversations_unique_pair unique (participant_one, participant_two)
);

create index if not exists conversations_participant_one_created_idx
  on public.conversations (participant_one, created_at desc);
create index if not exists conversations_participant_two_created_idx
  on public.conversations (participant_two, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_length check (char_length(btrim(body)) between 1 and 4000)
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc, id desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Conversation participants can read their conversations" on public.conversations;
create policy "Conversation participants can read their conversations"
  on public.conversations
  for select
  to authenticated
  using (
    (select auth.uid()) = participant_one
    or (select auth.uid()) = participant_two
  );

drop policy if exists "Users can create conversations for themselves" on public.conversations;
create policy "Users can create conversations for themselves"
  on public.conversations
  for insert
  to authenticated
  with check (
    participant_one <> participant_two
    and (
      (select auth.uid()) = participant_one
      or (select auth.uid()) = participant_two
    )
  );

drop policy if exists "Conversation participants can read messages" on public.messages;
create policy "Conversation participants can read messages"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations
      where conversations.id = messages.conversation_id
    )
  );

drop policy if exists "Participants can send messages as themselves" on public.messages;
create policy "Participants can send messages as themselves"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations
      where conversations.id = messages.conversation_id
    )
  );

revoke all on public.conversations from public, anon, authenticated;
revoke all on public.messages from public, anon, authenticated;
grant select on public.conversations to authenticated;
grant insert (participant_one, participant_two) on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;

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
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;