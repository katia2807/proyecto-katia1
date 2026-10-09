import { DEFAULT_ORG_ID } from "@/lib/constants";
import { demoCajaRows } from "@/lib/demo-store";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { roundMoney } from "@/lib/utils";
import { CAJA_HISTORY_PAGE_SIZE, crearFiltroCaja, normalizeCajaFiltros } from "@/lib/caja-filtros";
import type { CajaFiltros } from "@/lib/caja-filtros";
import { listadoTamano } from "@/lib/listado-paginacion";

export type CajaVista = "todos" | "empresa" | "personal";
type CajaRow = Database["public"]["Tables"]["movimientos_caja"]["Row"] & { deleted_at?: string | null };
export type CajaResumen = {
  ingresos: number;
  gastos: number;
  saldo: number;
  movimientos: number;
  transferencias: number;
  desde: string | null;
  hasta: string | null;
};
export type CajaPanelData =
  | { ok: true; empresa: CajaResumen; personal: CajaResumen; rows: CajaRow[]; totalVista: number; totalResultados: number; pagina: number }
  | { ok: false; empresa: null; personal: null; rows: []; totalVista: null };

const PAGE_SIZE = 500;
const crearAcumulador = () => ({ ingresos: 0, gastos: 0, movimientos: 0, transferencias: 0, desde: null as string | null, hasta: null as string | null });
type Acumulador = ReturnType<typeof crearAcumulador>;

function agregar(acumulador: Acumulador, row: CajaRow) {
  const monto = Number(row.monto);
  const centavos = Math.round(roundMoney(monto) * 100);
  if (row.monto == null || !Number.isSafeInteger(centavos) || monto < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(row.fecha)) {
    throw new Error("Movimiento de caja inválido.");
  }
  if (row.tipo === "ingreso") acumulador.ingresos += centavos;
  else if (row.tipo === "egreso") acumulador.gastos += centavos;
  else if (row.tipo === "transferencia") acumulador.transferencias += 1;
  else throw new Error("Tipo de movimiento de caja inválido.");
  if (!Number.isSafeInteger(acumulador.ingresos) || !Number.isSafeInteger(acumulador.gastos)) {
    throw new Error("Importes fuera de rango.");
  }
  acumulador.movimientos += 1;
  if (!acumulador.desde || row.fecha < acumulador.desde) acumulador.desde = row.fecha;
  if (!acumulador.hasta || row.fecha > acumulador.hasta) acumulador.hasta = row.fecha;
}

function finalizar(acumulador: Acumulador): CajaResumen {
  return { ...acumulador, ingresos: acumulador.ingresos / 100, gastos: acumulador.gastos / 100, saldo: (acumulador.ingresos - acumulador.gastos) / 100 };
}

/** El resumen recorre el historial completo; únicamente las filas enviadas a la tabla se limitan. */
export async function getCajaPanelData(vista: CajaVista = "todos", organizationId = DEFAULT_ORG_ID, filtros: CajaFiltros = normalizeCajaFiltros()): Promise<CajaPanelData> {
  const empresa = crearAcumulador();
  const personal = crearAcumulador();
  const coincidencias: CajaRow[] = [];
  const coincide = crearFiltroCaja(filtros);
  const ids = new Set<string>();
  const consumir = (page: CajaRow[]) => {
    for (const row of page) {
      if (ids.has(row.id)) throw new Error("El historial cambió durante la carga.");
      ids.add(row.id);
      agregar(row.es_personal ? personal : empresa, row);
      if ((vista === "todos" || (vista === "personal" ? row.es_personal : !row.es_personal)) && coincide(row)) coincidencias.push(row);
    }
  };

  try {
    if (!hasSupabaseEnv()) {
      consumir(demoCajaRows()
        .filter(row => row.organization_id === organizationId && !row.voided_at && !row.deleted_at)
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)));
    } else {
      const supabase = getSupabaseServerClient();
      let offset = 0;
      let total: number | null = null;
      do {
        const { data, error, count } = await supabase.from("movimientos_caja")
          .select("*", { count: "exact" })
          .eq("organization_id", organizationId)
          .is("voided_at", null)
          .is("deleted_at", null)
          .order("fecha", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error || !Array.isArray(data) || count === null || !Number.isSafeInteger(count) || count < 0) throw new Error("No se pudo comprobar el historial completo.");
        if (total !== null && total !== count) throw new Error("El historial cambió durante la carga.");
        total = count;
        if (data.length === 0 && offset < total) throw new Error("Historial incompleto.");
        consumir(data as CajaRow[]);
        offset += data.length;
        if (offset > total) throw new Error("Historial inconsistente.");
      } while (offset < total);
    }
    const totalVista = vista === "todos" ? empresa.movimientos + personal.movimientos : vista === "personal" ? personal.movimientos : empresa.movimientos;
    const pageSize = listadoTamano(filtros.por_pagina, CAJA_HISTORY_PAGE_SIZE);
    const pagina = Math.min(filtros.pagina, Math.max(1, Math.ceil(coincidencias.length / pageSize)));
    const start = (pagina - 1) * pageSize;
    const rows = coincidencias.slice(start, start + pageSize);
    return { ok: true, empresa: finalizar(empresa), personal: finalizar(personal), rows, totalVista, totalResultados: coincidencias.length, pagina };
  } catch {
    // Un fallo en cualquier página invalida los totales; nunca presentar una suma parcial como saldo.
    return { ok: false, empresa: null, personal: null, rows: [], totalVista: null };
  }
}
