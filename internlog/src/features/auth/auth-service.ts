import { supabase } from '../../lib/supabase';
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from './auth-schema';

export async function signUp(input: SignupInput): Promise<void> {
  const data = signupSchema.parse(input);
  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: { data: { full_name: data.fullName, requested_role: data.role } },
  });
  if (error) throw new Error(error.message);
}

export async function signIn(input: LoginInput): Promise<void> {
  const data = loginSchema.parse(input);
  const { data: session, error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
  if (error) throw new Error(error.message);
  if (!session.user) throw new Error('Authentication did not return a user.');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('status').eq('id', session.user.id).single();
  if (profileError || profile.status !== 'active') {
    await supabase.auth.signOut();
    throw new Error('Your account is awaiting institutional approval. Please contact the InternLog administrator.');
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}
