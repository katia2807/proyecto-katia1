import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { clienteFichaSnapshot } from "@/lib/cliente-contacto";
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: mocks.read, writeStoreToDisk: mocks.write }));
vi.mock("@/lib/demo-mode", () => ({ isDemoDatabaseMode: () => true }));
const org = "00000000-0000-0000-0000-000000000001";
const old = { id: "cliente", organization_id: org, nombre: "Cliente anterior", documento: null, ruc: null, telefono: null, direccion: null, tipo_persona: null, estado: "vip", created_at: "2026-01-01" };
const clear = () => { delete (globalThis as Record<symbol, unknown>)[Symbol.for("katia.demo-store.runtime")]; };
describe("Persistencia de contacto sin alterar el negocio", () => {
  beforeEach(() => { clear(); vi.resetModules(); vi.clearAllMocks(); mocks.read.mockReturnValue({ clientes: [old] }); });
  afterEach(clear);
  test("guarda una vez y conserva bancos, ceros y estado VIP al recargar", async () => {
    let store = await import("@/lib/demo-store"); const row = store.demoClientesRows()[0];
    const metadata = { email: "prueba@ejemplo.invalid", cuentas_bancarias: [{ banco: "BCP", moneda: "PEN", numero: "001234567890", cci: "", titular: "" }] };
    expect(store.demoUpdateClienteFicha("cliente", org, { ...clienteFichaSnapshot(row), datos_adicionales: metadata }, clienteFichaSnapshot(row))).toBe(true);
    expect(mocks.write).toHaveBeenCalledTimes(1); mocks.read.mockReturnValue(mocks.write.mock.calls[0][0]);
    clear(); vi.resetModules(); store = await import("@/lib/demo-store");
    expect(store.demoClientesRows()[0]).toMatchObject({ estado: "vip", datos_adicionales: metadata });
  });
  test("una ficha desactualizada no borra un cambio posterior", async () => {
    const store = await import("@/lib/demo-store"); const previous = clienteFichaSnapshot(store.demoClientesRows()[0]);
    store.demoUpdateClienteDatos("cliente", org, { ...previous, nombre: "Nombre cambiado" });
    mocks.write.mockClear();
    expect(store.demoUpdateClienteFicha("cliente", org, { ...previous, nombre: "Nombre viejo", datos_adicionales: {} }, previous)).toBe(false);
    expect(mocks.write).not.toHaveBeenCalled(); expect(store.demoClientesRows()[0].nombre).toBe("Nombre cambiado");
  });
  test("rechaza otra organización y clientes archivados", async () => {
    const store = await import("@/lib/demo-store"); const previous = clienteFichaSnapshot(store.demoClientesRows()[0]);
    expect(store.demoUpdateClienteFicha("cliente", "otra", { ...previous, datos_adicionales: {} }, previous)).toBe(false);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  test("leer un cliente antiguo no escribe ni le agrega contacto", async () => {
    const store = await import("@/lib/demo-store"); expect(store.demoClientesRows()[0]).not.toHaveProperty("datos_adicionales"); expect(mocks.write).not.toHaveBeenCalled();
  });
});
