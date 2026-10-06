import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn(), requireAuthContext: vi.fn(),
  demoCajaMovimientoById: vi.fn(), demoCreateCaja: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.requireAuthContext }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn() }));
vi.mock("@/lib/demo-store", () => mocks);

import { submitCajaMovimientoForm } from "@/app/actions";
import { crearEnvioCaja } from "@/lib/caja-envio";
import { mutationFormInitialState } from "@/lib/mutation-form-state";

const org = "11111111-1111-4111-8111-111111111111";
const movimientoId = "22222222-2222-4222-8222-222222222222";
type Row = Record<string, unknown>;
let rows: Row[];
let requests: { url: URL; method: string; payload: Row }[];
let loseInsertResponse: boolean;
let failRead: boolean;

function guardar(payload: Row) {
  if (rows.some(row => row.id === payload.id)) return false;
  rows.push({ referencia_id: null, voided_at: null, deleted_at: null, periodo_cerrado: false, ...payload });
  return true;
}

// La clave primaria y las respuestas del SDK se simulan en memoria; no hay llamadas externas.
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  const payload = init?.body ? JSON.parse(String(init.body)) : {};
  requests.push({ url, method, payload });
  if (method === "POST") {
    if (!guardar(payload)) return new Response(JSON.stringify({ code: "23505", message: "Clave primaria duplicada" }), { status: 409 });
    if (loseInsertResponse) return new Response(JSON.stringify({ message: "Respuesta perdida después de guardar" }), { status: 500 });
    return new Response("[]", { status: 201, headers: { "content-type": "application/json" } });
  }
  if (failRead) return new Response(JSON.stringify({ message: "Lectura no disponible" }), { status: 500 });
  const selected = rows.filter(row => [...url.searchParams].every(([field, value]) => !value.startsWith("eq.") || String(row[field]) === value.slice(3)));
  return new Response(JSON.stringify(selected), { headers: { "content-type": "application/json" } });
};

function datos(cambios: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    movimiento_id: movimientoId, fecha: "2026-10-05", tipo: "egreso", medio: "yape",
    categoria: "Pago de servicios", monto: "25.00", es_personal: "false", ...cambios,
  })) form.set(key, value);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks(); rows = []; requests = []; loseInsertResponse = false; failRead = false;
  mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "owner_admin", organizationId: org });
  mocks.getSupabaseServerClient.mockImplementation(() => createClient("https://caja.test", "test-key", {
    global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false },
  }));
  mocks.demoCajaMovimientoById.mockImplementation((id, organizationId) => rows.find(row => row.id === id && row.organization_id === organizationId));
  mocks.demoCreateCaja.mockImplementation(payload => {
    if (!guardar(payload)) throw new Error("Este movimiento ya está registrado.");
  });
});

describe.each([true, false])("Reintentos de Caja (Supabase: %s)", supabase => {
  beforeEach(() => mocks.hasSupabaseEnv.mockReturnValue(supabase));

  test("el mismo envío se confirma dos veces, pero se guarda una sola vez", async () => {
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos())).toMatchObject({ success: true });
    const original = structuredClone(rows[0]);
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos())).toMatchObject({ success: true });
    expect(rows).toEqual([original]);
    if (supabase) {
      expect(requests.every(request => ["POST", "GET"].includes(request.method))).toBe(true);
      expect(requests.at(-1)?.url.searchParams.get("organization_id")).toBe(`eq.${org}`);
    } else expect(mocks.demoCreateCaja).toHaveBeenCalledTimes(1);
  });

  test("al perder la respuesta al navegador, el reintento conserva el envío y confirma el guardado original", async () => {
    let perderRespuesta = true;
    const enviar = crearEnvioCaja(async (prev, form) => {
      const estado = await submitCajaMovimientoForm(prev, form);
      if (perderRespuesta) { perderRespuesta = false; throw new Error("Conexión perdida"); }
      return estado;
    });
    const primerFormulario = datos();
    const primerEstado = await enviar(mutationFormInitialState, primerFormulario);
    expect(primerEstado).toMatchObject({ success: false, error: expect.stringContaining("No pudimos confirmar") });
    const segundoFormulario = datos();
    expect(await enviar(primerEstado, segundoFormulario)).toMatchObject({ success: true });
    expect(primerFormulario.get("movimiento_id")).toBe(segundoFormulario.get("movimiento_id"));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(primerFormulario.get("movimiento_id"));
  });

  test.each([
    ["monto", "30"], ["fecha", "2026-10-06"], ["tipo", "ingreso"], ["medio", "banco"],
    ["categoria", "Otra categoría"], ["es_personal", "true"], ["descripcion", "Nota diferente"],
    ["tipo_comprobante", "factura"], ["url_comprobante", "/comprobante-diferente.pdf"],
  ])("si el primer intento se guardó, cambiar %s no lo sobrescribe", async (field, value) => {
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos())).toMatchObject({ success: true });
    const original = structuredClone(rows[0]);
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos({ [field]: value }))).toMatchObject({
      success: false, error: expect.stringContaining("otros datos"),
    });
    expect(rows).toEqual([original]);
    expect(requests.every(request => ["POST", "GET"].includes(request.method))).toBe(true);
  });

  test.each([{ voided_at: "2026-10-05" }, { deleted_at: "2026-10-05" },
    { modulo_origen: "ventas_madera" }, { referencia_id: movimientoId }, { organization_id: "otra-empresa" },
  ])("un registro anulado, eliminado, enlazado o ajeno no se confirma ni modifica: %j", async changes => {
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos())).toMatchObject({ success: true });
    Object.assign(rows[0], changes);
    const original = structuredClone(rows[0]);
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos())).toMatchObject({ success: false });
    expect(rows).toEqual([original]);
  });

  test("los envíos simultáneos con la misma identidad no generan dos movimientos", async () => {
    const resultados = await Promise.all([
      submitCajaMovimientoForm(mutationFormInitialState, datos()),
      submitCajaMovimientoForm(mutationFormInitialState, datos()),
    ]);
    expect(resultados.every(resultado => resultado.success)).toBe(true);
    expect(rows).toHaveLength(1);
  });

  test("dos formularios nuevos pueden registrar legítimamente el mismo importe y categoría", async () => {
    const primero = crearEnvioCaja(submitCajaMovimientoForm);
    const segundo = crearEnvioCaja(submitCajaMovimientoForm);
    expect(await primero(mutationFormInitialState, datos())).toMatchObject({ success: true });
    expect(await segundo(mutationFormInitialState, datos())).toMatchObject({ success: true });
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  test("rechaza una identidad inválida antes de guardar", async () => {
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos({ movimiento_id: "invalido" }))).toMatchObject({ success: false });
    expect(rows).toHaveLength(0);
    expect(requests).toHaveLength(0);
    expect(mocks.demoCreateCaja).not.toHaveBeenCalled();
  });

  test("normaliza la identidad en mayúsculas para confirmar el mismo envío", async () => {
    const uppercaseId = "ABCDEF12-1234-4123-8123-ABCDEF123456";
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos({ movimiento_id: uppercaseId }))).toMatchObject({ success: true });
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos({ movimiento_id: uppercaseId.toLowerCase() }))).toMatchObject({ success: true });
    expect(rows).toHaveLength(1);
  });

  test("el reintento sigue comprobando el permiso de escritura", async () => {
    await submitCajaMovimientoForm(mutationFormInitialState, datos());
    mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "readonly", organizationId: org });
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos())).toMatchObject({ success: false, error: expect.stringContaining("solo lectura") });
    expect(rows).toHaveLength(1);
  });
});

test("si se pierde la respuesta de la base después de guardar, el siguiente intento confirma sin duplicar", async () => {
  mocks.hasSupabaseEnv.mockReturnValue(true);
  loseInsertResponse = true;
  expect(await submitCajaMovimientoForm(mutationFormInitialState, datos())).toMatchObject({ success: false });
  expect(rows).toHaveLength(1);
  loseInsertResponse = false;
  expect(await submitCajaMovimientoForm(mutationFormInitialState, datos())).toMatchObject({ success: true });
  expect(rows).toHaveLength(1);
});

test("si no se puede confirmar un envío duplicado, informa del problema y permite reintentar", async () => {
  mocks.hasSupabaseEnv.mockReturnValue(true);
  await submitCajaMovimientoForm(mutationFormInitialState, datos());
  failRead = true;
  const estado = await submitCajaMovimientoForm(mutationFormInitialState, datos());
  expect(estado).toMatchObject({ success: false, error: expect.stringContaining("confirmar el primer envío") });
  failRead = false;
  expect(await submitCajaMovimientoForm(estado, datos())).toMatchObject({ success: true });
  expect(rows).toHaveLength(1);
});
