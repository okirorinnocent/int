# InternLog

Mobile-first internship, placement and assessment platform for Mbarara University of Science and Technology (MUST). The application uses TanStack Start, React, TypeScript, Tailwind CSS and Supabase.

## Phase 1 status

The foundation includes the TanStack Start application shell, landing and authentication screens, Zod validation, Supabase browser client, cookie consent interface, initial database schema, RLS policies, private storage buckets and basic project documentation. Later phases add opportunity workflows, placements, monitoring, grading, communications, recommendations and PWA synchronization.

## Requirements

- Node.js 22 or newer and npm
- A Supabase project
- A university email domain configured in Supabase Auth (MUST email domains should be confirmed with the institution)

## Supabase setup

1. Create a Supabase project and open **SQL Editor**.
2. Run `supabase/schema.sql` in its entirety. It creates the MUST institution record, core tables, indexes, triggers, RLS policies, private buckets and default grade weights.
3. Configure **Authentication → URL Configuration** with your local and production callback URLs.
4. Configure email confirmation and SMTP before enabling real signups. Do not disable email confirmation in production.
5. Review every RLS policy against your institution's actual workflow before loading real student data.
6. Optional development setup: create and email-confirm `demo.admin@must.ac.ug`, `demo.student@must.ac.ug`, `demo.employer@must.ac.ug`, `demo.workplace@must.ac.ug` and `demo.academic@must.ac.ug` through Supabase Auth, set their passwords in the dashboard, then rerun `supabase/seed.sql`. The seed links those identities to demonstration employer, opportunity, placement, supervisor, logbook and grade records. It deliberately does not create privileged Auth identities or plaintext-password accounts.

### Creating the first administrator

1. Create the intended administrator identity through Supabase Auth and verify its email.
2. Copy that Auth user's UUID from **Authentication → Users**.
3. In SQL Editor, verify the UUID and run:

```sql
update public.profiles
set role = 'admin', status = 'active', approved_at = now()
where id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
```

Do this only for a trusted, verified account. Never expose the service-role key in a browser. The public signup flow always creates a pending student profile; it records the requested role separately and does not accept a role supplied by the browser as authority. The signup trigger also enforces the `allowed_email_domains` setting in Postgres; update that setting after MUST IT confirms the official domains.

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: publishable/anon key (safe for browser use when RLS is correct)
- `VITE_ALLOWED_EMAIL_DOMAINS`: comma-separated university email domains; defaults to `must.ac.ug` and should be confirmed with MUST IT
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for trusted server operations; never prefix with `VITE_`
- `RESEND_API_KEY`: server-only email delivery key
- `APP_BASE_URL`: canonical app origin

Never commit `.env` or service credentials.

## Local run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

## Vercel deployment

1. Push the repository to a private or public Git provider.
2. Import it into Vercel.
3. Add the environment variables above to the appropriate deployment environments.
4. Set the production Supabase Auth Site URL and redirect URLs to your Vercel domain.
5. Deploy and verify signup, email confirmation, login and RLS with separate test accounts for each role.

## Demo accounts

No fixed demo passwords are included. The optional seed expects the five demo identities listed above to be created and email-confirmed through Supabase Auth. The seed assigns demo roles and inserts sample data; change all demo passwords and remove demo records before production.

## Locale and accessibility

The product defaults to English, UGX and `Africa/Kampala`. Layouts start at phone widths, interactive elements have visible keyboard focus, and form controls have labels. Cookie consent offers Accept all, Reject non-essential and Customise. Consent receipts are recorded in `cookie_consents`; users can withdraw by clearing the `internlog_consent_v1` cookie and choosing again (a dedicated preference center is planned in the cross-cutting polish phase).

## Privacy and security notes

The schema applies RLS to every application table and keeps document/avatars buckets private. Storage object paths must begin with the authenticated user's UUID. Server code must validate file content, size and ownership before issuing signed URLs. IP addresses are not stored; `ip_hash` is reserved for a server-generated one-way hash. Review the Uganda Data Protection and Privacy Act 2019 and institutional policies with qualified counsel before production launch. This starter is technical implementation, not legal advice.

## Current limitations

This is Phase 1. The cookie consent receipt insert is client initiated and records user-agent only; IP hashing must be added server-side. The current schema provides foundational tables and policies, not every final workflow or exhaustive policy test. Do not onboard real users until the remaining phases, SQL review, security testing and institutional approval are complete.
