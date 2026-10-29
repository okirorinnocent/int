-- =====================================================================
-- InternLog — MUST internship placement + digital logbook
-- 02 SCHEMA  (fresh start; safe to re-run)
--
-- Run in Supabase -> SQL Editor. On a project that already has the old
-- scripts, run 01_reset_optional.sql first.
--
-- What this gives you
--   * Real accounts: students sign up themselves; host-organisation and
--     academic staff can sign up too but stay "pending" until an admin
--     approves them. Nobody can make themselves admin.
--   * Placements that hosts post and students search / filter.
--   * Applications (draft -> submitted -> under review -> accepted/declined).
--     Accepting one creates the student's internship automatically.
--   * Daily logbooks that only the student can write and only the assigned
--     supervisor can sign. Drafts are private.
--   * Final reports, announcements, private file storage, rate limits.
--   * get_dashboard(): one call returns the REAL numbers for the signed-in
--     user's role (no hard-coded name, no sample figures).
-- =====================================================================

-- ───────────────────────── 1. TYPES ─────────────────────────
do $$ begin create type public.app_role as enum ('student','workplace_supervisor','academic_supervisor','admin');
exception when duplicate_object then null; end $$;
do $$ begin create type public.account_status as enum ('active','pending','suspended');
exception when duplicate_object then null; end $$;
do $$ begin create type public.application_status as enum ('draft','submitted','under_review','accepted','declined','withdrawn');
exception when duplicate_object then null; end $$;
do $$ begin create type public.internship_status as enum ('active','completed','terminated');
exception when duplicate_object then null; end $$;
do $$ begin create type public.logbook_status as enum ('draft','submitted','approved','changes_requested');
exception when duplicate_object then null; end $$;

-- ───────────────────────── 2. TABLES ─────────────────────────
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  role                public.app_role      not null default 'student',
  status              public.account_status not null default 'active',
  full_name           text check (char_length(full_name) <= 120),
  email               text,
  phone_number        text check (char_length(phone_number) <= 30),
  registration_number text unique check (char_length(registration_number) between 3 and 40),
  faculty             text check (char_length(faculty) <= 120),
  program             text check (char_length(program) <= 160),
  year_of_study       smallint check (year_of_study between 1 and 7),
  organization_name   text check (char_length(organization_name) <= 160),  -- host staff
  job_title           text check (char_length(job_title) <= 120),
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.placements (
  id                    uuid primary key default gen_random_uuid(),
  created_by            uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title                 text not null check (char_length(title) between 3 and 160),
  organization_name     text not null check (char_length(organization_name) between 2 and 160),
  location              text check (char_length(location) <= 160),
  field_category        text check (char_length(field_category) <= 80),   -- Software, Networking, Data, IT Support...
  work_mode             text not null default 'onsite' check (work_mode in ('onsite','remote','hybrid')),
  description           text check (char_length(description) <= 5000),
  requirements          text check (char_length(requirements) <= 3000),
  slots                 int  not null default 1 check (slots between 1 and 500),
  slots_filled          int  not null default 0 check (slots_filled >= 0),
  slots_left            int  generated always as (slots - slots_filled) stored,
  application_deadline  date,
  start_date            date,
  duration_weeks        int  check (duration_weeks between 1 and 52),
  is_active             boolean not null default true,
  search                tsvector generated always as (to_tsvector('simple',
                          coalesce(title,'') || ' ' || coalesce(organization_name,'') || ' ' ||
                          coalesce(location,'') || ' ' || coalesce(field_category,'') || ' ' ||
                          coalesce(description,''))) stored,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (slots >= slots_filled)
);

create table if not exists public.applications (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  placement_id   uuid not null references public.placements(id) on delete restrict,
  status         public.application_status not null default 'draft',
  cover_note     text check (char_length(cover_note) <= 3000),
  contact_phone  text check (char_length(contact_phone) <= 30),
  resume_path    text check (resume_path is null or starts_with(resume_path, student_id::text || '/')),
  applied_at     timestamptz,
  decision_note  text check (char_length(decision_note) <= 2000),
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (student_id, placement_id)
);

-- One row per student placement. Created automatically when an application is accepted
-- (or by an admin for students who arranged their own placement).
create table if not exists public.internships (
  id                       uuid primary key default gen_random_uuid(),
  student_id               uuid not null references public.profiles(id) on delete cascade,
  application_id           uuid unique references public.applications(id) on delete set null,
  placement_id             uuid references public.placements(id) on delete set null,
  host_name                text not null,
  workplace_supervisor_id  uuid references public.profiles(id) on delete set null,
  academic_supervisor_id   uuid references public.profiles(id) on delete set null,
  start_date               date,
  end_date                 date,
  target_hours             int not null default 320 check (target_hours > 0),
  status                   public.internship_status not null default 'active',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create unique index if not exists internships_one_active_per_student
  on public.internships (student_id) where status = 'active';

create table if not exists public.logbooks (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  internship_id       uuid not null references public.internships(id) on delete cascade,
  entry_date          date not null default current_date,
  week_number         int  check (week_number between 1 and 60),
  hours               numeric(3,1) not null check (hours > 0 and hours <= 16),
  tasks               text not null check (char_length(tasks) between 1 and 4000),
  skills              text check (char_length(skills) <= 500),
  attachment_paths    text[] not null default '{}' check (cardinality(attachment_paths) <= 5),
  status              public.logbook_status not null default 'draft',
  supervisor_comment  text check (char_length(supervisor_comment) <= 2000),
  grade               text check (char_length(grade) <= 10),
  signed_by           uuid references public.profiles(id) on delete set null,
  signed_at           timestamptz,
  submitted_at        timestamptz,
  client_id           uuid,                                  -- idempotent offline sync key
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (student_id, entry_date),
  unique (student_id, client_id)
);

create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  internship_id uuid not null unique references public.internships(id) on delete cascade,
  title         text not null default 'Internship report' check (char_length(title) <= 200),
  body          text not null check (char_length(body) between 1 and 60000),
  status        text not null default 'draft' check (status in ('draft','submitted')),
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid default auth.uid() references public.profiles(id) on delete set null,
  title      text not null check (char_length(title) between 1 and 200),
  body       text not null check (char_length(body) between 1 and 5000),
  audience   text not null default 'all' check (audience in ('all','students','supervisors')),
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  hits         int         not null default 1,
  primary key (key, window_start)
);

-- Indexes (RLS + search + dashboards)
create index if not exists placements_search_idx   on public.placements using gin (search);
create index if not exists placements_open_idx     on public.placements (is_active, application_deadline);
create index if not exists placements_creator_idx  on public.placements (created_by);
create index if not exists applications_student_ix on public.applications (student_id, status);
create index if not exists applications_place_ix   on public.applications (placement_id, status);
create index if not exists internships_student_ix  on public.internships (student_id, status);
create index if not exists internships_wsup_ix     on public.internships (workplace_supervisor_id);
create index if not exists internships_asup_ix     on public.internships (academic_supervisor_id);
create index if not exists logbooks_student_ix     on public.logbooks (student_id, entry_date desc);
create index if not exists logbooks_internship_ix  on public.logbooks (internship_id, status);
create index if not exists logbooks_pending_ix     on public.logbooks (student_id) where status = 'submitted';
create index if not exists reports_student_ix      on public.reports (student_id);
create index if not exists announcements_recent_ix on public.announcements (created_at desc);
create index if not exists profiles_role_ix        on public.profiles (role, status);

-- ───────────────────────── 3. HELPER FUNCTIONS ─────────────────────────
-- SECURITY DEFINER + empty search_path: they read tables without triggering RLS recursion.

-- The caller's role, but ONLY if the account is active (pending/suspended => NULL => no powers).
create or replace function public.current_role_() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.status = 'active' $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_role_() = 'admin', false) $$;

-- Is the caller the workplace or academic supervisor of this student?
create or replace function public.supervises(_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    public.current_role_() in ('workplace_supervisor','academic_supervisor')
    and exists (select 1 from public.internships i
                where i.student_id = _student
                  and (select auth.uid()) in (i.workplace_supervisor_id, i.academic_supervisor_id)), false) $$;

create or replace function public.owns_placement(_placement uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.placements p
                 where p.id = _placement and p.created_by = (select auth.uid())) $$;

create or replace function public.has_applied(_placement uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.applications a
                 where a.placement_id = _placement and a.student_id = (select auth.uid())) $$;

-- A host may see the profile of a student who applied (not draft) to one of their placements.
create or replace function public.reviews_applicant(_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.applications a
                 join public.placements p on p.id = a.placement_id
                 where a.student_id = _student and a.status <> 'draft'
                   and p.created_by = (select auth.uid())) $$;

-- Who may read whose profile (phone numbers and registration numbers are NOT public).
create or replace function public.can_see_profile(_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select _profile = (select auth.uid())
      or public.is_admin()
      or public.reviews_applicant(_profile)
      or exists (select 1 from public.internships i
                 where (i.student_id = _profile and (select auth.uid()) in (i.workplace_supervisor_id, i.academic_supervisor_id))
                    or (i.student_id = (select auth.uid()) and _profile in (i.workplace_supervisor_id, i.academic_supervisor_id)))
      or exists (select 1 from public.applications a
                 join public.placements p on p.id = a.placement_id
                 where a.student_id = (select auth.uid()) and p.created_by = _profile) $$;

-- ───────────────────────── 4. TRIGGERS ─────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- 4a. Sign-up. Self-registration is strictly student-only. Supervisor/admin roles must be
--     assigned through a separately authenticated, audited invitation/approval workflow.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r public.app_role := 'student'::public.app_role;
begin
  -- Never trust role supplied in user_metadata: it is controlled by the client.
  insert into public.profiles (id, role, status, full_name, email, organization_name)
  values (new.id, r, 'active'::public.account_status,
          nullif(left(trim(coalesce(new.raw_user_meta_data->>'full_name','')), 120), ''),
          new.email,
          nullif(left(trim(coalesce(new.raw_user_meta_data->>'organization_name','')), 160), ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- 4b. Rate limiting (per user, per table) — a DB-level backstop that can't be skipped by the client.
create or replace function public.check_rate_limit(_key text, _limit int, _window_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);
        n int;
begin
  insert into public.rate_limits (key, window_start) values (_key, w)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  if random() < 0.01 then  -- cheap self-cleaning, no pg_cron needed
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return n <= _limit;
end $$;

create or replace function public.enforce_user_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is not null and not public.check_rate_limit(tg_table_name || ':' || uid::text, tg_argv[0]::int, tg_argv[1]::int) then
    raise exception 'Too many % requests. Please wait a moment and try again.', tg_table_name using errcode = '54000';
  end if;
  return new;
end $$;

-- 4c. Applications: students move draft -> submitted -> withdrawn only; hosts decide; nobody edits identity.
create or replace function public.guard_application() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid    uuid    := (select auth.uid());
  staff  boolean := (uid is null) or public.is_admin();   -- SQL editor / service role / admin
  pl     public.placements%rowtype;
begin
  if tg_op = 'INSERT' then
    if not staff then
      if new.student_id <> uid then raise exception 'You can only apply for yourself'; end if;
      if new.status not in ('draft','submitted') then raise exception 'A new application must be a draft or submitted'; end if;
      new.decision_note := null; new.decided_at := null;
    end if;
  else
    if new.student_id <> old.student_id or new.placement_id <> old.placement_id then
      raise exception 'student_id and placement_id cannot be changed';
    end if;
    if not staff then
      if uid = old.student_id then
        if new.status is distinct from old.status and not (
             (old.status = 'draft' and new.status = 'submitted')
          or (old.status in ('submitted','under_review') and new.status = 'withdrawn')) then
          raise exception 'You cannot change an application from % to %', old.status, new.status;
        end if;
        if old.status <> 'draft' and (new.cover_note    is distinct from old.cover_note
                                   or new.contact_phone is distinct from old.contact_phone
                                   or new.resume_path   is distinct from old.resume_path) then
          raise exception 'A submitted application can no longer be edited';
        end if;
        if new.decision_note is distinct from old.decision_note or new.decided_at is distinct from old.decided_at then
          raise exception 'Only the host can record a decision';
        end if;
      elsif public.owns_placement(old.placement_id) then
        if new.status is distinct from old.status and not (
             (old.status = 'submitted'    and new.status in ('under_review','accepted','declined'))
          or (old.status = 'under_review' and new.status in ('accepted','declined'))) then
          raise exception 'You cannot change an application from % to %', old.status, new.status;
        end if;
        if new.cover_note    is distinct from old.cover_note
        or new.contact_phone is distinct from old.contact_phone
        or new.resume_path   is distinct from old.resume_path
        or new.applied_at    is distinct from old.applied_at then
          raise exception 'Hosts can only record a decision';
        end if;
      else
        raise exception 'Not allowed';
      end if;
    end if;
  end if;

  -- (re)submitting: placement must be open and the student's profile complete
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status = 'draft') then
    select * into pl from public.placements where id = new.placement_id;
    if not found or not pl.is_active or pl.slots_left <= 0
       or (pl.application_deadline is not null and pl.application_deadline < current_date) then
      raise exception 'This placement is no longer open for applications';
    end if;
    if not staff and not exists (select 1 from public.profiles p
                                 where p.id = new.student_id and p.full_name is not null
                                   and p.registration_number is not null and p.program is not null) then
      raise exception 'Complete your profile (name, registration number, programme) before applying';
    end if;
    new.applied_at := now();
  end if;

  -- accepting: lock the placement row so two hosts/tabs cannot over-fill it
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status <> 'accepted') then
    select * into pl from public.placements where id = new.placement_id for update;
    if pl.slots_left <= 0 then raise exception 'No slots left on this placement'; end if;
    if exists (select 1 from public.internships i where i.student_id = new.student_id and i.status = 'active') then
      raise exception 'This student already has an active internship';
    end if;
  end if;
  if new.status in ('accepted','declined') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.decided_at := now();
  end if;
  return new;
end $$;

create or replace function public.after_application_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status <> 'accepted') then
    update public.placements set slots_filled = slots_filled + 1 where id = new.placement_id;
    insert into public.internships (student_id, application_id, placement_id, host_name,
                                    workplace_supervisor_id, start_date, end_date)
    select new.student_id, new.id, p.id, p.organization_name,
           case when hp.role = 'workplace_supervisor' then p.created_by end,
           p.start_date, p.start_date + (p.duration_weeks * 7)
    from public.placements p
    left join public.profiles hp on hp.id = p.created_by
    where p.id = new.placement_id;
  elsif tg_op = 'UPDATE' and old.status = 'accepted' and new.status <> 'accepted' then
    update public.placements set slots_filled = greatest(slots_filled - 1, 0) where id = new.placement_id;
    update public.internships set status = 'terminated' where application_id = new.id and status = 'active';
  end if;
  return new;
end $$;

-- 4d. Logbooks: students write, assigned supervisors sign. Signatures can't be forged on INSERT or UPDATE.
create or replace function public.guard_logbook() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid    uuid    := (select auth.uid());
  staff  boolean := (uid is null) or public.is_admin();
  i      public.internships%rowtype;
begin
  if tg_op = 'INSERT' then
    if not staff then
      if new.student_id <> uid then raise exception 'You can only write your own logbook'; end if;
      if new.status not in ('draft','submitted') or new.signed_by is not null or new.signed_at is not null
         or new.supervisor_comment is not null or new.grade is not null then
        raise exception 'Review fields can only be set by a supervisor';
      end if;
    end if;
    if new.internship_id is null then
      select * into i from public.internships where student_id = new.student_id and status = 'active';
      if not found then raise exception 'You need an accepted placement before you can log hours'; end if;
      new.internship_id := i.id;
    else
      select * into i from public.internships where id = new.internship_id and student_id = new.student_id;
      if not found then raise exception 'That internship does not belong to this student'; end if;
    end if;
    if i.status <> 'active' and not staff then raise exception 'This internship is no longer active'; end if;
    if new.entry_date > current_date + 1 then raise exception 'An entry cannot be dated in the future'; end if;
    if new.week_number is null then
      new.week_number := greatest(1, ((new.entry_date - coalesce(i.start_date, new.entry_date)) / 7) + 1);
    end if;
    if new.status = 'submitted' then
      if char_length(trim(new.tasks)) < 10 then raise exception 'Describe the tasks you performed before submitting'; end if;
      new.submitted_at := now();
    end if;
    return new;
  end if;

  -- UPDATE
  if new.student_id <> old.student_id or new.internship_id <> old.internship_id then
    raise exception 'student_id and internship_id cannot be changed';
  end if;
  if uid is null then return new; end if;      -- service role / SQL editor
  if public.is_admin() then return new; end if;

  if uid = old.student_id then
    if old.status not in ('draft','changes_requested') then
      raise exception 'This entry is % and can no longer be edited', old.status;
    end if;
    if new.status not in ('draft','submitted') then raise exception 'Students can only save a draft or submit'; end if;
    if (new.supervisor_comment, new.grade, new.signed_by, new.signed_at)
       is distinct from (old.supervisor_comment, old.grade, old.signed_by, old.signed_at) then
      raise exception 'Review fields can only be set by a supervisor';
    end if;
    if new.status = 'submitted' then
      if char_length(trim(new.tasks)) < 10 then raise exception 'Describe the tasks you performed before submitting'; end if;
      new.submitted_at := now();
    end if;
  elsif public.supervises(old.student_id) then
    if old.status <> 'submitted' then raise exception 'Only submitted entries can be reviewed'; end if;
    if new.status not in ('approved','changes_requested') then raise exception 'Choose approve or request changes'; end if;
    if (new.entry_date, new.week_number, new.hours, new.tasks, new.skills, new.attachment_paths, new.client_id)
       is distinct from (old.entry_date, old.week_number, old.hours, old.tasks, old.skills, old.attachment_paths, old.client_id) then
      raise exception 'Supervisors cannot edit the student''s own words';
    end if;
    if new.status = 'changes_requested' and coalesce(trim(new.supervisor_comment), '') = '' then
      raise exception 'Say what needs to change';
    end if;
    if new.status = 'approved' then new.signed_by := uid; new.signed_at := now();
    else new.signed_by := null; new.signed_at := null; end if;
  else
    raise exception 'Not allowed';
  end if;
  return new;
end $$;

-- 4e. Reports
create or replace function public.guard_report() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.student_id <> old.student_id or new.internship_id <> old.internship_id) then
    raise exception 'student_id and internship_id cannot be changed';
  end if;
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status = 'draft') then new.submitted_at := now(); end if;
  return new;
end $$;

-- attach triggers (drop first so the script can be re-run)
drop trigger if exists on_auth_user_created      on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

do $$ declare t text; begin
  foreach t in array array['profiles','placements','applications','internships','logbooks','reports'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

drop trigger if exists guard_application_trg on public.applications;
create trigger guard_application_trg before insert or update on public.applications
  for each row execute function public.guard_application();
drop trigger if exists after_application_trg on public.applications;
create trigger after_application_trg after insert or update on public.applications
  for each row execute function public.after_application_change();
drop trigger if exists guard_logbook_trg on public.logbooks;
create trigger guard_logbook_trg before insert or update on public.logbooks
  for each row execute function public.guard_logbook();
drop trigger if exists guard_report_trg on public.reports;
create trigger guard_report_trg before insert or update on public.reports
  for each row execute function public.guard_report();

drop trigger if exists limit_applications on public.applications;
create trigger limit_applications before insert on public.applications for each row execute function public.enforce_user_limit(10, 3600);
drop trigger if exists limit_logbooks on public.logbooks;
create trigger limit_logbooks     before insert on public.logbooks     for each row execute function public.enforce_user_limit(40, 3600);
drop trigger if exists limit_placements on public.placements;
create trigger limit_placements   before insert on public.placements   for each row execute function public.enforce_user_limit(20, 3600);
drop trigger if exists limit_reports on public.reports;
create trigger limit_reports      before insert on public.reports      for each row execute function public.enforce_user_limit(10, 3600);

-- ───────────────────────── 5. RPC FUNCTIONS ─────────────────────────
-- Admin: approve / change role / suspend an account. (Profiles' role+status columns are not
-- writable from the client at all; this is the only way.)
create or replace function public.admin_set_account(_user uuid,
    _role public.app_role default null, _status public.account_status default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if _user = (select auth.uid()) and ((_role is not null and _role <> 'admin') or (_status is not null and _status <> 'active')) then
    raise exception 'You cannot demote or suspend yourself';
  end if;
  update public.profiles set role = coalesce(_role, role), status = coalesce(_status, status) where id = _user;
  if _status = 'suspended' then
    update public.placements set is_active = false where created_by = _user;
  end if;
end $$;

-- Real numbers for the signed-in user's dashboard. SECURITY INVOKER: RLS decides what each
-- role can count, so a student only ever counts their own rows, a supervisor their interns', etc.
create or replace function public.get_dashboard() returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  uid  uuid := (select auth.uid());
  r    public.app_role := public.current_role_();
  me   public.profiles%rowtype;
  o    jsonb;
begin
  select * into me from public.profiles where id = uid;
  if not found then return jsonb_build_object('role', null); end if;

  o := jsonb_build_object(
    'user_id', uid, 'role', me.role, 'status', me.status,
    'full_name', me.full_name, 'first_name', nullif(split_part(coalesce(me.full_name, ''), ' ', 1), ''),
    'onboarding_complete', me.onboarding_complete);
  if r is null then return o; end if;      -- pending / suspended: nothing else to show

  o := o || jsonb_build_object(
    'verified_hours',   (select coalesce(sum(hours), 0) from public.logbooks where status = 'approved'),
    'pending_reviews',  (select count(*) from public.logbooks where status = 'submitted'),
    'approved_entries', (select count(*) from public.logbooks where status = 'approved'),
    'open_placements',  (select count(*) from public.placements
                          where is_active and slots_left > 0 and (application_deadline is null or application_deadline >= current_date)),
    'weekly_hours', (select coalesce(jsonb_agg(jsonb_build_object('week', week_number, 'hours', h) order by week_number), '[]'::jsonb)
                       from (select week_number, sum(hours) as h from public.logbooks
                              where status in ('submitted','approved') group by week_number) w),
    'recent_entries', (select coalesce(jsonb_agg(to_jsonb(x) order by x.entry_date desc), '[]'::jsonb)
                         from (select id, entry_date, hours, status from public.logbooks
                                order by entry_date desc limit 5) x));

  if r = 'student' then
    o := o || jsonb_build_object(
      'internship', (select to_jsonb(i) - 'application_id' from public.internships i
                      where i.student_id = uid and i.status = 'active' limit 1),
      'target_hours', coalesce((select target_hours from public.internships where student_id = uid and status = 'active'), 320),
      'applications', jsonb_build_object(
          'total',     (select count(*) from public.applications),
          'submitted', (select count(*) from public.applications where status in ('submitted','under_review')),
          'accepted',  (select count(*) from public.applications where status = 'accepted')));
  elsif r in ('workplace_supervisor','academic_supervisor') then
    o := o || jsonb_build_object(
      'active_interns',        (select count(*) from public.internships where status = 'active'),
      'applications_to_review',(select count(*) from public.applications where status in ('submitted','under_review')),
      'my_placements',         (select count(*) from public.placements where created_by = uid));
  else  -- admin
    o := o || jsonb_build_object(
      'students',              (select count(*) from public.profiles where role = 'student'),
      'active_interns',        (select count(*) from public.internships where status = 'active'),
      'host_organizations',    (select count(distinct organization_name) from public.placements),
      'reports_submitted',     (select count(*) from public.reports where status = 'submitted'),
      'pending_accounts',      (select count(*) from public.profiles where status = 'pending'),
      'applications_total',    (select count(*) from public.applications where status <> 'draft'));
  end if;
  return o;
end $$;

-- ───────────────────────── 6. ROW LEVEL SECURITY ─────────────────────────
alter table public.profiles      enable row level security;
alter table public.placements    enable row level security;
alter table public.applications  enable row level security;
alter table public.internships   enable row level security;
alter table public.logbooks      enable row level security;
alter table public.reports       enable row level security;
alter table public.announcements enable row level security;
alter table public.rate_limits   enable row level security;   -- no policies: functions only

do $$ declare p record; begin   -- start from a clean policy set so re-runs never leave stale rules
  for p in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- profiles: see yourself + people you work with. Edit yourself (role/status/email columns are not grantable).
create policy profiles_select on public.profiles for select to authenticated
  using (public.can_see_profile(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- placements: students browse open ones; hosts manage their own; admin everything
create policy placements_select on public.placements for select to authenticated using (
     (is_active and (application_deadline is null or application_deadline >= current_date))
  or created_by = (select auth.uid())
  or (select public.is_admin())
  or public.has_applied(id));
create policy placements_insert on public.placements for insert to authenticated with check (
     (created_by = (select auth.uid()) and (select public.current_role_()) in ('workplace_supervisor','academic_supervisor'))
  or (select public.is_admin()));
create policy placements_update on public.placements for update to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()))
  with check ((created_by = (select auth.uid()) and (select public.current_role_()) in ('workplace_supervisor','academic_supervisor'))
              or (select public.is_admin()));
create policy placements_delete on public.placements for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));   -- blocked by FK once anyone has applied

-- applications
create policy app_student_select on public.applications for select to authenticated
  using (student_id = (select auth.uid()));
create policy app_student_insert on public.applications for insert to authenticated
  with check (student_id = (select auth.uid()) and (select public.current_role_()) = 'student' and status in ('draft','submitted'));
create policy app_student_update on public.applications for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy app_student_delete on public.applications for delete to authenticated
  using (student_id = (select auth.uid()) and status = 'draft');
create policy app_host_select on public.applications for select to authenticated
  using (status <> 'draft' and (select public.current_role_()) in ('workplace_supervisor','academic_supervisor')
         and public.owns_placement(placement_id));
create policy app_host_update on public.applications for update to authenticated
  using (status in ('submitted','under_review') and (select public.current_role_()) in ('workplace_supervisor','academic_supervisor')
         and public.owns_placement(placement_id))
  with check (public.owns_placement(placement_id));
create policy app_admin_all on public.applications for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- internships: visible to the student and their supervisors; only admin writes (plus the accept trigger)
create policy internships_select on public.internships for select to authenticated
  using (student_id = (select auth.uid()) or public.supervises(student_id) or (select public.is_admin()));
create policy internships_admin_write on public.internships for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- logbooks: drafts are private to the student
create policy lb_select on public.logbooks for select to authenticated using (
     student_id = (select auth.uid())
  or (status <> 'draft' and (public.supervises(student_id) or (select public.is_admin()))));
create policy lb_student_insert on public.logbooks for insert to authenticated
  with check (student_id = (select auth.uid()) and (select public.current_role_()) = 'student');
create policy lb_update on public.logbooks for update to authenticated
  using (student_id = (select auth.uid()) or (status <> 'draft' and (public.supervises(student_id) or (select public.is_admin()))))
  with check (student_id = (select auth.uid()) or public.supervises(student_id) or (select public.is_admin()));
create policy lb_student_delete on public.logbooks for delete to authenticated
  using (student_id = (select auth.uid()) and status = 'draft');

-- reports
create policy reports_select on public.reports for select to authenticated using (
     student_id = (select auth.uid())
  or (status = 'submitted' and (public.supervises(student_id) or (select public.is_admin()))));
create policy reports_insert on public.reports for insert to authenticated with check (
     student_id = (select auth.uid()) and (select public.current_role_()) = 'student'
  and exists (select 1 from public.internships i where i.id = internship_id and i.student_id = (select auth.uid())));
create policy reports_update on public.reports for update to authenticated
  using (student_id = (select auth.uid()) and status = 'draft') with check (student_id = (select auth.uid()));
create policy reports_delete on public.reports for delete to authenticated
  using (student_id = (select auth.uid()) and status = 'draft');

-- announcements: admin writes, audience decides who reads
create policy ann_select on public.announcements for select to authenticated using (
     audience = 'all'
  or (select public.is_admin())
  or (audience = 'students'    and (select public.current_role_()) = 'student')
  or (audience = 'supervisors' and (select public.current_role_()) in ('workplace_supervisor','academic_supervisor')));
create policy ann_admin_write on public.announcements for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ───────────────────────── 7. STORAGE (private buckets) ─────────────────────────
-- Path convention: <student_uuid>/<filename>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('resumes',       'resumes',       false,  5242880, array['application/pdf']),
  ('logbook_files', 'logbook_files', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resumes_owner"          on storage.objects;
drop policy if exists "resumes_reviewer_read"  on storage.objects;
drop policy if exists "logbook_files_owner"    on storage.objects;
drop policy if exists "logbook_files_staff_read" on storage.objects;

create policy "resumes_owner" on storage.objects for all to authenticated
  using      (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.current_role_()) = 'student');
-- A host can read a résumé only if the student has a non-draft application to one of THEIR
-- placements: the sub-select runs under the caller's RLS on public.applications.
create policy "resumes_reviewer_read" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and exists (
    select 1 from public.applications a where a.student_id::text = (storage.foldername(name))[1]));

create policy "logbook_files_owner" on storage.objects for all to authenticated
  using      (bucket_id = 'logbook_files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'logbook_files' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.current_role_()) = 'student');
-- Supervisors/admin: the sub-select only returns internships they supervise (RLS on public.internships).
create policy "logbook_files_staff_read" on storage.objects for select to authenticated
  using (bucket_id = 'logbook_files' and exists (
    select 1 from public.internships i where i.student_id::text = (storage.foldername(name))[1]));

-- ───────────────────────── 8. PRIVILEGES ─────────────────────────
-- anon gets nothing. authenticated gets only the columns the app is meant to write; RLS + triggers do the rest.
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant usage on schema public to authenticated;
grant select on public.profiles, public.placements, public.applications, public.internships,
                public.logbooks, public.reports, public.announcements to authenticated;

grant update (full_name, phone_number, registration_number, faculty, program, year_of_study,
              organization_name, job_title, onboarding_complete) on public.profiles to authenticated;

grant insert (title, organization_name, location, field_category, work_mode, description, requirements,
              slots, application_deadline, start_date, duration_weeks, is_active) on public.placements to authenticated;
grant update (title, organization_name, location, field_category, work_mode, description, requirements,
              slots, application_deadline, start_date, duration_weeks, is_active) on public.placements to authenticated;
grant delete on public.placements to authenticated;

grant insert (placement_id, status, cover_note, contact_phone, resume_path) on public.applications to authenticated;
grant update (status, cover_note, contact_phone, resume_path, decision_note) on public.applications to authenticated;
grant delete on public.applications to authenticated;

grant insert, update, delete on public.internships to authenticated;       -- admin only, enforced by RLS
grant insert, update, delete on public.announcements to authenticated;     -- admin only, enforced by RLS

grant insert (entry_date, week_number, hours, tasks, skills, attachment_paths, status, client_id) on public.logbooks to authenticated;
grant update (entry_date, week_number, hours, tasks, skills, attachment_paths, status, supervisor_comment, grade) on public.logbooks to authenticated;
grant delete on public.logbooks to authenticated;

grant insert (internship_id, title, body, status) on public.reports to authenticated;
grant update (title, body, status) on public.reports to authenticated;
grant delete on public.reports to authenticated;

-- functions the client may call (also used inside policies, which run as the caller)
grant execute on function public.current_role_(), public.is_admin(), public.supervises(uuid),
      public.owns_placement(uuid), public.has_applied(uuid), public.reviews_applicant(uuid),
      public.can_see_profile(uuid), public.get_dashboard(),
      public.admin_set_account(uuid, public.app_role, public.account_status) to authenticated;

-- ───────────────────────── 9. BACKFILL + FIRST ADMIN ─────────────────────────
-- Anyone who already signed up before this script gets a student profile.
insert into public.profiles (id, role, status, full_name, email)
select u.id, 'student', 'active',
       nullif(left(trim(coalesce(u.raw_user_meta_data->>'full_name','')), 120), ''), u.email
from auth.users u
on conflict (id) do nothing;

-- Make yourself the first admin: sign up in the app with your email, then run (replace the email):
-- update public.profiles set role = 'admin', status = 'active'
--  where id = (select id from auth.users where email = 'you@must.ac.ug');
