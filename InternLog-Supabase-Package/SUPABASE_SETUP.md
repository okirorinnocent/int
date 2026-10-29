# InternLog + Supabase setup

This bundle includes the InternLog application, a full SQL schema for a **new Supabase project**, and hardening migrations for an existing compatible database.

## Choose the correct path

### A. Brand-new Supabase project

1. Create a Supabase project and open **SQL Editor → New query**.
2. Open `02_schema.sql` from this project, copy the complete contents into the editor, and run it.
3. Review the result for errors. The schema is designed for a fresh database and may not be suitable for a database with existing InternLog tables or custom policies.
4. In Supabase **Project Settings → API**, copy the Project URL and the **publishable/anon key**.
5. Put those values into your local environment file using the variable names shown in `.env.example` / `env.example`. Never put a service-role or secret key in frontend environment variables or commit it to Git.
6. Configure Supabase Auth email confirmation, password policy, redirect URLs, and allowed site URLs for your actual development/production domains.
7. Test using separate student and supervisor accounts before using real student data.

### B. Existing Supabase database

1. Back up the database first.
2. Read `SECURITY_HARDENING.md` and inspect the current schema, enums, triggers, and RLS policies.
3. Do **not** run `02_schema.sql` or `01_reset_optional.sql` blindly against a live database. `01_reset_optional.sql` is destructive/optional.
4. If the database already has the expected InternLog schema, review and apply `supabase/migrations/202610290001_student_only_self_registration.sql` and then `supabase/migrations/202610290002_integrity_session_id_or.sql` in the Supabase SQL Editor. These migrations are not universal; confirm their assumptions match your deployed schema first.
5. Verify that ordinary users cannot update `profiles.role` or `profiles.status`, and that all sensitive tables have RLS enabled and correct policies.

## Important production limitation

The UI still contains local/demo store behavior for some flows. A SQL schema does not automatically connect every screen to the database. Before production, replace local/demo CRUD with authenticated Supabase queries and verify every operation against RLS. Treat database policies and server-side checks as the security boundary—not client-side route guards or form validation.

## Minimum verification checklist

- Student can only read/update their own permitted profile fields and logbook entries.
- Student cannot set their own role/status or approve their own entries.
- A supervisor can review only entries assigned to them.
- Guessed/changed UUIDs do not expose another user's data (IDOR tests).
- Only approved logbook entries contribute to verified-hour totals.
- Public frontend contains only the publishable/anon key; no service-role key or database password.
- Auth redirects and email confirmation work on the deployed domain.

Never share passwords, access tokens, service-role keys, or real student records when asking for help.
