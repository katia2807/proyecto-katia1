import { getServerSupabaseCredentials } from "@/lib/supabase/temp-credentials";

export function hasSupabaseEnv() {
  const { url, anonKey, serviceRoleKey } = getServerSupabaseCredentials();
  return Boolean(url && anonKey && serviceRoleKey);
}
