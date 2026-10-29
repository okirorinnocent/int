import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export function getDeviceId() {
  const key = "internlog.deviceId";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const deviceId = crypto.randomUUID();
  window.localStorage.setItem(key, deviceId);
  return deviceId;
}
