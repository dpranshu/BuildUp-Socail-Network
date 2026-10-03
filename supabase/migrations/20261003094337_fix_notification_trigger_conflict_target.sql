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
    on conflict on constraint notifications_source_unique do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function private.create_activity_notification() from public, anon, authenticated;