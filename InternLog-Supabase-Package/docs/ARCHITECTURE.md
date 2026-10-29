# InternLog Platform Architecture

## 1. Scope and principles

InternLog is a multi-role student placement, internship supervision, and digital logbook platform. The existing project uses a Vite/TanStack Router frontend and Supabase for authentication, PostgreSQL, Row Level Security (RLS), and private file storage.

Design principles:

- **Least privilege:** every route, query, mutation, and file URL is scoped to the authenticated user, active role, institution, and assignment.
- **Database is authoritative:** drafts, profiles, applications, placements, and audit events persist in PostgreSQL; the client never uses localStorage as the source of truth.
- **Verified identity first:** email verification is required before activation; elevated staff roles remain pending until an administrator approves them.
- **Explicit state machines:** applications, placements, internships, and logbook entries use constrained status transitions.
- **Auditable operations:** role changes, approvals, exports, document access, and security events are immutable audit records.

## 2. High-level architecture

```text
Browser
  ├─ TanStack Router route guards
  ├─ Role-aware AppShell and navigation
  ├─ Supabase browser client (publishable key only)
  └─ Optimistic UI with rollback on mutation error
       │
       ▼
Supabase Auth ── email verification / magic links / password reset
       │
       ▼
PostgreSQL + RLS
  ├─ identity, roles, institutions, profiles
  ├─ vacancies, applications, placements, assignments
  ├─ documents and audit logs
  └─ secure RPCs for state transitions and exports
       │
       ├─ Supabase Storage private buckets
       └─ Edge Functions / trusted server jobs
            ├─ login alert email
            ├─ magic-link and reset email templates
            ├─ rate limiting and security event enrichment
            └─ CSV export generation
```

Use Supabase Auth's session cookies/tokens, PostgreSQL RLS for data isolation, private Storage buckets for resumes and flyers, and Edge Functions for email notifications and operations that must not expose service-role credentials to the browser.

## 3. Database schema

The current `02_schema.sql` already covers the core student, placement, application, internship, logbook, report, announcement, and rate-limit tables. The following model is the target contract. New entities can be added in a follow-up migration without changing the existing student workflow.

### 3.1 Identity and tenancy

| Entity | Key fields | Relationships and rules |
|---|---|---|
| `profiles` | `id uuid PK -> auth.users.id`, `full_name`, `email`, `phone`, `status`, `onboarding_complete` | One profile per Auth user. Never allow the client to assign `admin`. |
| `roles` | `id`, `code`, `label` | Seed: `student`, `academic_supervisor`, `workplace_supervisor`, `admin`. |
| `user_roles` | `user_id`, `role_id`, `is_active`, `approved_by`, `approved_at` | Supports role evolution. One active role is selected in the session context; permissions are unioned only where explicitly allowed. |
| `institutions` | `id`, `name`, `code`, `verified_domain`, `status` | Academic tenant boundary. |
| `institution_memberships` | `user_id`, `institution_id`, `membership_type`, `verified_at` | Academic supervisors can only see students in an institution where they have an approved membership. |
| `role_requests` | `id`, `user_id`, `requested_role`, `institution_id`, `organization_name`, `status`, `reviewed_by` | Every elevated role request is reviewed and audited. |

### 3.2 Placement and opportunity data

| Entity | Key fields | Relationships and rules |
|---|---|---|
| `placements` / `vacancies` | `id`, `created_by`, `organization_name`, `title`, `description`, `requirements`, `deadline`, `external_url`, `flyer_path`, `verification_status`, `is_active` | Workplace supervisors own their vacancies. Public listing exposes only approved metadata. |
| `organizations` | `id`, `name`, `registration_number`, `contact_email`, `website`, `verification_status` | A supervisor may manage only organizations they are assigned to. |
| `organization_memberships` | `organization_id`, `user_id`, `membership_role`, `approved_at` | Supports multiple workplace supervisors per company. |
| `applications` | `id`, `student_id`, `placement_id`, `status`, `cover_note`, `resume_path`, `applied_at`, `decision_note` | Unique `(student_id, placement_id)`. Student owns draft/submission; vacancy owner decides. |
| `shortlists` | `id`, `placement_id`, `created_by`, `name`, `share_token_hash`, `expires_at` | Export/share is explicit, time-limited, and revocable. Never expose unrestricted candidate search. |

### 3.3 Internship supervision

| Entity | Key fields | Relationships and rules |
|---|---|---|
| `internships` / `placements_active` | `id`, `student_id`, `application_id`, `workplace_supervisor_id`, `academic_supervisor_id`, `institution_id`, `start_date`, `end_date`, `status` | Academic and workplace supervisors are assignment-scoped, not globally privileged. |
| `supervisor_assignments` | `id`, `internship_id`, `supervisor_id`, `supervisor_type`, `assigned_by`, `active_from`, `active_to` | Direct assignment is the canonical access check. |
| `logbooks` | existing fields plus `reviewed_by`, `reviewed_at` | Student writes; assigned supervisor reviews/signs. Drafts remain private. |
| `reports` | existing fields plus `submitted_at`, `reviewed_by`, `review_status` | Student submits; assigned academic supervisor reviews. |

### 3.4 Documents, notifications, and auditability

| Entity | Key fields | Relationships and rules |
|---|---|---|
| `documents` | `id`, `owner_id`, `document_type`, `storage_path`, `mime_type`, `size_bytes`, `sha256`, `verification_status` | Metadata is queryable; files stay in private Storage. |
| `notifications` | `id`, `user_id`, `type`, `payload jsonb`, `read_at`, `created_at` | In-app copy of important email events. |
| `security_events` | `id`, `user_id`, `event_type`, `ip_hash`, `user_agent`, `approx_location`, `created_at`, `metadata` | Append-only. Store a truncated/hashed IP where possible. |
| `audit_logs` | `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `request_id`, `created_at` | Insert-only for clients; service/admin can read. Never permit updates or deletes from the app. |
| `rate_limits` | existing `key`, `window_start`, `hits` | Add IP/email dimensions for unauthenticated auth endpoints. |

Recommended indexes: `(institution_id, status)`, `(supervisor_id, active_to)`, `(placement_id, status)`, `(student_id, status)`, full-text index on vacancy title/description/requirements, and descending indexes on audit/security timestamps.

## 4. Security and session model

### 4.1 Authentication

1. Student signs up with email, password, name, institution, program, and requested role.
2. Supabase Auth creates an unverified user. A database trigger creates a pending profile; no protected data is accessible yet.
3. Verification email contains a single-use, short-lived token. The callback exchanges it for a session and marks `email_verified_at`.
4. Students become active after verification. Academic and workplace supervisors remain `pending` until an administrator verifies their institution/company evidence.
5. Password reset uses Supabase's tokenized recovery flow. Do not build custom reset tokens in client code.
6. Magic links are single-use and short-lived. Rate-limit requests by normalized email and IP; always return the same response to prevent account enumeration.

### 4.2 Exactly five-minute inactivity timeout

The timeout must be enforced client-side for responsiveness and server-side for correctness.

- Store `last_activity_at` in a session record or signed session claim managed by a trusted Edge Function; do not trust a client-provided timestamp.
- On each authenticated API/RPC request, the trusted layer compares `now()` with `last_activity_at`. If the elapsed time is **greater than or equal to 300 seconds**, revoke the session and return `401 SESSION_IDLE_TIMEOUT`.
- Throttle activity writes to at most once per 30 seconds to avoid write amplification, while every protected request still performs the expiry check.
- In the browser, listen for pointer, keyboard, touch, and visibility activity. Schedule a warning at 4:30 and sign out at 5:00 if no activity occurred.
- On timeout, flush any already-saved drafts, clear in-memory sensitive state, redirect to `/access?reason=idle-timeout`, and preserve drafts in PostgreSQL.
- A recognized device may re-authenticate using the verified email session only if the session refresh token remains valid; otherwise require a new magic link/password login.

### 4.3 Login alerts

Every sign-in attempt emits a `security_events` row, including failed attempts where no user session exists. A trusted Edge Function sends a notification for successful sign-ins and configurable suspicious failures.

Payload: event time in UTC, browser/device summary, approximate IP-derived location, success/failure, and a “secure account” link. Never send a raw password, access token, or full IP in email. Queue email delivery and retry safely with an idempotency key.

### 4.4 RLS policy contract

Enable RLS on every application table. Use `auth.uid()` and `security definer` helper functions with an empty `search_path`. Avoid recursive policies that query the same table directly.

Representative policy rules:

```sql
-- Profiles: self, approved supervisors connected to the student, or admin.
create policy profiles_select on public.profiles
for select using (
  id = auth.uid()
  or public.is_admin()
  or public.supervises(id)
  or public.reviews_applicant(id)
);

-- Students can create/read their own applications.
create policy applications_student on public.applications
for all using (student_id = auth.uid())
with check (student_id = auth.uid());

-- Workplace owners can review applications for their own vacancies.
create policy applications_vacancy_owner on public.applications
for select using (public.owns_placement(placement_id));

-- Academic supervisors only see assigned students in their institution.
create policy internships_academic_assignment on public.internships
for select using (
  academic_supervisor_id = auth.uid()
  and exists (
    select 1 from public.institution_memberships m
    where m.user_id = auth.uid() and m.institution_id = internships.institution_id
      and m.status = 'approved'
  )
);
```

Use RPCs for accept/decline, role approval, shortlist creation, export generation, and supervisor assignment. RPCs must validate state transitions and ownership server-side. Storage policies must mirror `owner_id`, application access, and supervisor assignment; never expose a bucket publicly.

## 5. Route guards and navigation

### Public routes

- `/` — marketing/landing or redirect to the authenticated context.
- `/access` — sign in, sign up, verify email, forgot password, reset password.
- `/auth/callback` — token exchange only; redirect immediately.

### Student routes

- `/student` — opportunity and application dashboard.
- `/student/opportunities` — browse, filter, and view approved vacancies.
- `/student/opportunities/:id` — vacancy detail and apply.
- `/student/applications` — drafts, submitted applications, decisions.
- `/student/profile` — editable profile, skills, projects, resume documents.
- `/student/placement/:id/logbook` — assigned internship logbook.
- `/student/placement/:id/report` — final report.

### Workplace supervisor routes

- `/workplace` — company pipeline dashboard.
- `/workplace/vacancies` and `/workplace/vacancies/new` — vacancy management.
- `/workplace/vacancies/:id/applications` — review queue.
- `/workplace/vacancies/:id/poster` — flyer preview/download.
- `/workplace/shortlists/:id` — shortlist/share/export.
- `/workplace/company` — verified company profile and members.

### Academic supervisor routes

- `/academic` — assigned student tracking dashboard.
- `/academic/students` — only students assigned to the supervisor and institution.
- `/academic/students/:id` — progress, attendance, logbook, report.
- `/academic/assignments` — assignment management if permitted.

### Administrator routes

- `/admin` — platform overview.
- `/admin/role-requests`, `/admin/institutions`, `/admin/organizations`, `/admin/audit` — governance and verification.

Guard order: authenticate → verify email → active account → resolve active role → verify tenant/assignment → load route. A denied route returns a 403 state and routes to the role's root dashboard, never to a view from another role.

When the user switches role or primary context, navigate directly to that context root (`/student`, `/workplace`, `/academic`, or `/admin`) and reload server-authoritative permissions. Do not merely swap labels on the current screen.

## 6. UI wireframes and component breakdown

### 6.1 Student Opportunity & Profile Hub

```text
┌─────────────────────────────────────────────────────────────┐
│ InternLog · Search · Notifications · Active role             │
├──────────────┬──────────────────────────────────────────────┤
│ Dashboard    │ Welcome back, {firstName}                     │
│ Opportunities│ Profile completion + next action              │
│ Applications │ [Search] [Institution] [Mode] [Deadline]      │
│ Placement    │ ┌──────────────┐ ┌──────────────┐             │
│ Profile      │ │ Vacancy card │ │ Vacancy card │             │
│              │ │ Apply / Save │ │ Apply / Save │             │
│              │ └──────────────┘ └──────────────┘             │
│              │ Applications timeline · Drafts · Statuses     │
└──────────────┴──────────────────────────────────────────────┘
```

Components: `RoleAwareSidebar`, `GreetingHeader`, `ProfileCompletionCard`, `OpportunityFilters`, `VacancyCard`, `ApplicationStatusTimeline`, `InlineProfileSection`, `ResumeManager`, `ProjectList`, `SkillEditor`, and `SessionTimeoutDialog`.

### 6.2 Workplace Application Review and Vacancy Poster

```text
┌─────────────────────────────────────────────────────────────┐
│ Company workspace · Vacancy status · Publish / Save draft    │
├──────────────────────────────┬──────────────────────────────┤
│ Applicant queue              │ Vacancy preview               │
│ Search / status / sort       │ Company verified badge        │
│ ┌──────────────────────────┐ │ Flyer/banner preview          │
│ │ Name · program · status  │ │ Title, requirements, deadline │
│ └──────────────────────────┘ │ External apply link           │
│ Candidate detail drawer     │ [Shortlist] [Decline] [Export] │
└──────────────────────────────┴──────────────────────────────┘
```

Components: `VacancyEditor`, `FlyerUploader`, `FlyerPreview`, `VerificationBadge`, `ApplicationQueueTable`, `CandidateDrawer`, `DecisionDialog`, `ShortlistToolbar`, and `SecureExportDialog`.

### 6.3 Academic Supervisor Student Tracking Dashboard

```text
┌─────────────────────────────────────────────────────────────┐
│ MUST · Academic supervision · Filters                        │
├─────────────────────────────────────────────────────────────┤
│ Assigned students  On placement  Awaiting review  At risk    │
├─────────────────────────────────────────────────────────────┤
│ Student | Company | Progress | Last logbook | Report | Action│
│ ────────────────────────────────────────────────────────────  │
│ Detail panel: placement dates, hours, logbook, notes, report  │
└─────────────────────────────────────────────────────────────┘
```

Components: `InstitutionScopeBanner`, `ProgressStatCard`, `StudentTrackingTable`, `RiskBadge`, `ProgressBar`, `LogbookReviewPanel`, `SupervisorNotes`, and `ReportReviewPanel`.

Accessibility: keyboard-first tables and dialogs, visible focus states, proper labels, non-color-only status indicators, alt text for flyers/resumes, and responsive table-to-card layouts on mobile.

## 7. Edge cases and operational gaps

- **Role abuse:** never trust role values from form metadata. Verify role and status from the database on every protected request.
- **Institution changes:** require an admin-reviewed transfer event; retain historical institution IDs on internships and audit logs.
- **Duplicate applications:** enforce a unique constraint and show the existing application instead of creating a second row.
- **Deadline races:** accept applications in a transaction that rechecks deadline, active flag, and remaining slots.
- **Concurrent vacancy decisions:** use transactional state transitions and lock the application/vacancy row before accepting candidates.
- **File safety:** allowlist MIME types, cap size, virus-scan uploads, generate random storage names, and serve short-lived signed URLs.
- **Resume privacy:** workplace supervisors see a resume only after the student submits to their vacancy; academic supervisors see assigned students only.
- **Export leakage:** require explicit shortlist membership, log every export, add expiry and revocation, and avoid exposing raw storage paths.
- **Email abuse:** rate-limit by IP, normalized email, and user ID; use generic auth responses to prevent enumeration.
- **Login alert failure:** queue alerts, retry idempotently, and surface delivery status only to administrators—not sensitive provider errors to end users.
- **Idle timeout during editing:** autosave validated drafts before timeout; never discard persisted data on sign-out.
- **Clock skew/time zones:** store UTC timestamps, render institution/user timezone, and evaluate deadlines on the server.
- **Deletion and retention:** soft-delete accounts, retain audit/security events for a defined period, and provide a data export/deletion request workflow.
- **Accessibility and localization:** avoid hardcoded greetings, use parsed profile names with a safe fallback, and keep all status labels translatable.
- **Monitoring:** add structured request IDs, error tracking, database slow-query alerts, and alerts for repeated failed logins or cross-tenant policy denials.
