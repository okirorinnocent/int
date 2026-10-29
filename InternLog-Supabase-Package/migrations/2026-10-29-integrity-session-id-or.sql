-- InternLog security/integrity hardening migration
-- Review against your deployed schema, then apply in Supabase SQL Editor.
-- All authorization remains in PostgreSQL RLS/triggers; client guards are UX only.

-- Never count submitted, draft, feedback, or changes-requested hours as official progress.
create or replace function public.get_dashboard() returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  r public.app_role := public.current_role_();
  me public.profiles%rowtype;
  o jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into me from public.profiles where id = uid;
  if not found then return jsonb_build_object('role', null); end if;
  o := jsonb_build_object('user_id', uid, 'role', me.role, 'status', me.status,
    'full_name', me.full_name, 'first_name', nullif(split_part(coalesce(me.full_name, ''), ' ', 1), ''),
    'onboarding_complete', me.onboarding_complete);
  if r is null then return o; end if;
  o := o || jsonb_build_object(
    'verified_hours', (select coalesce(sum(hours), 0) from public.logbooks where status = 'approved'),
    'pending_reviews', (select count(*) from public.logbooks where status = 'submitted'),
    'approved_entries', (select count(*) from public.logbooks where status = 'approved'),
    'open_placements', (select count(*) from public.placements where is_active and slots_left > 0 and (application_deadline is null or application_deadline >= current_date)),
    'weekly_hours', (select coalesce(jsonb_agg(jsonb_build_object('week', week_number, 'hours', h) order by week_number), '[]'::jsonb)
      from (select week_number, sum(hours) h from public.logbooks where status = 'approved' group by week_number) w),
    'recent_entries', (select coalesce(jsonb_agg(to_jsonb(x) order by x.entry_date desc), '[]'::jsonb)
      from (select id, entry_date, hours, status from public.logbooks order by entry_date desc limit 5) x));
  if r = 'student' then
    o := o || jsonb_build_object(
      'internship', (select to_jsonb(i) - 'application_id' from public.internships i where i.student_id = uid and i.status = 'active' limit 1),
      'target_hours', coalesce((select target_hours from public.internships where student_id = uid and status = 'active'), 320),
      'applications', jsonb_build_object('total', (select count(*) from public.applications where student_id = uid),
        'submitted', (select count(*) from public.applications where student_id = uid and status in ('submitted','under_review')),
        'accepted', (select count(*) from public.applications where student_id = uid and status = 'accepted')));
  elsif r in ('workplace_supervisor','academic_supervisor') then
    o := o || jsonb_build_object(
      'active_interns', (select count(*) from public.internships where status = 'active' and public.supervises(student_id)),
      'applications_to_review', (select count(*) from public.applications a where a.status in ('submitted','under_review') and public.owns_placement(a.placement_id)),
      'my_placements', (select count(*) from public.placements where created_by = uid));
  else
    o := o || jsonb_build_object(
      'students', (select count(*) from public.profiles where role = 'student'),
      'active_interns', (select count(*) from public.internships where status = 'active'),
      'host_organizations', (select count(distinct organization_name) from public.placements),
      'reports_submitted', (select count(*) from public.reports where status = 'submitted'),
      'pending_accounts', (select count(*) from public.profiles where status = 'pending'),
      'applications_total', (select count(*) from public.applications where status <> 'draft'));
  end if;
  return o;
end $$;

-- Enforce logbook rules in the database, including clients that bypass the UI.
create or replace function public.enforce_logbook_integrity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid()); role_now public.app_role := public.current_role_();
begin
  if new.entry_date > current_date then raise exception 'Logbook date cannot be in the future' using errcode = '22007'; end if;
  if new.hours is null or new.hours <= 0 or new.hours > 16 then raise exception 'Hours must be greater than zero and at most 16 per calendar date' using errcode = '22023'; end if;
  if new.week_number is not null and new.week_number not between 1 and 60 then raise exception 'Week must be between 1 and 60' using errcode = '22023'; end if;
  if new.tasks is null or char_length(btrim(new.tasks)) < 1 or char_length(new.tasks) > 4000 then raise exception 'Tasks must contain 1 to 4000 characters' using errcode = '22023'; end if;
  if new.skills is not null and char_length(new.skills) > 500 then raise exception 'Skills must be at most 500 characters' using errcode = '22023'; end if;
  if new.supervisor_comment is not null and char_length(new.supervisor_comment) > 2000 then raise exception 'Comment is too long' using errcode = '22023'; end if;
  -- Strip ASCII control characters. Output remains plain text and must be rendered escaped by the UI.
  new.tasks := regexp_replace(new.tasks, '[[:cntrl:]]', ' ', 'g');
  new.skills := regexp_replace(coalesce(new.skills, ''), '[[:cntrl:]]', ' ', 'g');
  new.supervisor_comment := regexp_replace(coalesce(new.supervisor_comment, ''), '[[:cntrl:]]', ' ', 'g');
  if tg_op = 'INSERT' then
    if caller is null or new.student_id <> caller or role_now <> 'student' then raise exception 'Only students can create their own entries' using errcode = '42501'; end if;
    if new.status not in ('draft','submitted') then raise exception 'New entries must be draft or submitted' using errcode = '42501'; end if;
    new.signed_by := null; new.signed_at := null; new.grade := null; new.supervisor_comment := null;
  else
    if new.id <> old.id or new.student_id <> old.student_id or new.internship_id <> old.internship_id then raise exception 'Entry ownership and parent cannot be changed' using errcode = '42501'; end if;
    if caller = old.student_id and role_now = 'student' then
      if old.status not in ('draft','changes_requested') or new.status not in ('draft','submitted') then raise exception 'Students may edit drafts or resubmit changes only' using errcode = '42501'; end if;
      new.signed_by := old.signed_by; new.signed_at := old.signed_at; new.grade := old.grade; new.supervisor_comment := old.supervisor_comment;
    elsif role_now in ('workplace_supervisor','academic_supervisor') and public.supervises(old.student_id) then
      if old.status <> 'submitted' or new.status not in ('approved','changes_requested','submitted') then raise exception 'Only submitted entries can be reviewed' using errcode = '42501'; end if;
      if new.status = 'approved' then new.signed_by := caller; new.signed_at := now(); else new.signed_by := null; new.signed_at := null; end if;
    elsif public.is_admin() then
      if new.status = 'approved' then new.signed_by := caller; new.signed_at := now(); end if;
    else raise exception 'Not authorized to change this logbook entry' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists logbook_integrity_guard on public.logbooks;
create trigger logbook_integrity_guard before insert or update on public.logbooks
for each row execute function public.enforce_logbook_integrity();

-- RLS is the IDOR boundary: a guessed UUID must not reveal or mutate another user's rows.
-- Keep these policies explicit even if UI route guards are bypassed.
drop policy if exists lb_select on public.logbooks;
create policy lb_select on public.logbooks for select to authenticated using (
  student_id = (select auth.uid()) or (status <> 'draft' and public.supervises(student_id)) or (select public.is_admin()));
drop policy if exists lb_student_insert on public.logbooks;
create policy lb_student_insert on public.logbooks for insert to authenticated
  with check (student_id = (select auth.uid()) and (select public.current_role_()) = 'student' and status in ('draft','submitted'));
drop policy if exists lb_update on public.logbooks;
create policy lb_update on public.logbooks for update to authenticated
  using ((student_id = (select auth.uid()) and (select public.current_role_()) = 'student' and status in ('draft','changes'))
    or (status = 'submitted' and public.supervises(student_id)) or (select public.is_admin()))
  with check ((student_id = (select auth.uid()) and (select public.current_role_()) = 'student' and status in ('draft','submitted'))
    or (public.supervises(student_id) and status in ('submitted','approved','changes_requested')) or (select public.is_admin()));

-- A profile owner may update profile fields but never role/status through table grants.
revoke update on public.profiles from authenticated;
grant update (full_name, phone_number, registration_number, faculty, program, year_of_study,
              organization_name, job_title, onboarding_complete) on public.profiles to authenticated;

-- Only approved hours count as official progress. Do not expose this function to anon.
revoke execute on function public.get_dashboard() from public, anon;
grant execute on function public.get_dashboard() to authenticated;
