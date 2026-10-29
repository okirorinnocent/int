# InternLog security and integrity hardening

## What changed in this patch

- `migrations/2026-10-29-integrity-session-id-or.sql` hardens logbook writes in PostgreSQL, replaces the dashboard RPC so official hours and weekly chart values count **approved** entries only, and tightens logbook RLS around ownership/supervision.
- `src/lib/store.tsx` revalidates the active Supabase session against the `profiles` table on auth events and browser focus/visibility, does not restore role from local storage, and provides a route-level `revalidateSession()` function.
- `src/components/AppShell.tsx` asks the store to revalidate the session when navigating to internal routes.
- `src/routes/logbook.tsx` validates date, week, hours and lengths before saving, limits date selection to today or earlier, strips control characters, and relies on React's escaped text rendering rather than HTML injection.
- `src/routes/index.tsx` reads dashboard aggregates through `get_dashboard()` when Supabase is configured and uses approved-only weekly values for the chart.

## Deployment order

1. Back up the Supabase database and review the migration against the currently deployed `public.logbooks` enum and policies.
2. Apply `migrations/2026-10-29-integrity-session-id-or.sql` in the Supabase SQL Editor.
3. Confirm `public.logbook_status` uses `draft`, `submitted`, `approved`, `changes_requested`. This app's UI uses display labels `changes`/`feedback` in its local/demo model; do not persist those display-only strings to the database. Map `changes` to `changes_requested` in a production repository adapter.
4. Verify `profiles.role` and `profiles.status` remain non-updatable by ordinary clients. Role assignment must go through a server-authorized invitation/approval function.
5. Test as a student, assigned workplace supervisor, assigned academic supervisor, unrelated supervisor, and administrator. Test with guessed UUIDs for each resource type.
6. Confirm Supabase Auth refresh-token rotation and session lifetime settings in the Supabase project. The SDK handles token refresh; server-side RLS and role/status lookups remain authoritative.

## Important architecture note

This codebase still contains a local/demo logbook store (`upsert`, `remove`, seeded entries) for the UI. A production release must replace those methods with Supabase CRUD calls and treat returned database rows as authoritative. Do not mistake client-side validation or navigation guards for authorization. RLS and database triggers are the actual security boundary. The dashboard uses server RPC aggregates when Supabase is configured, but other visible activity widgets still need to be migrated to server-returned rows before production.

## Validation rules

- One entry per student per date (the existing database unique constraint).
- Entry date must not be in the future.
- Hours must be `> 0` and `<= 16` per calendar date.
- Week number, when present, is an integer from 1 to 60.
- Task text: 1–4,000 characters; skills: up to 500; supervisor comment: up to 2,000.
- Drafts and submitted entries do not count as verified hours. Only `approved` rows contribute to progress and weekly approved-hour charts.
- Student edits are limited to draft/changes-requested rows; students cannot sign their own entries.
- Supervisor review requires the supervisor relationship and a submitted entry.

## XSS handling

Text is stored as plain text, with ASCII control characters removed. React text nodes escape HTML automatically. Never render task/comment strings with `dangerouslySetInnerHTML`; if rich text is introduced later, use a maintained HTML sanitizer with a strict allowlist.

## IDOR handling

UUIDs are identifiers, not permissions. Every read/write endpoint must query through the authenticated Supabase client and rely on RLS. Never use the service-role key in browser code. For any future server endpoint, derive the caller from the validated JWT and check ownership/assigned-supervisor/admin rights server-side before returning or mutating a row.
