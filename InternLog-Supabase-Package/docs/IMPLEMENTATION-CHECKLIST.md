# InternLog GitHub Implementation Checklist

## Current project alignment

- [x] Existing Supabase schema includes profiles, placements, applications, internships, logbooks, reports, announcements, and rate limits.
- [x] Existing role enum includes student, workplace supervisor, academic supervisor, and admin.
- [x] Existing placement/application state constraints are a good foundation for server-side transitions.
- [ ] Replace client-only role switching with an authenticated, database-backed active-role context.
- [ ] Replace client-only/mock dashboard data with Supabase queries and RLS-protected RPCs.
- [ ] Remove any persistence of application/profile data in localStorage; only keep non-sensitive UI preferences there.

## Authentication and session work

- [ ] Require email verification before activating an account.
- [ ] Add magic-link callback and password reset routes using Supabase Auth.
- [ ] Add pending approval flow for academic/workplace supervisor requests.
- [ ] Implement trusted five-minute idle timeout enforcement in an Edge Function/session layer.
- [ ] Add 4:30 warning and exactly 5:00 sign-out UX.
- [ ] Add login-attempt security events and queued login-alert emails.
- [ ] Add auth endpoint rate limiting by email and IP.

## Authorization and data model

- [ ] Add `roles`, `user_roles`, `institutions`, `institution_memberships`, and `role_requests` migrations.
- [ ] Add `organizations`, `organization_memberships`, and vacancy verification fields.
- [ ] Add `supervisor_assignments`, `documents`, `notifications`, `security_events`, and `audit_logs`.
- [ ] Add institution and assignment checks to every academic supervisor query.
- [ ] Move accept/decline, role approval, assignment, shortlist, and export operations into secure RPCs.
- [ ] Add append-only audit triggers for role, vacancy, application, placement, and document events.

## UI and routing

- [ ] Add role-specific root routes: `/student`, `/workplace`, `/academic`, `/admin`.
- [ ] Add route guards for authentication, verified email, active status, role, institution, and assignment.
- [ ] Ensure role/context switching redirects to the selected context root.
- [ ] Build student opportunity/profile hub with editable sections and optimistic rollback.
- [ ] Build workplace vacancy editor, flyer upload/preview, application queue, shortlist, and secure export.
- [ ] Build academic assigned-student tracking, logbook review, and report review.
- [ ] Keep navigation role-isolated; do not render links for inaccessible views.
- [ ] Use dynamic parsed names for greetings with a safe fallback such as “there”.

## Files and storage

- [ ] Create private Storage buckets for resumes, project evidence, and vacancy flyers.
- [ ] Add MIME/type/size validation and virus scanning before marking documents usable.
- [ ] Generate signed URLs only after an RLS-equivalent ownership or assignment check.
- [ ] Add document verification status and an administrator review queue.

## Verification before merge

- [ ] Run typecheck, lint, and unit tests.
- [ ] Test each route as every role and confirm forbidden routes redirect to that role’s dashboard.
- [ ] Test cross-institution academic supervisor access with two institutions.
- [ ] Test cross-company workplace supervisor access with two organizations.
- [ ] Test draft persistence across logout and idle timeout.
- [ ] Test duplicate application, deadline race, full vacancy, and concurrent acceptance cases.
- [ ] Test private resume/flyer access and signed URL expiry.
- [ ] Test magic link, password reset, recognized device, and login alert flows.
- [ ] Review audit records for role approval, application decision, export, and document access.

## Suggested GitHub commit order

1. `docs: add InternLog platform architecture and security model`
2. `feat: add multi-tenant role and institution migrations`
3. `feat: enforce role-aware route guards`
4. `feat: add student opportunity and profile hub`
5. `feat: add workplace vacancy and application review`
6. `feat: add academic supervision dashboard`
7. `feat: add secure auth alerts and idle session enforcement`
8. `test: cover tenant isolation and role workflows`
