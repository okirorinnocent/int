# Supabase SQL files

- `../02_schema.sql`: full schema for a **new** compatible Supabase project; run through Supabase SQL Editor after reviewing.
- `migrations/202610290001_student_only_self_registration.sql`: hardens self-registration so client-provided metadata cannot grant privileged roles.
- `migrations/202610290002_integrity_session_id_or.sql`: integrity/RLS/dashboard hardening for an existing compatible schema.

For setup and deployment order, read `../SUPABASE_SETUP.md` and `../SECURITY_HARDENING.md`. Do not apply the full schema and existing-database migrations indiscriminately to a live database. Back up and inspect the current schema first.
