alter table public.posts
  add column if not exists opportunity_title text,
  add column if not exists opportunity_role text,
  add column if not exists opportunity_skills text[] not null default '{}',
  add column if not exists opportunity_commitment text,
  add column if not exists opportunity_work_mode text,
  add column if not exists opportunity_location text,
  add column if not exists opportunity_compensation text,
  add column if not exists opportunity_status text;

update public.posts
set opportunity_status = 'open',
    opportunity_commitment = coalesce(opportunity_commitment, 'flexible')
where post_kind = 'opportunity'
  and opportunity_status is null;

alter table public.posts
  drop constraint if exists posts_collab_details_check,
  drop constraint if exists posts_collab_status_check,
  drop constraint if exists posts_collab_fields_check;

alter table public.posts
  add constraint posts_collab_details_check
    check (
      (opportunity_title is null or char_length(opportunity_title) between 1 and 120)
      and (opportunity_role is null or char_length(opportunity_role) <= 100)
      and cardinality(opportunity_skills) <= 8
      and (opportunity_commitment is null or opportunity_commitment in ('flexible', 'project', 'part_time', 'full_time'))
      and (opportunity_work_mode is null or opportunity_work_mode in ('remote', 'hybrid', 'in_person', 'flexible'))
      and (opportunity_location is null or char_length(opportunity_location) <= 120)
      and (opportunity_compensation is null or char_length(opportunity_compensation) <= 160)
    ),
  add constraint posts_collab_status_check
    check (opportunity_status is null or opportunity_status in ('open', 'paused', 'filled')),
  add constraint posts_collab_fields_check
    check (
      (
        post_kind = 'post'
        and opportunity_title is null
        and opportunity_role is null
        and cardinality(opportunity_skills) = 0
        and opportunity_commitment is null
        and opportunity_work_mode is null
        and opportunity_location is null
        and opportunity_compensation is null
        and opportunity_status is null
      )
      or (
        post_kind = 'opportunity'
        and opportunity_status is not null
      )
    );

grant insert (
  opportunity_title,
  opportunity_role,
  opportunity_skills,
  opportunity_commitment,
  opportunity_work_mode,
  opportunity_location,
  opportunity_compensation,
  opportunity_status
) on public.posts to authenticated;
grant update (opportunity_status) on public.posts to authenticated;

drop policy if exists "Authors can manage their opportunity status" on public.posts;
create policy "Authors can manage their opportunity status"
on public.posts
for update
to authenticated
using (
  (select auth.uid()) = author_id
  and post_kind = 'opportunity'
  and deleted_at is null
)
with check (
  (select auth.uid()) = author_id
  and post_kind = 'opportunity'
  and deleted_at is null
  and opportunity_status in ('open', 'paused', 'filled')
);

create table if not exists public.collab_interests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  introduction text not null check (char_length(btrim(introduction)) between 10 and 800),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collab_interests_post_applicant_key unique (post_id, applicant_id)
);

create index if not exists collab_interests_applicant_created_idx
  on public.collab_interests (applicant_id, created_at desc);

create index if not exists collab_interests_post_created_idx
  on public.collab_interests (post_id, created_at desc);

alter table public.collab_interests enable row level security;
revoke all on table public.collab_interests from public, anon, authenticated;
grant select, insert on table public.collab_interests to authenticated;
grant update (status) on table public.collab_interests to authenticated;

drop policy if exists "Applicants and opportunity owners can read interests" on public.collab_interests;
create policy "Applicants and opportunity owners can read interests"
on public.collab_interests
for select
to authenticated
using (
  applicant_id = (select auth.uid())
  or exists (
    select 1
    from public.posts
    where posts.id = collab_interests.post_id
      and posts.author_id = (select auth.uid())
  )
);

drop policy if exists "Users can express interest in open opportunities" on public.collab_interests;
create policy "Users can express interest in open opportunities"
on public.collab_interests
for insert
to authenticated
with check (
  applicant_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1
    from public.posts
    where posts.id = collab_interests.post_id
      and posts.post_kind = 'opportunity'
      and posts.opportunity_status = 'open'
      and posts.deleted_at is null
      and posts.author_id <> (select auth.uid())
  )
);

drop policy if exists "Opportunity owners can respond to interests" on public.collab_interests;
create policy "Opportunity owners can respond to interests"
on public.collab_interests
for update
to authenticated
using (
  status = 'pending'
  and exists (
    select 1
    from public.posts
    where posts.id = collab_interests.post_id
      and posts.author_id = (select auth.uid())
      and posts.post_kind = 'opportunity'
  )
)
with check (
  status in ('accepted', 'declined')
  and exists (
    select 1
    from public.posts
    where posts.id = collab_interests.post_id
      and posts.author_id = (select auth.uid())
      and posts.post_kind = 'opportunity'
  )
);