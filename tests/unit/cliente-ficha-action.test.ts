import { beforeEach, describe, expect, test, vi } from "vitest";
import { clienteFichaSnapshot } from "@/lib/cliente-contacto";
const m = vi.hoisted(() => ({ auth: vi.fn(), env: vi.fn(), server: vi.fn(), demo: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: m.auth }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: m.env }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: m.server }));
vi.mock("@/lib/demo-store", async original => ({ ...await original<typeof import("@/lib/demo-store")>(), demoUpdateClienteFicha: m.demo }));
import { submitUpdateClienteFicha } from "@/app/actions";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
const id = "11111111-1111-4111-8111-111111111111", org = "00000000-0000-0000-0000-000000000001";
const previous = clienteFichaSnapshot({ nombre: "Cliente anterior" });
function form() {
  const f = new FormData();
  f.set("cliente_id", id); f.set("ficha_anterior", JSON.stringify(previous)); f.set("nombre", "Cliente corregido");
  f.set("datos_adicionales", JSON.stringify({ email: "prueba@ejemplo.invalid", cuentas_bancarias: [{ banco: "BCP", moneda: "PEN", numero: "001234567890", cci: "", titular: "" }] }));
  // Campos que un cliente manipulado no puede escribir.
  f.set("estado", "vip"); f.set("organization_id", "otra"); f.set("saldo", "900");
  return f;
}
describe("Edición explícita y acotada de cliente", () => {
  beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ role: "owner_admin", uiRole: "owner_admin", organizationId: org }); m.env.mockReturnValue(false); m.demo.mockReturnValue(true); });
  test("solo guarda ficha/contacto y no admite campos financieros ni estado", async () => {
    expect((await submitUpdateClienteFicha(mutationFormInitialState, form())).success).toBe(true);
    expect(m.demo).toHaveBeenCalledTimes(1);
    const [savedId, savedOrg, patch, snap] = m.demo.mock.calls[0];
    expect([savedId, savedOrg, snap]).toEqual([id, org, previous]);
    expect(patch.datos_adicionales.cuentas_bancarias[0].numero).toBe("001234567890");
    expect(patch).not.toHaveProperty("estado"); expect(patch).not.toHaveProperty("saldo"); expect(patch).not.toHaveProperty("organization_id");
  });
  test("un conflicto no se registra como éxito ni invalida pantallas", async () => {
    m.demo.mockReturnValue(false); const r = await submitUpdateClienteFicha(mutationFormInitialState, form());
    expect(r.success).toBe(false); expect(r.error).toContain("La ficha cambió"); expect(m.revalidate).not.toHaveBeenCalled();
  });
  test("usuario readonly no escribe aunque conozca el id", async () => {
    m.auth.mockResolvedValue({ role: "owner_admin", uiRole: "readonly", organizationId: org });
    expect((await submitUpdateClienteFicha(mutationFormInitialState, form())).error).toContain("solo lectura"); expect(m.demo).not.toHaveBeenCalled();
  });
  test.each(["bad-id", "bad-snapshot", "bad-contact"])("rechaza %s antes de persistir", async key => {
    const f = form(); if (key === "bad-id") f.set("cliente_id", "otro"); if (key === "bad-snapshot") f.set("ficha_anterior", "{"); if (key === "bad-contact") f.set("datos_adicionales", '{"cuentas_bancarias":[{"cci":"1"}]}');
    expect((await submitUpdateClienteFicha(mutationFormInitialState, f)).success).toBe(false); expect(m.demo).not.toHaveBeenCalled(); expect(m.server).not.toHaveBeenCalled();
  });
  test("Supabase usa una actualización con organización, baja y snapshot anterior", async () => {
    m.env.mockReturnValue(true); const q = { update: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id }, error: null }) };
    q.update.mockReturnValue(q); q.eq.mockReturnValue(q); q.is.mockReturnValue(q); q.select.mockReturnValue(q);
    const from = vi.fn().mockReturnValue(q); m.server.mockReturnValue({ from });
    expect((await submitUpdateClienteFicha(mutationFormInitialState, form())).success).toBe(true);
    expect(from).toHaveBeenCalledWith("clientes"); expect(q.update).toHaveBeenCalledTimes(1); expect(q.eq).toHaveBeenCalledWith("organization_id", org);
    expect(q.is).toHaveBeenCalledWith("deleted_at", null); expect(q.eq).toHaveBeenCalledWith("nombre", previous.nombre); expect(q.eq).toHaveBeenCalledWith("datos_adicionales", "{}");
    expect(m.demo).not.toHaveBeenCalled();
    q.maybeSingle.mockResolvedValue({ data: null, error: null } as never);
    expect((await submitUpdateClienteFicha(mutationFormInitialState, form())).success).toBe(false);
  });
});
