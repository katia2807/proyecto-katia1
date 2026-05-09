import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_ORG_NAME = "Proyecto Katia";
const DEFAULT_ROLE = "owner_admin";

function readTempCredentials() {
  const filePath = join(process.cwd(), "temp", "supabase.temp.txt");
  const raw = readFileSync(filePath, "utf8");
  const creds = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep <= 0) continue;
    const key = trimmed.slice(0, sep).trim();
    const value = trimmed.slice(sep + 1).trim();
    creds[key] = value;
  }

  return {
    url: creds.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: creds.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: creds.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function buildCredentials() {
  const stamp = Date.now();
  const email = `admin.katia.${stamp}@local.test`;
  const password = `Katia!${String(stamp).slice(-8)}Aa`;
  return { email, password };
}

async function main() {
  const { url, anonKey, serviceRoleKey } = readTempCredentials();

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Faltan credenciales en temp/supabase.temp.txt. Completa NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { email, password } = buildCredentials();

  const { data: createdUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Admin Katia Temporal",
    },
  });

  if (authError || !createdUser?.user?.id) {
    throw new Error(authError?.message ?? "No se pudo crear usuario en Supabase Auth.");
  }

  const userId = createdUser.user.id;

  const { error: orgError } = await supabase.from("organizations").upsert(
    {
      id: DEFAULT_ORG_ID,
      name: DEFAULT_ORG_NAME,
    },
    { onConflict: "id" },
  );

  if (orgError) {
    throw new Error(`No se pudo asegurar organización: ${orgError.message}`);
  }

  const { error: profileError } = await supabase.from("perfiles").upsert(
    {
      user_id: userId,
      organization_id: DEFAULT_ORG_ID,
      role: DEFAULT_ROLE,
      full_name: "Admin Katia Temporal",
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    throw new Error(`No se pudo crear perfil de acceso: ${profileError.message}`);
  }

  const outputPath = join(process.cwd(), "temp", "login.credentials.txt");
  writeFileSync(
    outputPath,
    [
      "# Credenciales temporales de acceso (eliminar al finalizar)",
      `EMAIL=${email}`,
      `PASSWORD=${password}`,
      `ROLE=${DEFAULT_ROLE}`,
      `ORG_ID=${DEFAULT_ORG_ID}`,
      `CREATED_AT=${new Date().toISOString()}`,
    ].join("\n"),
    "utf8",
  );

  console.log(`Usuario temporal creado: ${email}`);
  console.log(`Credenciales guardadas en: temp/login.credentials.txt`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
