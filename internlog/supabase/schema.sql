-- InternLog database foundation. Run once in the Supabase SQL editor.
-- Re-runnable: enums, tables, indexes, functions, triggers, policies and buckets are guarded.
begin;
create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('student','employer','workplace_supervisor','academic_supervisor','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.account_status as enum ('pending','active','suspended','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.opportunity_status as enum ('draft','published','closed','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.application_status as enum ('applied','shortlisted','interview','offered','accepted','rejected','withdrawn'); exception when duplicate_object then null; end $$;
do $$ begin create type public.placement_status as enum ('pending_approval','active','completed','terminated','withdrawn'); exception when duplicate_object then null; end $$;
do $$ begin create type public.logbook_status as enum ('draft','submitted','approved','returned'); exception when duplicate_object then null; end $$;
do $$ begin create type public.document_type as enum ('cv','transcript','introduction_letter','final_report','verification','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.report_status as enum ('open','under_review','resolved','dismissed'); exception when duplicate_object then null; end $$;

create table if not exists public.institutions (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 email_domain text, country_code text not null default 'UG', timezone text not null default 'Africa/Kampala',
 currency_code text not null default 'UGX', is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, institution_id uuid not null references public.institutions(id),
 role public.app_role not null default 'student', requested_role public.app_role not null default 'student', status public.account_status not null default 'pending',
 full_name text not null default '', email text not null, phone text, avatar_path text, bio text,
 email_verified_at timestamptz, approved_at timestamptz, approved_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists requested_role public.app_role not null default 'student';
create table if not exists public.student_profiles (
 user_id uuid primary key references public.profiles(id) on delete cascade, institution_id uuid not null references public.institutions(id),
 student_number text, programme text, course text, year_of_study smallint, graduation_year smallint,
 skills text[] not null default '{}', preferred_fields text[] not null default '{}', preferred_locations text[] not null default '{}',
 discoverable boolean not null default false, profile_visibility text not null default 'private' check (profile_visibility in ('private','employers')),
 profile_complete_percent smallint not null default 0 check (profile_complete_percent between 0 and 100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.employers (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), owner_user_id uuid not null references public.profiles(id),
 company_name text not null, registration_number text, industry text, description text, website text, location text,
 verification_status public.account_status not null default 'pending', verified_at timestamptz, verified_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(institution_id, registration_number)
);
create table if not exists public.supervisors (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), user_id uuid not null references public.profiles(id),
 employer_id uuid references public.employers(id) on delete set null, supervisor_type public.app_role not null check (supervisor_type in ('workplace_supervisor','academic_supervisor')),
 department text, workload_limit integer not null default 10 check (workload_limit > 0), is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(institution_id,user_id,supervisor_type)
);
create table if not exists public.opportunities (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), employer_id uuid not null references public.employers(id),
 title text not null, description text not null, opportunity_type text not null default 'internship', field text, location text,
 is_paid boolean not null default false, stipend_ugx bigint check (stipend_ugx is null or stipend_ugx >= 0), duration_weeks integer,
 required_skills text[] not null default '{}', application_deadline timestamptz, status public.opportunity_status not null default 'draft',
 published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.applications (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), opportunity_id uuid not null references public.opportunities(id),
 student_id uuid not null references public.profiles(id), cover_note text, cv_document_id uuid, status public.application_status not null default 'applied',
 match_score numeric(5,2), employer_note text, applied_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(opportunity_id,student_id)
);
create table if not exists public.interviews (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), application_id uuid not null references public.applications(id) on delete cascade,
 scheduled_at timestamptz not null, location_or_link text, notes text, outcome text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.placements (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), application_id uuid not null unique references public.applications(id),
 student_id uuid not null references public.profiles(id), employer_id uuid not null references public.employers(id), workplace_supervisor_id uuid references public.supervisors(id),
 academic_supervisor_id uuid references public.supervisors(id), start_date date not null, end_date date not null, status public.placement_status not null default 'pending_approval',
 approved_by uuid references public.profiles(id), approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(end_date >= start_date)
);
create table if not exists public.placement_agreements (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), placement_id uuid not null unique references public.placements(id) on delete cascade,
 agreement_path text, student_accepted_at timestamptz, employer_accepted_at timestamptz, institution_accepted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.logbook_entries (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), placement_id uuid not null references public.placements(id) on delete cascade,
 student_id uuid not null references public.profiles(id), entry_date date not null, period text not null default 'daily', activities text not null,
 learning_outcomes text, hours numeric(4,1) check(hours is null or hours between 0 and 24), status public.logbook_status not null default 'draft',
 supervisor_comment text, reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.attendance (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), placement_id uuid not null references public.placements(id) on delete cascade,
 student_id uuid not null references public.profiles(id), attendance_date date not null, check_in_at timestamptz, check_out_at timestamptz, confirmed_by uuid references public.profiles(id), notes text,
 created_at timestamptz not null default now(), unique(placement_id,attendance_date)
);
create table if not exists public.visits (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), placement_id uuid not null references public.placements(id) on delete cascade,
 academic_supervisor_id uuid not null references public.supervisors(id), scheduled_at timestamptz not null, completed_at timestamptz, notes text, created_at timestamptz not null default now()
);
create table if not exists public.evaluations (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), placement_id uuid not null references public.placements(id) on delete cascade,
 evaluator_id uuid not null references public.profiles(id), evaluator_role public.app_role not null, scores jsonb not null default '{}'::jsonb,
 comments text, recommendation text, status text not null default 'draft' check(status in ('draft','submitted','locked')),
 submitted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.rubrics (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), name text not null, rubric_type text not null,
 criteria jsonb not null default '[]'::jsonb, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.grade_components (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), rubric_id uuid references public.rubrics(id),
 component_key text not null, label text not null, weight numeric(5,2) not null check(weight between 0 and 100), max_score numeric(6,2) not null default 100,
 created_at timestamptz not null default now(), unique(institution_id,component_key)
);
create table if not exists public.grades (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), placement_id uuid not null unique references public.placements(id) on delete cascade,
 student_id uuid not null references public.profiles(id), component_scores jsonb not null default '{}'::jsonb, total_score numeric(6,2), grade_letter text,
 status text not null default 'draft' check(status in ('draft','submitted','published')), published_at timestamptz, override_reason text, overridden_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.documents (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), owner_user_id uuid not null references public.profiles(id),
 placement_id uuid references public.placements(id) on delete cascade, document_type public.document_type not null, storage_path text not null,
 original_filename text not null, mime_type text not null, size_bytes bigint not null check(size_bytes > 0), created_at timestamptz not null default now()
);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), sender_id uuid not null references public.profiles(id),
 recipient_id uuid not null references public.profiles(id), application_id uuid references public.applications(id) on delete cascade, placement_id uuid references public.placements(id) on delete cascade,
 body text not null check(length(body) between 1 and 5000), read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), user_id uuid not null references public.profiles(id),
 title text not null, body text not null, category text not null default 'general', action_url text, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), author_id uuid not null references public.profiles(id),
 title text not null, body text not null, audience public.app_role[] not null default '{student,employer,workplace_supervisor,academic_supervisor}',
 published_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.reports_disputes (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), reporter_id uuid not null references public.profiles(id),
 subject_type text not null, subject_id uuid, category text not null, description text not null, is_confidential boolean not null default false,
 status public.report_status not null default 'open', assigned_to uuid references public.profiles(id), resolution text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.reviews (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), placement_id uuid not null references public.placements(id) on delete cascade,
 student_id uuid not null references public.profiles(id), rating smallint not null check(rating between 1 and 5), comment text, is_published boolean not null default false,
 created_at timestamptz not null default now(), unique(placement_id,student_id)
);
create table if not exists public.cookie_consents (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete set null, anonymous_id text not null,
 categories jsonb not null, policy_version text not null, user_agent text, ip_hash text, withdrawn_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
 id uuid primary key default gen_random_uuid(), institution_id uuid references public.institutions(id), actor_id uuid references public.profiles(id),
 action text not null, table_name text not null, record_id uuid, reason text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.settings (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), key text not null, value jsonb not null,
 description text, updated_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(institution_id,key)
);

create index if not exists profiles_institution_role_idx on public.profiles(institution_id,role,status);
create index if not exists opportunities_search_idx on public.opportunities(institution_id,status,created_at desc);
create index if not exists applications_student_idx on public.applications(student_id,created_at desc);
create index if not exists applications_opportunity_idx on public.applications(opportunity_id,status);
create index if not exists placements_student_idx on public.placements(student_id,status);
create index if not exists logbook_student_date_idx on public.logbook_entries(student_id,entry_date desc);
create index if not exists notifications_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;
create index if not exists messages_thread_idx on public.messages(application_id,placement_id,created_at);
create index if not exists documents_owner_idx on public.documents(owner_user_id,created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path = '' as $$ select role from public.profiles where id = (select auth.uid()) $$;
create or replace function public.current_institution_id() returns uuid language sql stable security definer set search_path = '' as $$ select institution_id from public.profiles where id = (select auth.uid()) $$;
create or replace function public.current_status() returns public.account_status language sql stable security definer set search_path = '' as $$ select status from public.profiles where id = (select auth.uid()) $$;
create or replace function public.employer_verification(target_id uuid) returns public.account_status language sql stable security definer set search_path = '' as $$ select verification_status from public.employers where id=target_id $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and status='active') $$;
create or replace function public.is_placement_student(target_placement uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.placements p where p.id=target_placement and p.student_id=(select auth.uid())) $$;
create or replace function public.is_assigned_supervisor(target_placement uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.placements p join public.supervisors s on s.id in (p.workplace_supervisor_id,p.academic_supervisor_id) where p.id=target_placement and s.user_id=(select auth.uid())) $$;

-- New signups are always ordinary student accounts. Never trust role metadata sent by a browser.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare default_institution uuid; requested public.app_role := 'student'; allowed_domains jsonb;
begin
 requested := case new.raw_user_meta_data->>'requested_role' when 'employer' then 'employer'::public.app_role when 'workplace_supervisor' then 'workplace_supervisor'::public.app_role when 'academic_supervisor' then 'academic_supervisor'::public.app_role else 'student'::public.app_role end;
 select id into default_institution from public.institutions where slug='must' and is_active=true limit 1;
 if default_institution is null then raise exception 'InternLog institution is not configured'; end if;
 select value into allowed_domains from public.settings where institution_id=default_institution and key='allowed_email_domains';
 if not (coalesce(allowed_domains,'["must.ac.ug"]'::jsonb) ? split_part(lower(new.email),'@',2)) then raise exception 'Use an approved university email domain'; end if;
 insert into public.profiles(id,institution_id,role,requested_role,status,full_name,email)
 values(new.id,default_institution,'student',requested,'pending',coalesce(new.raw_user_meta_data->>'full_name',''),new.email);
 insert into public.student_profiles(user_id,institution_id) values(new.id,default_institution);
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

do $$ declare t text; begin
 foreach t in array array['institutions','profiles','student_profiles','employers','supervisors','opportunities','applications','interviews','placements','placement_agreements','logbook_entries','attendance','visits','evaluations','rubrics','grade_components','grades','documents','messages','notifications','announcements','reports_disputes','reviews','cookie_consents','audit_logs','settings'] loop
  execute format('drop trigger if exists set_updated_at on public.%I',t);
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='updated_at') then
   execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
  end if;
 end loop;
end $$;

-- All tables are RLS protected. Admin policy is generated for each table; all other policies are explicit below.
do $$ declare t text; begin
 foreach t in array array['institutions','profiles','student_profiles','employers','supervisors','opportunities','applications','interviews','placements','placement_agreements','logbook_entries','attendance','visits','evaluations','rubrics','grade_components','grades','documents','messages','notifications','announcements','reports_disputes','reviews','cookie_consents','audit_logs','settings'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists admin_all on public.%I',t);
  execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',t);
 end loop;
end $$;

-- Institution metadata is visible to authenticated users in their own institution.
drop policy if exists institution_read on public.institutions;
create policy institution_read on public.institutions for select to authenticated using (id=public.current_institution_id());
drop policy if exists profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated using (id=auth.uid() or (role='student' and exists(select 1 from public.student_profiles sp where sp.user_id=profiles.id and sp.institution_id=public.current_institution_id() and sp.discoverable and sp.profile_visibility='employers') and public.current_role()='employer') or (role='student' and exists(select 1 from public.placements p join public.supervisors s on s.id in (p.workplace_supervisor_id,p.academic_supervisor_id) where p.student_id=profiles.id and s.user_id=auth.uid())));
drop policy if exists profile_update_self on public.profiles;
create policy profile_update_self on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and role=public.current_role() and status=public.current_status() and institution_id=public.current_institution_id());
drop policy if exists student_profile_read on public.student_profiles;
create policy student_profile_read on public.student_profiles for select to authenticated using (user_id=auth.uid() or (institution_id=public.current_institution_id() and discoverable and profile_visibility='employers' and public.current_role()='employer') or (public.current_role() in ('academic_supervisor','workplace_supervisor') and exists(select 1 from public.placements p join public.supervisors s on s.id in (p.workplace_supervisor_id,p.academic_supervisor_id) where p.student_id=user_id and s.user_id=auth.uid())));
drop policy if exists student_profile_update_self on public.student_profiles;
create policy student_profile_update_self on public.student_profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and institution_id=public.current_institution_id());
drop policy if exists student_profile_insert_self on public.student_profiles;
create policy student_profile_insert_self on public.student_profiles for insert to authenticated with check (user_id=auth.uid() and institution_id=public.current_institution_id());
drop policy if exists employer_read_own on public.employers;
create policy employer_read_own on public.employers for select to authenticated using (owner_user_id=auth.uid() or (verification_status='active' and institution_id=public.current_institution_id()));
drop policy if exists employer_insert_self on public.employers;
create policy employer_insert_self on public.employers for insert to authenticated with check (owner_user_id=auth.uid() and institution_id=public.current_institution_id());
drop policy if exists employer_update_own on public.employers;
create policy employer_update_own on public.employers for update to authenticated using (owner_user_id=auth.uid()) with check (owner_user_id=auth.uid() and verification_status=public.employer_verification(employers.id));
drop policy if exists supervisor_read_self_or_assigned on public.supervisors;
create policy supervisor_read_self_or_assigned on public.supervisors for select to authenticated using (user_id=auth.uid() or (institution_id=public.current_institution_id() and public.current_role()='admin'));
drop policy if exists opportunities_read_published on public.opportunities;
create policy opportunities_read_published on public.opportunities for select to authenticated using (status='published' and institution_id=public.current_institution_id() or exists(select 1 from public.employers e where e.id=employer_id and e.owner_user_id=auth.uid()));
drop policy if exists opportunities_employer_insert on public.opportunities;
create policy opportunities_employer_insert on public.opportunities for insert to authenticated with check (institution_id=public.current_institution_id() and exists(select 1 from public.employers e where e.id=employer_id and e.owner_user_id=auth.uid() and e.verification_status='active'));
drop policy if exists opportunities_employer_update on public.opportunities;
create policy opportunities_employer_update on public.opportunities for update to authenticated using (exists(select 1 from public.employers e where e.id=employer_id and e.owner_user_id=auth.uid())) with check (exists(select 1 from public.employers e where e.id=employer_id and e.owner_user_id=auth.uid()));
drop policy if exists applications_student_all on public.applications;
drop policy if exists applications_student_read on public.applications;
create policy applications_student_read on public.applications for select to authenticated using (student_id=auth.uid());
drop policy if exists applications_student_insert on public.applications;
create policy applications_student_insert on public.applications for insert to authenticated with check (student_id=auth.uid() and institution_id=public.current_institution_id());
drop policy if exists applications_employer_read on public.applications;
create policy applications_employer_read on public.applications for select to authenticated using (exists(select 1 from public.opportunities o join public.employers e on e.id=o.employer_id where o.id=opportunity_id and e.owner_user_id=auth.uid()));
drop policy if exists applications_employer_update on public.applications;
create policy applications_employer_update on public.applications for update to authenticated using (exists(select 1 from public.opportunities o join public.employers e on e.id=o.employer_id where o.id=opportunity_id and e.owner_user_id=auth.uid())) with check (exists(select 1 from public.opportunities o join public.employers e on e.id=o.employer_id where o.id=opportunity_id and e.owner_user_id=auth.uid()));
drop policy if exists placements_student_read on public.placements;
drop policy if exists interviews_application_participant_read on public.interviews;
create policy interviews_application_participant_read on public.interviews for select to authenticated using (exists(select 1 from public.applications a where a.id=application_id and (a.student_id=auth.uid() or exists(select 1 from public.opportunities o join public.employers e on e.id=o.employer_id where o.id=a.opportunity_id and e.owner_user_id=auth.uid()))));
drop policy if exists interviews_employer_insert on public.interviews;
create policy interviews_employer_insert on public.interviews for insert to authenticated with check (exists(select 1 from public.applications a join public.opportunities o on o.id=a.opportunity_id join public.employers e on e.id=o.employer_id where a.id=application_id and e.owner_user_id=auth.uid() and created_by=auth.uid()));
drop policy if exists agreements_participant_read on public.placement_agreements;
create policy agreements_participant_read on public.placement_agreements for select to authenticated using (public.is_placement_student(placement_id) or public.is_assigned_supervisor(placement_id) or exists(select 1 from public.placements p join public.employers e on e.id=p.employer_id where p.id=placement_id and e.owner_user_id=auth.uid()));
drop policy if exists agreements_student_accept on public.placement_agreements;
create policy agreements_student_accept on public.placement_agreements for update to authenticated using (public.is_placement_student(placement_id)) with check (public.is_placement_student(placement_id));
drop policy if exists visits_student_read on public.visits;
create policy visits_student_read on public.visits for select to authenticated using (public.is_placement_student(placement_id));
drop policy if exists visits_supervisor_write on public.visits;
create policy visits_supervisor_write on public.visits for all to authenticated using (exists(select 1 from public.supervisors s where s.id=academic_supervisor_id and s.user_id=auth.uid())) with check (exists(select 1 from public.supervisors s where s.id=academic_supervisor_id and s.user_id=auth.uid()));
drop policy if exists grades_admin_supervisor_draft on public.grades;
create policy grades_admin_supervisor_draft on public.grades for all to authenticated using (public.is_assigned_supervisor(placement_id)) with check (public.is_assigned_supervisor(placement_id));
drop policy if exists grade_components_supervisor_read on public.grade_components;
create policy grade_components_supervisor_read on public.grade_components for select to authenticated using (institution_id=public.current_institution_id() and public.current_role() in ('academic_supervisor','workplace_supervisor'));
drop policy if exists rubrics_supervisor_read on public.rubrics;
create policy rubrics_supervisor_read on public.rubrics for select to authenticated using (institution_id=public.current_institution_id() and public.current_role() in ('academic_supervisor','workplace_supervisor'));
drop policy if exists employers_supervisor_read on public.employers;
create policy employers_supervisor_read on public.employers for select to authenticated using (exists(select 1 from public.placements p where p.employer_id=employers.id and public.is_assigned_supervisor(p.id)));
drop policy if exists reports_assignee_update on public.reports_disputes;
create policy reports_assignee_update on public.reports_disputes for update to authenticated using (assigned_to=auth.uid()) with check (assigned_to=auth.uid());
drop policy if exists announcements_admin_insert on public.announcements;
create policy announcements_admin_insert on public.announcements for insert to authenticated with check (public.is_admin() and author_id=auth.uid());
drop policy if exists placements_student_read on public.placements;
create policy placements_student_read on public.placements for select to authenticated using (student_id=auth.uid());
drop policy if exists placements_employer_read on public.placements;
create policy placements_employer_read on public.placements for select to authenticated using (exists(select 1 from public.employers e where e.id=employer_id and e.owner_user_id=auth.uid()));
drop policy if exists placements_supervisor_read on public.placements;
create policy placements_supervisor_read on public.placements for select to authenticated using (public.is_assigned_supervisor(id));
drop policy if exists logbook_student_all on public.logbook_entries;
create policy logbook_student_all on public.logbook_entries for all to authenticated using (student_id=auth.uid() and status in ('draft','returned')) with check (student_id=auth.uid() and status in ('draft','submitted','returned'));
drop policy if exists logbook_supervisor_read on public.logbook_entries;
create policy logbook_supervisor_read on public.logbook_entries for select to authenticated using (public.is_assigned_supervisor(placement_id));
drop policy if exists logbook_supervisor_review on public.logbook_entries;
create policy logbook_supervisor_review on public.logbook_entries for update to authenticated using (public.is_assigned_supervisor(placement_id)) with check (public.is_assigned_supervisor(placement_id) and student_id=(select p.student_id from public.placements p where p.id=placement_id));
drop policy if exists attendance_student_read_insert on public.attendance;
drop policy if exists attendance_student_read on public.attendance;
create policy attendance_student_read on public.attendance for select to authenticated using (student_id=auth.uid());
drop policy if exists attendance_student_insert on public.attendance;
create policy attendance_student_insert on public.attendance for insert to authenticated with check (student_id=auth.uid() and institution_id=public.current_institution_id() and confirmed_by is null);
drop policy if exists attendance_supervisor_read_update on public.attendance;
create policy attendance_supervisor_read_update on public.attendance for all to authenticated using (public.is_assigned_supervisor(placement_id)) with check (public.is_assigned_supervisor(placement_id));
drop policy if exists visits_assigned_read on public.visits;
create policy visits_assigned_read on public.visits for select to authenticated using (exists(select 1 from public.supervisors s where s.id=academic_supervisor_id and s.user_id=auth.uid()) or public.is_placement_student(placement_id));
drop policy if exists evaluations_assigned_read on public.evaluations;
create policy evaluations_assigned_read on public.evaluations for select to authenticated using (evaluator_id=auth.uid() or public.is_placement_student(placement_id) and status='submitted' or public.is_assigned_supervisor(placement_id));
drop policy if exists evaluations_evaluator_write on public.evaluations;
create policy evaluations_evaluator_write on public.evaluations for all to authenticated using (evaluator_id=auth.uid()) with check (evaluator_id=auth.uid() and institution_id=public.current_institution_id());
drop policy if exists rubrics_read_active on public.rubrics;
create policy rubrics_read_active on public.rubrics for select to authenticated using (institution_id=public.current_institution_id() and is_active);
drop policy if exists grade_components_read on public.grade_components;
create policy grade_components_read on public.grade_components for select to authenticated using (institution_id=public.current_institution_id());
drop policy if exists grades_student_published on public.grades;
create policy grades_student_published on public.grades for select to authenticated using (student_id=auth.uid() and status='published');
drop policy if exists grades_supervisor_read on public.grades;
create policy grades_supervisor_read on public.grades for select to authenticated using (public.is_assigned_supervisor(placement_id));
drop policy if exists documents_owner_all on public.documents;
create policy documents_owner_all on public.documents for all to authenticated using (owner_user_id=auth.uid()) with check (owner_user_id=auth.uid() and institution_id=public.current_institution_id());
drop policy if exists documents_assigned_read on public.documents;
create policy documents_assigned_read on public.documents for select to authenticated using (placement_id is not null and public.is_assigned_supervisor(placement_id));
drop policy if exists messages_participant_read on public.messages;
create policy messages_participant_read on public.messages for select to authenticated using (sender_id=auth.uid() or recipient_id=auth.uid());
drop policy if exists messages_sender_insert on public.messages;
create policy messages_sender_insert on public.messages for insert to authenticated with check (sender_id=auth.uid() and institution_id=public.current_institution_id());
drop policy if exists messages_recipient_update on public.messages;
create policy messages_recipient_update on public.messages for update to authenticated using (recipient_id=auth.uid()) with check (recipient_id=auth.uid());
drop policy if exists notifications_owner_all on public.notifications;
drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications for select to authenticated using (user_id=auth.uid());
drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists announcements_audience_read on public.announcements;
create policy announcements_audience_read on public.announcements for select to authenticated using (published_at is not null and (audience @> array[public.current_role()]::public.app_role[] or public.is_admin()));
drop policy if exists reports_reporter_read_insert on public.reports_disputes;
create policy reports_reporter_read_insert on public.reports_disputes for select to authenticated using (reporter_id=auth.uid() or assigned_to=auth.uid());
drop policy if exists reports_reporter_insert on public.reports_disputes;
create policy reports_reporter_insert on public.reports_disputes for insert to authenticated with check (reporter_id=auth.uid() and institution_id=public.current_institution_id());
drop policy if exists reviews_student_all on public.reviews;
create policy reviews_student_all on public.reviews for all to authenticated using (student_id=auth.uid() and public.is_placement_student(placement_id)) with check (student_id=auth.uid() and public.is_placement_student(placement_id) and institution_id=public.current_institution_id());
drop policy if exists reviews_published_read on public.reviews;
create policy reviews_published_read on public.reviews for select to authenticated using (is_published and institution_id=public.current_institution_id());
drop policy if exists cookie_consent_insert on public.cookie_consents;
create policy cookie_consent_insert on public.cookie_consents for insert to anon,authenticated with check ((user_id is null and anonymous_id <> '') or user_id=auth.uid());
drop policy if exists cookie_consent_owner_read on public.cookie_consents;
create policy cookie_consent_owner_read on public.cookie_consents for select to authenticated using (user_id=auth.uid());
drop policy if exists cookie_consent_owner_withdraw on public.cookie_consents;
create policy cookie_consent_owner_withdraw on public.cookie_consents for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists audit_actor_read on public.audit_logs;
create policy audit_actor_read on public.audit_logs for select to authenticated using (actor_id=auth.uid());
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (institution_id=public.current_institution_id());

-- RLS-aware dashboard views. security_invoker ensures underlying table policies remain in force.
create or replace view public.student_placement_overview with (security_invoker = true) as
select p.id as placement_id, p.student_id, p.employer_id, p.start_date, p.end_date, p.status,
       e.company_name, o.title as opportunity_title
from public.placements p
join public.employers e on e.id=p.employer_id
join public.applications a on a.id=p.application_id
join public.opportunities o on o.id=a.opportunity_id
where p.student_id=auth.uid() or public.is_assigned_supervisor(p.id);

create or replace view public.institution_dashboard_counts with (security_invoker = true) as
select institution_id,
       count(*) filter (where role='student') as student_accounts,
       count(*) filter (where role='employer') as employer_accounts,
       count(*) filter (where role='student' and status='active') as active_students,
       count(*) filter (where role='student' and status='pending') as pending_students
from public.profiles
where public.is_admin() and institution_id=public.current_institution_id()
group by institution_id;

-- Column-level grants prevent self-service users from editing approval and ownership fields.
revoke update on public.profiles from authenticated;
grant update(full_name,phone,avatar_path,bio) on public.profiles to authenticated;
revoke update on public.student_profiles from authenticated;
grant update(skills,preferred_fields,preferred_locations,discoverable,profile_visibility) on public.student_profiles to authenticated;
revoke update on public.employers from authenticated;
grant update(company_name,registration_number,industry,description,website,location) on public.employers to authenticated;
revoke update on public.applications from authenticated;
grant update(status,employer_note) on public.applications to authenticated;
revoke insert,update,delete on public.notifications from authenticated;
grant insert on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
revoke update on public.cookie_consents from authenticated;
grant update(withdrawn_at) on public.cookie_consents to authenticated;

-- Private buckets. Files are never public; signed URLs should be issued after an authorization check.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('internlog-documents','internlog-documents',false,10485760,array['application/pdf','image/jpeg','image/png']),
 ('internlog-avatars','internlog-avatars',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists internlog_storage_read_own on storage.objects;
create policy internlog_storage_read_own on storage.objects for select to authenticated using (bucket_id in ('internlog-documents','internlog-avatars') and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists internlog_storage_insert_own on storage.objects;
create policy internlog_storage_insert_own on storage.objects for insert to authenticated with check (bucket_id in ('internlog-documents','internlog-avatars') and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists internlog_storage_update_own on storage.objects;
create policy internlog_storage_update_own on storage.objects for update to authenticated using (bucket_id in ('internlog-documents','internlog-avatars') and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id in ('internlog-documents','internlog-avatars') and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists internlog_storage_delete_own on storage.objects;
create policy internlog_storage_delete_own on storage.objects for delete to authenticated using (bucket_id in ('internlog-documents','internlog-avatars') and (storage.foldername(name))[1]=auth.uid()::text);

-- Institution bootstrap and default grading weights.
insert into public.institutions(name,slug,email_domain,country_code,timezone,currency_code)
values('Mbarara University of Science and Technology','must','must.ac.ug','UG','Africa/Kampala','UGX')
on conflict(slug) do update set name=excluded.name, timezone=excluded.timezone, currency_code=excluded.currency_code;
insert into public.settings(institution_id,key,value,description)
select id,'allowed_email_domains','["must.ac.ug"]'::jsonb,'Approved university email domains; update after confirming MUST IT policy' from public.institutions where slug='must'
on conflict(institution_id,key) do nothing;
insert into public.settings(institution_id,key,value,description)
select id,'grade_weights','{"workplace_evaluation":40,"academic_visit":30,"report":20,"logbook":10}'::jsonb,'Default placement grade weights (percentages)' from public.institutions where slug='must'
on conflict(institution_id,key) do nothing;
commit;
