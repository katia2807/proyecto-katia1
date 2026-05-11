import { isDemoDatabaseMode } from "@/lib/demo-mode";
import { getServerSupabaseCredentials } from "@/lib/supabase/temp-credentials";

export function hasSupabaseEnv() {
  if (isDemoDatabaseMode()) return false;
  const { url, anonKey, serviceRoleKey } = getServerSupabaseCredentials();
  return Boolean(url && anonKey && serviceRoleKey);
}
