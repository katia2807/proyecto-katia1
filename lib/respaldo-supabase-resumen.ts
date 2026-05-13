import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getServerSupabaseCredentials } from "@/lib/supabase/temp-credentials";

export type TablaResumen = {
  table: string;
  label: string;
  count: number | null;
  error?: string;
};

export type RespaldoSupabaseResumen = {
  projectHost: string;
  connectionOk: boolean;
  connectionError?: string;
  organizationNamesSample: string[];
  tables: TablaResumen[];
  fetchedAtIso: string;
};

const TABLES: { table: string; label: string }[] = [
  { table: "organizations", label: "Organizaciones" },
  { table: "perfiles", label: "Perfiles de usuario" },
  { table: "clientes", label: "Clientes" },
  { table: "empleados", label: "Empleados" },
  { table: "movimientos_caja", label: "Movimientos de caja" },
  { table: "registros_generales", label: "Registros" },
  { table: "inventario_productos", label: "Productos (inventario)" },
];

function supabaseProjectHost(url: string | undefined): string {
  if (!url?.trim()) return "—";
  try {
    return new URL(url.trim()).hostname;
  } catch {
    return "—";
  }
}

/**
 * Lecturas ligeras (conteos exactos vía PostgREST) para la pantalla de respaldo en producción.
 * No exporta datos sensibles: solo host del proyecto y totales por tabla.
 */
export async function fetchRespaldoSupabaseResumen(): Promise<RespaldoSupabaseResumen> {
  const { url } = getServerSupabaseCredentials();
  const projectHost = supabaseProjectHost(url);
  const fetchedAtIso = new Date().toISOString();

  try {
    const supabase = getSupabaseServerClient();

    const [tableResults, orgPick] = await Promise.all([
      Promise.all(
        TABLES.map(async ({ table, label }) => {
          const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
          if (error) {
            return { table, label, count: null as number | null, error: error.message };
          }
          return { table, label, count: count ?? 0 };
        }),
      ),
      supabase.from("organizations").select("name").order("created_at", { ascending: true }).limit(5),
    ]);

    const organizationNamesSample =
      orgPick.error || !orgPick.data ? [] : orgPick.data.map((r) => r.name).filter((n): n is string => Boolean(n));

    return {
      projectHost,
      connectionOk: true,
      organizationNamesSample,
      tables: tableResults,
      fetchedAtIso,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return {
      projectHost,
      connectionOk: false,
      connectionError: message,
      organizationNamesSample: [],
      tables: TABLES.map(({ table, label }) => ({
        table,
        label,
        count: null,
        error: "Sin lectura",
      })),
      fetchedAtIso,
    };
  }
}
