# InternLog access-screen redesign and security notes

## UX changes

- The `/access` page is rendered outside the app shell. The desktop sidebar and mobile bottom navigation are not shown on the public access screen.
- Unauthenticated visits to internal routes are redirected to `/access`. Supabase session restoration is awaited before the guard decides whether to redirect.
- Student self-registration is the only option on the public form. The role selector was removed; the app no longer exposes a role switcher in the workspace shell.
- Password guidance now lists five requirements (12+ characters, upper/lowercase, number, special character) and provides a strength indicator, show/hide control, and inline feedback.
- Sign-in includes password recovery. The recovery email returns to `/access?recovery=1`, where the user can set and confirm a new password.
- Demo access is a separate card outside the registration form. Demo mode must only expose synthetic/sample data and student-level capabilities.
- Registration and sign-in fail closed when Supabase Auth is not configured. The previous local-only authentication path stored passwords in browser storage and has been removed. Legacy local user records are cleared when Supabase is not configured.

## Database hardening

1. Apply `migrations/2026-10-29-student-only-self-registration.sql` in the Supabase SQL Editor after reviewing it against your deployed schema.
2. The `handle_new_user()` trigger now ignores `raw_user_meta_data.role` and always creates a student profile. Never use client-controlled metadata as an authorization source.
3. Keep role and account-status changes behind a server-authorized, audited invitation/approval workflow. Do not add an RLS policy that allows a user to update their own `profiles.role` or `profiles.status`.
4. Verify Row Level Security is enabled for all private tables, and test each role using separate accounts. Client-side route guards are a UX boundary, not a security boundary; database RLS and server authorization must enforce access.
5. Configure Supabase Auth email confirmation, password recovery redirect URLs, rate limits, and the allowed application origins in the Supabase dashboard.

## Local setup

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` (see `.env.example`). Then run:

```bash
npm install
npm run dev
```

## Validation status

The ZIP archive integrity check passed. A TypeScript compiler pass was attempted, but full project type-check/build could not be completed because dependencies were unavailable and package installation timed out in this environment. Run `npm run build`, `npm run lint`, and `npm test` after installing dependencies locally. Also manually test sign-up, email confirmation, sign-in, forgot password, password update, sign-out, direct unauthenticated route access, and role-specific RLS policies before deployment.
