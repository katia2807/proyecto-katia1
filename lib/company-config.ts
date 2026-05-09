import { DEFAULT_ORG_ID } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type EmpresaConfig = {
  nombre: string;
  ruc: string;
  telefono: string;
  direccion: string;
  firmante: string;
  /** URL pública en Supabase Storage (`empresa-logos`). */
  logo_url: string | null;
};

export const DEFAULT_EMPRESA_CONFIG: EmpresaConfig = {
  nombre: "KATIA LIZZET MENESES TAYPE",
  ruc: "10739957520",
  telefono: "987 654 321",
  direccion: "Lima, Peru",
  firmante: "Katia Lizzet Meneses Taype",
  logo_url: null,
};

export async function getEmpresaConfig(): Promise<EmpresaConfig> {
  if (!hasSupabaseEnv()) {
    return DEFAULT_EMPRESA_CONFIG;
  }

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("configuracion_empresa")
    .select("nombre,ruc,telefono,direccion,firmante,logo_url")
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (!data) {
    return DEFAULT_EMPRESA_CONFIG;
  }

  return {
    nombre: String(data.nombre ?? DEFAULT_EMPRESA_CONFIG.nombre),
    ruc: String(data.ruc ?? DEFAULT_EMPRESA_CONFIG.ruc),
    telefono: String(data.telefono ?? DEFAULT_EMPRESA_CONFIG.telefono),
    direccion: String(data.direccion ?? DEFAULT_EMPRESA_CONFIG.direccion),
    firmante: String(data.firmante ?? DEFAULT_EMPRESA_CONFIG.firmante),
    logo_url: typeof data.logo_url === "string" && data.logo_url.trim() !== "" ? data.logo_url.trim() : null,
  };
}
