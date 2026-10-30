-- Development seed. Create demo identities through Supabase Auth first; never insert plaintext passwords here.
-- The auth signup trigger creates a pending student profile. An administrator must promote/approve accounts.
insert into public.institutions(name,slug,email_domain,country_code,timezone,currency_code)
values ('Mbarara University of Science and Technology','must','must.ac.ug','UG','Africa/Kampala','UGX')
on conflict(slug) do nothing;
insert into public.settings(institution_id,key,value,description)
select id,'allowed_email_domains','["must.ac.ug"]'::jsonb,'Approved university email domains; confirm with MUST IT' from public.institutions where slug='must'
on conflict(institution_id,key) do nothing;
insert into public.settings(institution_id,key,value,description)
select id,'placement_periods','[{"name":"Semester Internship","start":"2027-01-05","end":"2027-04-30"}]'::jsonb,'Example placement period' from public.institutions where slug='must'
on conflict(institution_id,key) do nothing;
-- After creating Auth users, replace the UUIDs below and run the optional sample inserts.
-- Promote the first trusted account manually in SQL after verifying its identity:
-- update public.profiles set role='admin', status='active', approved_at=now() where id='AUTH_USER_UUID';
-- Add employer records only after a real employer account has been created:
-- insert into public.employers(institution_id,owner_user_id,company_name,industry,location,verification_status)
-- select i.id,'EMPLOYER_AUTH_UUID','MUST Demo Technologies','Information Technology','Mbarara','active'
-- from public.institutions i where i.slug='must';
-- Add opportunities and sample placements only after employer/student/supervisor auth identities exist.

-- Optional complete demo dataset. First create and email-confirm these five Auth users in
-- Supabase Dashboard > Authentication > Users (set passwords there, never in this file):
-- demo.admin@must.ac.ug, demo.student@must.ac.ug, demo.employer@must.ac.ug,
-- demo.workplace@must.ac.ug, demo.academic@must.ac.ug. Then run this seed again.
do $$
declare
  inst uuid;
  admin_user uuid;
  student_user uuid;
  employer_user uuid;
  workplace_user uuid;
  academic_user uuid;
  employer_record uuid;
  workplace_record uuid;
  academic_record uuid;
  opportunity_record uuid;
  application_record uuid;
  placement_record uuid;
begin
  select id into inst from public.institutions where slug='must';
  select id into admin_user from auth.users where lower(email)='demo.admin@must.ac.ug' limit 1;
  select id into student_user from auth.users where lower(email)='demo.student@must.ac.ug' limit 1;
  select id into employer_user from auth.users where lower(email)='demo.employer@must.ac.ug' limit 1;
  select id into workplace_user from auth.users where lower(email)='demo.workplace@must.ac.ug' limit 1;
  select id into academic_user from auth.users where lower(email)='demo.academic@must.ac.ug' limit 1;

  if inst is null or admin_user is null or student_user is null or employer_user is null or workplace_user is null or academic_user is null then
    raise notice 'Demo records not created. Create and confirm the five demo Auth users listed in seed.sql, then rerun this file.';
    return;
  end if;

  update public.profiles set role='admin', requested_role='admin', status='active', approved_at=now() where id=admin_user;
  update public.profiles set role='student', status='active', approved_at=now(), approved_by=admin_user where id=student_user;
  update public.profiles set role='employer', requested_role='employer', status='active', approved_at=now(), approved_by=admin_user where id=employer_user;
  update public.profiles set role='workplace_supervisor', requested_role='workplace_supervisor', status='active', approved_at=now(), approved_by=admin_user where id=workplace_user;
  update public.profiles set role='academic_supervisor', requested_role='academic_supervisor', status='active', approved_at=now(), approved_by=admin_user where id=academic_user;

  update public.student_profiles set student_number='DEMO-2026-001', programme='BSc Computer Science', course='Computer Science', year_of_study=1,
    skills=array['Python','C','SQL','Problem solving'], discoverable=true, profile_visibility='employers'
  where user_id=student_user;

  select id into employer_record from public.employers where owner_user_id=employer_user and institution_id=inst limit 1;
  if employer_record is null then
    insert into public.employers(institution_id,owner_user_id,company_name,registration_number,industry,description,website,location,verification_status,verified_at,verified_by)
    values(inst,employer_user,'Lakeview Digital Solutions','DEMO-REG-001','Information Technology','A demonstration software and digital services employer.','https://example.com','Mbarara, Uganda','active',now(),admin_user)
    returning id into employer_record;
  end if;

  select id into workplace_record from public.supervisors where user_id=workplace_user and supervisor_type='workplace_supervisor' limit 1;
  if workplace_record is null then
    insert into public.supervisors(institution_id,user_id,employer_id,supervisor_type,department,workload_limit)
    values(inst,workplace_user,employer_record,'workplace_supervisor','Engineering',8) returning id into workplace_record;
  end if;
  select id into academic_record from public.supervisors where user_id=academic_user and supervisor_type='academic_supervisor' limit 1;
  if academic_record is null then
    insert into public.supervisors(institution_id,user_id,supervisor_type,department,workload_limit)
    values(inst,academic_user,'academic_supervisor','Computer Science',12) returning id into academic_record;
  end if;

  select id into opportunity_record from public.opportunities where employer_id=employer_record and title='Junior Software Developer Intern' limit 1;
  if opportunity_record is null then
    insert into public.opportunities(institution_id,employer_id,title,description,opportunity_type,field,location,is_paid,stipend_ugx,duration_weeks,required_skills,status,published_at)
    values(inst,employer_record,'Junior Software Developer Intern','Build and test internal web tools with a mentor. This is demonstration content, not a live vacancy.','internship','Software Development','Mbarara, Uganda',true,250000,12,array['Python','SQL','Git'],'published',now())
    returning id into opportunity_record;
  end if;

  select id into application_record from public.applications where opportunity_id=opportunity_record and student_id=student_user limit 1;
  if application_record is null then
    insert into public.applications(institution_id,opportunity_id,student_id,cover_note,status,match_score)
    values(inst,opportunity_record,student_user,'I am interested in applying my programming and problem-solving skills in a practical team.','accepted',86.50)
    returning id into application_record;
  end if;

  select id into placement_record from public.placements where application_id=application_record limit 1;
  if placement_record is null then
    insert into public.placements(institution_id,application_id,student_id,employer_id,workplace_supervisor_id,academic_supervisor_id,start_date,end_date,status,approved_by,approved_at)
    values(inst,application_record,student_user,employer_record,workplace_record,academic_record,current_date-14,current_date+70,'active',admin_user,now())
    returning id into placement_record;
  end if;

  insert into public.placement_agreements(institution_id,placement_id,student_accepted_at,employer_accepted_at,institution_accepted_at)
  select inst,placement_record,now(),now(),now() where not exists(select 1 from public.placement_agreements where placement_id=placement_record);
  insert into public.logbook_entries(institution_id,placement_id,student_id,entry_date,period,activities,learning_outcomes,hours,status,reviewed_by,reviewed_at)
  select inst,placement_record,student_user,current_date-1,'daily','Reviewed a Python API endpoint and added input validation.','Practised validation and version control.',7,'approved',workplace_user,now()
  where not exists(select 1 from public.logbook_entries where placement_id=placement_record and entry_date=current_date-1);
  insert into public.logbook_entries(institution_id,placement_id,student_id,entry_date,period,activities,learning_outcomes,hours,status)
  select inst,placement_record,student_user,current_date,'daily','Prepared test cases for a small reporting feature.','Improved test design and debugging.',6,'draft'
  where not exists(select 1 from public.logbook_entries where placement_id=placement_record and entry_date=current_date);
  insert into public.attendance(institution_id,placement_id,student_id,attendance_date,check_in_at,check_out_at,confirmed_by,notes)
  select inst,placement_record,student_user,current_date-1,now()-interval '1 day',now()-interval '1 day'+interval '7 hours',workplace_user,'Demo attendance record'
  where not exists(select 1 from public.attendance where placement_id=placement_record and attendance_date=current_date-1);
  insert into public.visits(institution_id,placement_id,academic_supervisor_id,scheduled_at,completed_at,notes)
  select inst,placement_record,academic_record,now()-interval '3 days',now()-interval '3 days','Demonstration academic supervision visit'
  where not exists(select 1 from public.visits where placement_id=placement_record and notes='Demonstration academic supervision visit');
  insert into public.evaluations(institution_id,placement_id,evaluator_id,evaluator_role,scores,comments,recommendation,status,submitted_at)
  select inst,placement_record,workplace_user,'workplace_supervisor',
    '{"punctuality":4,"technical_skills":4,"teamwork":5,"initiative":4,"communication":4,"professionalism":5}'::jsonb,
    'Demonstration evaluation only.','Recommend for continued development.','submitted',now()
  where not exists(select 1 from public.evaluations where placement_id=placement_record and evaluator_id=workplace_user);
  insert into public.grades(institution_id,placement_id,student_id,component_scores,total_score,grade_letter,status,published_at)
  select inst,placement_record,student_user,'{"workplace_evaluation":34,"academic_visit":26,"report":16,"logbook":8}'::jsonb,84,'A','published',now()
  where not exists(select 1 from public.grades where placement_id=placement_record);
end $$;
