# Supabase database

The app uses the Supabase project configured in `.vscode/mcp.json` for Postgres and Auth. The remote schema contains `profiles` and `posts`, both protected with row-level security.

The local `.env.local` contains the Supabase project URL and publishable key. The key is intended for client applications; database access is restricted by explicit grants and RLS policies. Do not put a Supabase secret or service-role key in a `NEXT_PUBLIC_` variable.

The schema migration was applied to the connected Supabase project through MCP. Database types live in `src/lib/database.types.ts` and should be regenerated after schema changes.

The `authenticated` role has `UPDATE` permission on `public.profiles`; the `Users update their own profile` RLS policy still limits updates to the signed-in user's own row.

Profile photos use the public `avatars` Storage bucket. Authenticated uploads are limited to each user's own folder and to JPEG, PNG, or WebP images up to 5 MB. The profile's `avatar_url` stores the public URL used by the profile page and top bar.

Start the app with:

```bash
npm run dev
```
