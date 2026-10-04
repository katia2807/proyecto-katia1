import { DEFAULT_ORG_ID } from "@/lib/constants";
import { demoAlquilerRows, demoVentasRows, demoPersonalRows, demoAlertasCriticasRows } from "@/lib/demo-store";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Tables = Database["public"]["Tables"];
type PageResult<T> = { data: T[] | null; count: number | null; error: unknown };
const visible = (row: object) => !("deleted_at" in row && row.deleted_at);

/** Recorre los pendientes filtrados, sin depender del límite del historial. */
async function pendingRows<T>(loadPage: (from: number, to: number, signal: AbortSignal) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const all: T[] = [];
  const signal = AbortSignal.timeout(10_000);
  let expectedTotal: number | null = null;
  do {
    const result = await loadPage(all.length, all.length + 499, signal);
    if (result.error) throw result.error;
    if (result.data === null || result.count === null) throw new Error("No se pudieron cargar los pendientes.");
    if (expectedTotal !== null && expectedTotal !== result.count) throw new Error("Los pendientes cambiaron durante la consulta. Vuelve a intentarlo.");
    expectedTotal = result.count;
    if (result.data.length === 0 && all.length < expectedTotal) throw new Error("No se pudo completar el listado de pendientes.");
    all.push(...result.data);
  } while (all.length < expectedTotal);
  return all;
}

export async function getVentasBorradorRows() {
  if (!hasSupabaseEnv()) return demoVentasRows().filter((row) => row.estado === "borrador" && visible(row));
  const client = getSupabaseServerClient();
  return pendingRows<Tables["ventas_madera"]["Row"]>((from, to, signal) => client.from("ventas_madera")
    .select("*", { count: "exact" }).eq("organization_id", DEFAULT_ORG_ID)
    .eq("estado", "borrador").is("deleted_at", null)
    .order("fecha", { ascending: false }).order("id").range(from, to).abortSignal(signal));
}

export async function getAlquileresConPenalidadRows() {
  if (!hasSupabaseEnv()) return demoAlquilerRows().filter((row) => row.penalidad > 0 && row.estado !== "cerrado" && visible(row));
  const client = getSupabaseServerClient();
  return pendingRows<Tables["alquileres"]["Row"]>((from, to, signal) => client.from("alquileres")
    .select("*", { count: "exact" }).eq("organization_id", DEFAULT_ORG_ID)
    .gt("penalidad", 0).neq("estado", "cerrado").is("deleted_at", null)
    .order("fecha_inicio", { ascending: false }).order("id").range(from, to).abortSignal(signal));
}

export async function getAdelantosPendientesRows() {
  if (!hasSupabaseEnv()) return demoPersonalRows().adelantos.filter((row) => row.estado === "pendiente");
  const client = getSupabaseServerClient();
  return pendingRows<Tables["adelantos"]["Row"]>((from, to, signal) => client.from("adelantos")
    .select("*", { count: "exact" }).eq("organization_id", DEFAULT_ORG_ID).eq("estado", "pendiente")
    .order("fecha", { ascending: false }).order("id").range(from, to).abortSignal(signal));
}

export async function getAlertasCriticasRows() {
  if (!hasSupabaseEnv()) return demoAlertasCriticasRows();
  const client = getSupabaseServerClient();
  return pendingRows<Tables["alertas_operativas"]["Row"]>((from, to, signal) => client.from("alertas_operativas")
    .select("*", { count: "exact" }).eq("organization_id", DEFAULT_ORG_ID)
    .eq("prioridad", "alta").neq("estado", "resuelta")
    .order("created_at", { ascending: false }).order("id").range(from, to).abortSignal(signal));
}
