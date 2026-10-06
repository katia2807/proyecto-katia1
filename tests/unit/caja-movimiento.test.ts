import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ demoCreateCaja: vi.fn(), hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn(), requireAuthContext: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.requireAuthContext }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn() }));
vi.mock("@/lib/demo-store", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/demo-store")>(), demoCreateCaja: mocks.demoCreateCaja }));

import { submitCajaMovimientoForm } from "@/app/actions";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { cajaFechaHoy } from "@/lib/caja-movimiento";

const org = "11111111-1111-4111-8111-111111111111";
let requests: { url: URL; method: string; payload: Record<string, unknown> }[];
let failInsert: boolean;
// Las escrituras se capturan en memoria; nunca se llama a una base real.
const fixtureFetch: typeof fetch = async (input, init) => {
  requests.push({ url: new URL(String(input)), method: init?.method ?? "GET", payload: JSON.parse(String(init?.body)) });
  return failInsert
    ? new Response(JSON.stringify({ message: "Fallo de prueba" }), { status: 400, headers: { "content-type": "application/json" } })
    : new Response("[]", { status: 201, headers: { "content-type": "application/json" } });
};

function datos(cambios: Record<string, string | null> = {}) {
  const form = new FormData();
  const values: Record<string, string | null> = { fecha: "2026-10-04", tipo: "egreso", medio: "yape", categoria: "  Pago de servicios  ", monto: "33,25", es_personal: "false", ...cambios };
  for (const [key, value] of Object.entries(values)) if (value !== null) form.set(key, value);
  return form;
}

describe("Caja: registrar un movimiento", () => {
  beforeEach(() => {
    vi.clearAllMocks(); requests = []; failInsert = false;
    mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "owner_admin", organizationId: org });
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.getSupabaseServerClient.mockImplementation(() => createClient("https://caja.test", "test-key", { global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false } }));
  });

  test.each([["false", false], ["true", true], ["on", true], [null, false]] as const)("guarda el destino %s sin confundir Empresa con Personal", async (value, expected) => {
    for (const supabase of [true, false]) {
      mocks.hasSupabaseEnv.mockReturnValue(supabase);
      expect(await submitCajaMovimientoForm(mutationFormInitialState, datos({ es_personal: value, organization_id: "empresa-enviada-desde-el-cliente" }))).toMatchObject({ success: true, error: null });
      const saved = supabase ? requests.at(-1)?.payload : mocks.demoCreateCaja.mock.calls.at(-1)?.[0];
      expect(saved).toMatchObject({ organization_id: org, es_personal: expected, monto: 33.25, categoria: "Pago de servicios", fecha: "2026-10-04", tipo: "egreso", medio: "yape", modulo_origen: "caja" });
      expect(mocks.requireAuthContext).toHaveBeenCalledWith({ allowedRoles: ["owner_admin", "gerencia", "caja", "operaciones_caja"], redirectTo: null });
    }
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.pathname).toBe("/rest/v1/movimientos_caja");
    expect(mocks.demoCreateCaja).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["monto", "0", "monto"], ["monto", "-10", "monto"], ["monto", "0.001", "monto"],
    ["monto", "10abc", "monto"], ["monto", "Infinity", "monto"], ["monto", "99999999999.99", "monto"],
    ["monto", "1,234.00", "monto"], ["fecha", "2026-02-30", "fecha"], ["fecha", "mañana", "fecha"],
    ["categoria", "   ", "categoría"], ["es_personal", "empresa", "Empresa o Personal"], ["tipo", "otro", "tipo"],
  ])("rechaza %s=%s antes de escribir y muestra el dato a corregir", async (field, value, mensaje) => {
    for (const supabase of [true, false]) {
      mocks.hasSupabaseEnv.mockReturnValue(supabase);
      const result = await submitCajaMovimientoForm(mutationFormInitialState, datos({ [field]: value }));
      expect(result).toMatchObject({ success: false, message: null });
      expect(result.error).toContain(mensaje);
    }
    expect(requests).toHaveLength(0);
    expect(mocks.demoCreateCaja).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("admite céntimos escritos con punto y conserva un ingreso personal", async () => {
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos({ tipo: "ingreso", monto: ".50", es_personal: "true" }))).toMatchObject({ success: true });
    expect(requests[0].payload).toMatchObject({ tipo: "ingreso", es_personal: true, monto: 0.5 });
  });

  test("un fallo al guardar no devuelve éxito ni actualiza el historial", async () => {
    failInsert = true;
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos())).toMatchObject({ success: false, message: null });
    expect(requests).toHaveLength(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("un usuario de solo lectura no puede registrar aunque envíe un formulario válido", async () => {
    mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "readonly", organizationId: org });
    expect(await submitCajaMovimientoForm(mutationFormInitialState, datos())).toMatchObject({ success: false, error: expect.stringContaining("solo lectura") });
    expect(requests).toHaveLength(0);
    expect(mocks.demoCreateCaja).not.toHaveBeenCalled();
  });

  test("la fecha propuesta conserva el día de Perú cuando UTC ya pasó a mañana", () => {
    expect(cajaFechaHoy(new Date("2026-10-04T02:00:00Z"))).toBe("2026-10-03");
    expect(cajaFechaHoy(new Date("2026-10-04T05:00:00Z"))).toBe("2026-10-04");
  });
});
