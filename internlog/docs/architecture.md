# Architecture

## Application layers

- **TanStack Start / React:** route rendering and role-aware user experience. Client role checks are presentation only.
- **Feature modules:** auth, profiles and subsequent domain workflows.
- **Zod:** shared input schemas; all mutations must be validated again on the server.
- **Supabase Auth:** identity and verified email lifecycle.
- **Postgres + RLS:** authoritative authorization boundary. A browser cannot promote its own role or account status.
- **Supabase Storage:** private document and avatar buckets; use short-lived signed URLs after server authorization.
- **Vercel:** hosting and server-side execution. Secrets stay in server environment variables.

## Trust boundaries

1. Browser input is untrusted, including requested roles and uploaded filenames.
2. `profiles.role` and `profiles.status` are authoritative and should be changed only by approved administrative workflows.
3. Service-role credentials bypass RLS and must never enter client bundles.
4. Sensitive reports, grades, messages and documents must be filtered by database policy, not only by UI.
5. Audit entries should be emitted by trusted server/database operations and should not be client-editable.

## Locale

Default timezone: `Africa/Kampala`; currency: `UGX`; language: English.

## Database views

The initial schema includes security-invoker views for a placement overview and institution account counts. These views rely on the underlying table RLS policies; do not replace them with definer views or expose service-role credentials to the browser.
