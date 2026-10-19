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

describe("Eliminación local con las mismas restricciones", () => {
  const clearRuntime = () => { delete (globalThis as Record<symbol, unknown>)[Symbol.for("katia.demo-store.runtime")]; };
  beforeEach(() => { clearRuntime(); vi.resetModules(); vi.clearAllMocks(); mocks.write.mockReset(); });
  afterEach(clearRuntime);
  test("el borrado directo rechaza clientes activos y no escribe", async () => {
    mocks.read.mockReturnValue({ clientes: [cliente("prueba", { estado: "activo" })] });
    const store = await import("@/lib/demo-store");
    expect(() => store.demoDeleteCliente("prueba", org)).toThrow("Inactivo");
    expect(store.demoClientesRows()).toHaveLength(1); expect(mocks.write).not.toHaveBeenCalled();
  });
  test("incluye cotizaciones archivadas al proteger el historial", async () => {
    mocks.read.mockReturnValue({ clientes: [cliente("prueba", { estado: "inactivo" })],
      cotizaciones: [{ id: "cot", organization_id: org, cliente_id: "prueba", deleted_at: "2026-10-01" }] });
    const store = await import("@/lib/demo-store");
    expect(store.demoClienteDependencias("prueba", org).cotizaciones_mueble).toBe(1);
    expect(() => store.demoDeleteCliente("prueba", org)).toThrow("vinculados"); expect(mocks.write).not.toHaveBeenCalled();
  });
  test("elimina una ficha vacía sin tocar otra organización", async () => {
    mocks.read.mockReturnValue({ clientes: [cliente("prueba", { estado: "inactivo" }), cliente("ajeno", { organization_id: "otra", estado: "inactivo" })] });
    const store = await import("@/lib/demo-store"); store.demoDeleteCliente("prueba", org);
    expect(store.demoClientesRows().map(c => c.id)).toEqual(["ajeno"]); expect(mocks.write).toHaveBeenCalledTimes(1);
    expect(() => store.demoDeleteCliente("ajeno", org)).toThrow("no encontrado");
  });
  test("si falla el guardado local restaura la ficha en memoria", async () => {
    mocks.read.mockReturnValue({ clientes: [cliente("prueba", { estado: "inactivo" })] });
    mocks.write.mockImplementation(() => { throw new Error("Disco ficticio"); });
    const store = await import("@/lib/demo-store");
    expect(() => store.demoDeleteCliente("prueba", org)).toThrow("Disco ficticio");
    expect(store.demoClientesRows().map(c => c.id)).toEqual(["prueba"]);
  });
});
