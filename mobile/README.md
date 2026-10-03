# Buildup Mobile

Flutter client for the existing Buildup Supabase project. It uses the current
database and storage bucket directly; this app does not require database
migrations.

## Configure Supabase

Use the project URL and its **publishable key** (or legacy anon key). Never use
the service-role key in a mobile app.

This project's Supabase allowlist has been configured with the mobile redirect
URL:

```text
buildup://login-callback
```

The Google provider is enabled for this Supabase project. Email confirmation
and password-recovery links use the mobile redirect above. Post images and
profile photos use the existing public `avatars` storage bucket and its
current storage policies.

## Run on Android

From the repository root, pass configuration privately at launch:

```sh
cd mobile
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

To build a debug APK:

```sh
flutter build apk --debug \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Do not put real project values in source control. Configure CI secrets as
`--dart-define` values for release builds.

## iOS

The iOS runner and `buildup://login-callback` URL scheme are configured, but an
iOS build, simulator run, and signing require macOS with Xcode installed.

## App coverage

The app includes email/password signup and login, Google OAuth, password reset,
feed and opportunity publishing, feed reactions and threaded comments, creator
profiles and projects, search, interest-based creator recommendations,
collaboration applications and owner responses, direct messages with read
receipts, notifications, blocking, and unblock management. Feed, inbox,
notification, and unread-badge views refresh automatically while open.

The configured Android debug APK is at
`build/app/outputs/flutter-apk/app-debug.apk`. The Flutter tests cover model
parsing and the unconfigured startup screen. A live end-to-end run additionally
requires signing in on a device with a valid user account.
