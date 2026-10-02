alter table public.posts
drop constraint if exists posts_body_check;

alter table public.posts
add constraint posts_body_check
check (
  body is not null
  and char_length(body) <= 5000
  and (
    char_length(body) >= 1
    or coalesce(cardinality(media_urls), 0) > 0
  )
);