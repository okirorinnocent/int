-- InternLog auth hardening migration
-- Apply in Supabase SQL Editor after reviewing against your deployed schema.
-- This makes the database, not the client, decide the role of every self-registered account.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Never trust role or status supplied through auth.users.raw_user_meta_data.
  -- Self-service signup always creates an active student. A separate audited,
  -- server-authorized workflow must grant supervisor or administrator roles.
  insert into public.profiles (id, role, status, full_name, email, organization_name)
  values (
    new.id,
    'student'::public.app_role,
    'active'::public.account_status,
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), 120), ''),
    new.email,
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'organization_name', '')), 160), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Verify that the existing auth.users trigger still points to public.handle_new_user().
-- Do not add a client-accessible policy that lets users update profiles.role or profiles.status.
