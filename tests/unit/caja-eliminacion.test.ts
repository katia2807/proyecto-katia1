import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn(), requireAuthContext: vi.fn(),
  demoCajaRows: vi.fn(), demoDeleteOneById: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.requireAuthContext }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn() }));
vi.mock("@/lib/demo-store", () => mocks);

import { deleteCajaMovimiento } from "@/app/actions";
import { CajaMasterDetail } from "@/components/caja/caja-master-detail";
import { ToastProvider } from "@/components/ui/toast";

const org = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
type Row = Record<string, unknown>;
const registro = (changes: Row = {}): Row => ({
  id, organization_id: org, periodo_cerrado: false, modulo_origen: "caja",
  referencia_id: null, deleted_at: null, voided_at: null, monto: 25, ...changes,
});
let rows: Row[];
let requests: { url: URL; method: string }[];
let failMethod: string | null;
let beforeDelete: (() => void) | null;

// El SDK consulta y modifica solo estos registros en memoria. No hay una base real.
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  requests.push({ url, method });
  if (method === failMethod) return new Response(JSON.stringify({ message: "Fallo de prueba" }), { status: 500 });
  if (method === "DELETE") beforeDelete?.();
  const selected = rows.filter(row => [...url.searchParams].every(([field, value]) => {
    if (field === "or") {
      expect(value).toBe("(modulo_origen.is.null,modulo_origen.eq.caja)");
      return row.modulo_origen === null || row.modulo_origen === "caja";
    }
    if (value === "is.null") return row[field] == null;
    return !value.startsWith("eq.") || String(row[field]) === value.slice(3);
  }));
  if (method === "DELETE") rows = rows.filter(row => !selected.includes(row));
  return new Response(JSON.stringify(selected), { headers: { "content-type": "application/json" } });
};

beforeEach(() => {
  vi.clearAllMocks();
  rows = [registro()]; requests = []; failMethod = null; beforeDelete = null;
  mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "owner_admin", organizationId: org });
  mocks.getSupabaseServerClient.mockImplementation(() => createClient("https://caja.test", "test-key", {
    global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false },
  }));
  mocks.demoCajaRows.mockImplementation(() => rows.filter(row => !row.voided_at));
  mocks.demoDeleteOneById.mockImplementation((_category, targetId) => {
    const previousLength = rows.length;
    rows = rows.filter(row => row.id !== targetId);
    return { eliminados: previousLength - rows.length };
  });
});

describe.each([true, false])("Eliminar de Caja (Supabase: %s)", supabase => {
  beforeEach(() => mocks.hasSupabaseEnv.mockReturnValue(supabase));

  test.each(["caja", null])("permite eliminar un movimiento manual abierto, origen %s", async modulo => {
    rows = [registro({ modulo_origen: modulo }), registro({ id: "otro-movimiento" })];
    expect(await deleteCajaMovimiento(id)).toEqual({ ok: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("otro-movimiento");
    expect(mocks.requireAuthContext).toHaveBeenCalledWith({ allowedRoles: ["owner_admin"], redirectTo: null });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/caja");
    if (supabase) {
      expect(requests.every(request => request.url.searchParams.get("organization_id") === `eq.${org}`)).toBe(true);
      expect(requests.filter(request => request.method === "DELETE")).toHaveLength(1);
    } else expect(mocks.demoDeleteOneById).toHaveBeenCalledWith("caja", id);
  });

  test.each([
    ["período cerrado", { periodo_cerrado: true }, "período cerrado"],
    ["venta", { modulo_origen: "ventas_madera", referencia_id: id }, "otra operación"],
    ["cotización", { modulo_origen: "cotizacion_unificada", referencia_id: id }, "otra operación"],
    ["compra sin enlace antiguo", { modulo_origen: "compras_madera" }, "otra operación"],
    ["referencia aunque figure como manual", { referencia_id: id }, "otra operación"],
  ] as const)("protege %s sin borrar ni actualizar totales", async (_name, changes, message) => {
    rows = [registro(changes)];
    expect(await deleteCajaMovimiento(id)).toEqual({ ok: false, error: expect.stringContaining(message) });
    expect(rows).toEqual([registro(changes)]);
    expect(requests.every(request => request.method === "GET")).toBe(true);
    expect(mocks.demoDeleteOneById).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test.each([
    { organization_id: "otra-empresa" }, { deleted_at: "2026-10-05" },
    { voided_at: "2026-10-05" }, { id: "otro-movimiento" },
  ])("no elimina un registro fuera del historial visible: %j", async changes => {
    rows = [registro(changes)];
    expect(await deleteCajaMovimiento(id)).toEqual({ ok: false, error: expect.stringContaining("no disponible") });
    expect(rows).toHaveLength(1);
    expect(requests.every(request => request.method === "GET")).toBe(true);
    expect(mocks.demoDeleteOneById).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("rechaza un identificador inválido antes de leer o escribir", async () => {
    expect(await deleteCajaMovimiento("invalido")).toEqual({ ok: false, error: "Identificador inválido." });
    expect(requests).toHaveLength(0);
    expect(mocks.demoCajaRows).not.toHaveBeenCalled();
    expect(mocks.demoDeleteOneById).not.toHaveBeenCalled();
  });

  test("el modo de solo lectura bloquea la eliminación aunque se invoque directamente", async () => {
    mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "readonly", organizationId: org });
    expect(await deleteCajaMovimiento(id)).toEqual({ ok: false, error: expect.stringContaining("solo lectura") });
    expect(requests).toHaveLength(0);
    expect(mocks.demoDeleteOneById).not.toHaveBeenCalled();
  });

  test("respeta una denegación de permisos antes de consultar Caja", async () => {
    mocks.requireAuthContext.mockRejectedValue(new Error("Acceso denegado"));
    expect(await deleteCajaMovimiento(id)).toEqual({ ok: false, error: "Acceso denegado" });
    expect(requests).toHaveLength(0);
    expect(mocks.demoDeleteOneById).not.toHaveBeenCalled();
  });
});

describe("Caja: conflictos y fallos al eliminar", () => {
  beforeEach(() => mocks.hasSupabaseEnv.mockReturnValue(true));

  test.each([
    { periodo_cerrado: true }, { referencia_id: id }, { modulo_origen: "ventas_alquiler" },
    { deleted_at: "2026-10-05" }, { voided_at: "2026-10-05" }, { organization_id: "otra-empresa" },
  ])("protege un cambio entre la lectura y la eliminación: %j", async changes => {
    beforeDelete = () => Object.assign(rows[0], changes);
    expect(await deleteCajaMovimiento(id)).toEqual({ ok: false, error: expect.stringContaining("movimiento cambió") });
    expect(rows).toHaveLength(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test.each(["GET", "DELETE"])("un fallo de %s no devuelve éxito ni actualiza Caja", async method => {
    failMethod = method;
    expect(await deleteCajaMovimiento(id)).toEqual({ ok: false, error: expect.stringContaining("No se pudo") });
    expect(rows).toEqual([registro()]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("si otra pestaña ya lo eliminó no informa de una segunda eliminación", async () => {
    beforeDelete = () => { rows = []; };
    expect(await deleteCajaMovimiento(id)).toEqual({ ok: false, error: expect.stringContaining("ya no está disponible") });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

test("el historial distingue los movimientos protegidos de los manuales que sí se pueden eliminar", () => {
  const base = { id, fecha: "2026-10-05", tipo: "ingreso", medio: "efectivo", categoria: "Cobro",
    monto: 25, descripcion: "Manual", es_personal: false, modulo_origen: "caja", referencia_id: null,
    url_comprobante: null, tipo_comprobante: "ninguno", periodo_cerrado: false };
  const lista = createElement(CajaMasterDetail, {
    userRole: "owner_admin", rows: [base,
      { ...base, id: "venta", descripcion: "Venta", modulo_origen: "ventas_madera", referencia_id: id },
      { ...base, id: "cerrado", descripcion: "Cerrado", periodo_cerrado: true },
    ],
  });
  const html = renderToStaticMarkup(createElement(ToastProvider, null, lista));
  expect(html).toContain('aria-label="Eliminar movimiento: Manual"');
  expect(html).toContain('aria-label="Ver protección del movimiento: Venta"');
  expect(html).toContain('aria-label="Ver protección del movimiento: Cerrado"');
  expect(html).not.toContain('aria-label="Eliminar movimiento: Venta"');
  expect(html).not.toContain('aria-label="Eliminar movimiento: Cerrado"');
});
