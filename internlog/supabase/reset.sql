-- DESTRUCTIVE: development reset only. This removes InternLog public data and private storage objects.
begin;
delete from storage.objects where bucket_id in ('internlog-documents','internlog-avatars');
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
-- Re-run supabase/schema.sql after this script. Supabase-managed auth/storage schemas are untouched.
commit;
