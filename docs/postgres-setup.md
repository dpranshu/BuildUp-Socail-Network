# Supabase database

The app uses the Supabase project configured in `.vscode/mcp.json` for Postgres and Auth. The remote schema contains `profiles` and `posts`, both protected with row-level security.

The local `.env.local` contains the Supabase project URL and publishable key. The key is intended for client applications; database access is restricted by explicit grants and RLS policies. Do not put a Supabase secret or service-role key in a `NEXT_PUBLIC_` variable.

The schema migration was applied to the connected Supabase project through MCP. Database types live in `src/lib/database.types.ts` and should be regenerated after schema changes. Authenticated post creation requires column-level `INSERT` privileges for the post fields the API writes, in addition to the `Users create posts as themselves` RLS policy; [`grant_post_insert.sql`](../supabase/migrations/20261002155441_grant_post_insert.sql) configures the narrow grant without allowing clients to set counts or deletion state.

Post interactions require RLS policies on `likes`, `comments`, and `reposts`. Apply [`repost-thoughts.sql`](./repost-thoughts.sql) in the Supabase SQL Editor to enable public reads, allow signed-in users to like, comment on, and repost any visible post, and restrict write actions to the signed-in user. Reposts also store optional thoughts in `public.reposts.thoughts`.

The `authenticated` role has `UPDATE` permission on `public.profiles`; the `Users update their own profile` RLS policy still limits updates to the signed-in user's own row.

Profile photos and uploaded post images use the public `avatars` Storage bucket. Authenticated uploads are limited to each user's own folder. Profile-photo uploads remain limited to 5 MB. Post photos are cropped in the browser and shown immediately in the feed; final compression starts when the user publishes, producing a square JPEG no larger than 1.75 MiB before upload. The image then uploads in the background while the feed shows progress; failed uploads can be retried without duplicating the post. The API rejects prepared post images above 2 MiB. Users can start with larger phone photos, including HEIC/HEIF, without storing the originals. Post images are stored under `<user-id>/posts/`; uploaded image URLs are saved in `posts.media_urls`, while the profile's `avatar_url` stores the URL used by the profile page and top bar. The `posts_body_check` constraint allows an empty body only when the post has media, so image-only and video-only posts remain valid while empty text-only posts are rejected.

Post moderation uses `post_reports`, `user_blocks`, and `hidden_posts`. All three tables have RLS enabled; users can create and view only their own blocks and hidden posts, and can submit reports tied to their own user ID. Signed-in users can review and unblock accounts from **Profile > Settings > Blocked users**. The `user_blocks` table also needs a delete policy allowing a user to delete only rows where `blocker_id = auth.uid()`; if that policy is not already present, apply this in the Supabase SQL Editor:

```sql
create policy "Users can unblock their own users"
on public.user_blocks
for delete
to authenticated
using ((select auth.uid()) = blocker_id);
```

The feed excludes posts from blocked authors and posts marked not interested.

Post deletion is a soft delete: the author's `deleted_at` timestamp is set, other users and all app feed, profile, and search queries hide the post, and its row and related records remain in the database. Authenticated clients have no physical `DELETE` permission on `public.posts`. Apply the migrations in [`supabase/migrations/`](../supabase/migrations/) to grant authenticated users update access only to `deleted_at` and restrict the policy to their own currently-visible posts. The SELECT policy permits an author to read their own soft-deleted row through the Data API because PostgreSQL requires the updated row to remain visible to the updater; app queries still explicitly filter `deleted_at` to `null`. If not using Supabase CLI migrations, run this SQL in the Supabase SQL Editor:

```sql
revoke update on table public.posts from public, anon, authenticated;
grant update (deleted_at) on table public.posts to authenticated;

drop policy if exists "Authors can soft delete their posts" on public.posts;
create policy "Authors can soft delete their posts"
on public.posts
for update
to authenticated
using ((select auth.uid()) = author_id and deleted_at is null)
with check ((select auth.uid()) = author_id and deleted_at is not null);

drop policy if exists "Posts are publicly readable" on public.posts;
create policy "Posts are publicly readable"
on public.posts
for select
to anon, authenticated
using (deleted_at is null or (select auth.uid()) = author_id);
```

The delete API verifies the post is no longer visible in app queries and avoids `RETURNING`.

## Database schema backup

The app-facing table shapes and relationships are tracked in [`src/lib/database.types.ts`](../src/lib/database.types.ts), while schema changes made for post hiding are tracked as migrations in [`supabase/migrations/`](../supabase/migrations/). These files preserve the application schema contract and incremental changes in source control, but they are not a complete restorable dump of the live database.

To create a schema-only snapshot from the live project after linking the Supabase CLI and authenticating with database access, run:

```sh
supabase db dump --linked --schema public --file supabase/schema.sql
```

This snapshots the `public` schema, not user rows, Auth users, or Storage objects. The Supabase dashboard currently reports that this project's Free plan does not include scheduled project backups. Use the dashboard's database backup/PITR options on a plan that supports them, or create a separately secured data backup if recovery of user data is required. Never commit database passwords, access tokens, or user data backups to this repository.

Feed loading uses keyset pagination: six posts on initial load and up to ten more near the bottom of the feed. Profile posts load before the overview and projects data. Post images are lazy-loaded and videos are not fetched until playback. For large datasets, check the existing indexes and use `EXPLAIN (ANALYZE, BUFFERS)` before adding indexes; likely candidates for this query shape are `posts(created_at, id)` for visible posts, `posts(author_id, created_at, id)` for profile timelines, and owner-leading indexes on `follows`, `user_blocks`, and `hidden_posts`. Avoid duplicate indexes and apply any needed indexes through a reviewed migration.

Start the app with:

```bash
npm run dev
```
