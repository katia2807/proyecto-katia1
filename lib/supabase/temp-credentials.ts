import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isDemoDatabaseMode } from "@/lib/demo-mode";

type TempSupabaseCredentials = {
  url?: string;
  anonKey?: string;
  serviceRoleKey?: string;
};

function parseTxtCredentials(raw: string): TempSupabaseCredentials {
  const result: TempSupabaseCredentials = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!value) continue;

    if (key === "NEXT_PUBLIC_SUPABASE_URL") result.url = value;
    if (key === "NEXT_PUBLIC_SUPABASE_ANON_KEY") result.anonKey = value;
    if (key === "SUPABASE_SERVICE_ROLE_KEY") result.serviceRoleKey = value;
  }
  return result;
}

function readTempCredentialsFile(): TempSupabaseCredentials | null {
  try {
    const filePath = join(process.cwd(), "temp", "supabase.temp.txt");
    const raw = readFileSync(filePath, "utf8");
    const parsed = parseTxtCredentials(raw);
    return parsed;
  } catch {
    return null;
  }
}

export function getServerSupabaseCredentials() {
  if (isDemoDatabaseMode()) {
    return { url: undefined, anonKey: undefined, serviceRoleKey: undefined };
  }

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const envService = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (envUrl && envAnon) {
    const isProd = process.env.NODE_ENV === "production";
    if (isProd && !envService) {
      return { url: envUrl, anonKey: envAnon, serviceRoleKey: undefined };
    }
    return {
      url: envUrl,
      anonKey: envAnon,
      serviceRoleKey: envService ?? (!isProd ? envAnon : undefined),
    };
  }

  const tempCredentials = readTempCredentialsFile();
  const tempUrl = tempCredentials?.url?.trim();
  const tempAnon = tempCredentials?.anonKey?.trim();
  const tempService = tempCredentials?.serviceRoleKey?.trim();

  return {
    url: tempUrl,
    anonKey: tempAnon,
    serviceRoleKey: tempService ?? (process.env.NODE_ENV !== "production" ? tempAnon : undefined),
  };
}
