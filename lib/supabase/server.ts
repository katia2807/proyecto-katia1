import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseCredentials } from "@/lib/supabase/temp-credentials";

export function getSupabaseServerClient() {
  const { url, serviceRoleKey } = getServerSupabaseCredentials();
  const key = serviceRoleKey;

  if (!url || !key) {
    throw new Error(
      "Falta configurar Supabase. Usa .env.local o temp/supabase.temp.txt.",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
