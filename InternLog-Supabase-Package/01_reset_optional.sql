-- =====================================================================
-- InternLog — 01 RESET (OPTIONAL, DESTRUCTIVE)
-- Run this ONLY if you already ran the old phase2 / production_hardening
-- scripts and want to start clean. It deletes every row in the old app
-- tables (profiles, logbooks, applications, ...). Auth users are kept.
-- On a brand-new Supabase project skip this file.
-- =====================================================================

-- old event trigger + AI role from production_hardening
drop event trigger if exists rls_auto_enable_trg;
drop function if exists public.rls_auto_enable() cascade;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'internai_agent') then
    execute 'drop owned by internai_agent';
    execute 'drop role internai_agent';
  end if;
end $$;

-- auth hook
drop trigger if exists on_auth_user_created on auth.users;

-- old tables (CASCADE removes their policies / triggers / indexes)
drop table if exists public.ai_audit            cascade;
drop table if exists public.access_guard        cascade;
drop table if exists public.rate_limits         cascade;
drop table if exists public.messages            cascade;
drop table if exists public.announcements       cascade;
drop table if exists public.reports             cascade;
drop table if exists public.logbooks            cascade;
drop table if exists public.applications        cascade;
drop table if exists public.student_assignments cascade;
drop table if exists public.internships         cascade;
drop table if exists public.placements          cascade;
drop table if exists public.profiles            cascade;

-- old functions
drop function if exists public.current_role_()                     cascade;
drop function if exists public.is_admin()                          cascade;
drop function if exists public.supervises(uuid)                    cascade;
drop function if exists public.handle_new_user()                   cascade;
drop function if exists public.protect_role()                      cascade;
drop function if exists public.protect_signature()                 cascade;
drop function if exists public.check_rate_limit(text,int,int)      cascade;
drop function if exists public.register_access(uuid,inet,text)     cascade;
drop function if exists public.enforce_user_limit()                cascade;

-- old types
drop type if exists public.application_status cascade;
drop type if exists public.app_role            cascade;

-- old storage policies (buckets can NOT be dropped with SQL; delete the old
-- empty buckets "resumes", "logbook_attachments", "signatures" in
-- Dashboard -> Storage if you no longer need them. "resumes" is reused.)
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
           and (policyname like 'resumes\_%' or policyname like 'logbook\_attachments\_%' or policyname like 'signatures\_%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;
