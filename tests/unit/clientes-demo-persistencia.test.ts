import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: mocks.read, writeStoreToDisk: mocks.write }));
vi.mock("@/lib/demo-mode", () => ({ isDemoDatabaseMode: () => true }));
const org = "00000000-0000-0000-0000-000000000001";
const cliente = (id: string, extra = {}) => ({ id, organization_id: org, nombre: id, documento: null, telefono: null, created_at: "2026-10-06", ...extra });

describe("Persistencia local de clientes", () => {
  const clearRuntime = () => { delete (globalThis as Record<symbol, unknown>)[Symbol.for("katia.demo-store.runtime")]; };
  beforeEach(() => { clearRuntime(); vi.resetModules(); vi.clearAllMocks(); });
  afterEach(clearRuntime);
  test("conserva activo y VIP y excluye un cliente archivado después de cargar el archivo", async () => {
    mocks.read.mockReturnValue({ clientes: [cliente("activo", { estado: "activo" }), cliente("vip", { estado: "vip" }), cliente("archivado", { estado: "inactivo", deleted_at: "2026-10-05" })] });
    const store = await import("@/lib/demo-store");
    expect(store.demoClientesRows().map(c => [c.id, c.estado])).toEqual([["activo", "activo"], ["vip", "vip"]]);
  });
  test("el estado guardado sobrevive a otra carga del almacén", async () => {
    mocks.read.mockReturnValue({ clientes: [cliente("cliente", { estado: "activo" })] });
    let store = await import("@/lib/demo-store");
    store.demoUpdateClienteEstado("cliente", "vip");
    expect(mocks.write).toHaveBeenCalledTimes(1);
    mocks.read.mockReturnValue(mocks.write.mock.calls[0][0]);
    clearRuntime(); vi.resetModules(); store = await import("@/lib/demo-store");
    expect(store.demoClientesRows()[0].estado).toBe("vip");
  });
  test("los datos antiguos sin estado no se cambian automáticamente a activo", async () => {
    mocks.read.mockReturnValue({ clientes: [cliente("antiguo")] });
    const store = await import("@/lib/demo-store");
    expect(store.demoClientesRows()[0].estado).toBeNull();
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
