# Buildup

Buildup is a Next.js 16 App Router application backed by Supabase Auth and Postgres. This directory is the application root.

## Run locally

From the repository root in PowerShell:

```powershell
Set-Location .\social-web
npm run dev
```

Open the local URL printed by Next.js, normally `http://localhost:3000`. Do not start a static server or VS Code Live Preview from the parent workspace; it serves files and can show a directory listing instead of the app.

## Supabase email redirects

Signup and password recovery send users through `/auth/callback`. In Supabase Dashboard, under **Authentication > URL Configuration**, add the local app URL to **Redirect URLs** (for example `http://localhost:3000/**`) and add your deployed origin before deploying. The app uses the actual request origin when it asks Supabase to send an email link.

The callback exchanges Supabase PKCE codes or verifies token-hash links and then redirects only to an internal app path. Email confirmation must remain enabled/disabled according to the project’s Auth settings; when confirmation is enabled, the user confirms before signing in.

## Google sign-in setup

The login and signup screens include Google OAuth. To activate the provider:

1. In Google Cloud, create an OAuth client with the **Web application** type.
2. Add this Supabase Auth callback as an authorized redirect URI in Google Cloud:

	`https://uoqamxzoyrolxscmsvor.supabase.co/auth/v1/callback`

3. In Supabase Dashboard, open **Authentication > Sign In / Providers > Google**, enable Google, and enter the Google OAuth client ID and client secret.
4. In **Authentication > URL Configuration > Redirect URLs**, allow the app origins used for local testing. For the usual Next.js port, add `http://localhost:3000/auth/callback` and `http://127.0.0.1:3000/auth/callback`. If using another port, allow that exact origin too (the current verification server is on port `3009`).

The Supabase client secret belongs only in the Supabase Dashboard; do not put it in `.env.local` or any `NEXT_PUBLIC_` variable. Without provider credentials, the app shows a setup explanation instead of silently failing.

## Checks

```powershell
npm run lint
npm run build
```
