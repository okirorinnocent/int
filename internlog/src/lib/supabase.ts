import { createClient } from '@supabase/supabase-js';
import { publicEnv } from './env';

export const supabase = createClient(publicEnv.VITE_SUPABASE_URL, publicEnv.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { headers: { 'X-Client-Info': 'internlog-web' } },
});
