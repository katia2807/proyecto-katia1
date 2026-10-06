import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ writeStoreToDisk: vi.fn() }));
// El almacén real de demo se verifica con persistencia reemplazada por memoria.
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: mocks.writeStoreToDisk }));
let demo: typeof import("@/lib/demo-store");
const org = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const input = { id, organization_id: org, fecha: "2026-10-05", tipo: "egreso" as const,
  medio: "efectivo" as const, categoria: "Servicios", monto: 25, descripcion: "Prueba en memoria", modulo_origen: "caja" };

beforeEach(async () => {
  vi.resetModules();
  demo = await import("@/lib/demo-store");
  demo.demoResetStore();
  vi.clearAllMocks();
});

test("el almacén demo conserva la identidad del envío y rechaza una segunda escritura, incluso desde otra empresa", () => {
  demo.demoCreateCaja(input);
  expect(demo.demoCajaMovimientoById(id, org)).toMatchObject(input);
  expect(() => demo.demoCreateCaja({ ...input, monto: 30 })).toThrow("ya está registrado");
  expect(() => demo.demoCreateCaja({ ...input, organization_id: "otra-empresa" })).toThrow("ya está registrado");
  expect(demo.demoCajaRows().filter(row => row.id === id)).toHaveLength(1);
  expect(demo.demoCajaMovimientoById(id, org)?.monto).toBe(25);
  expect(demo.demoCajaMovimientoById(id, "otra-empresa")).toBeUndefined();
  expect(mocks.writeStoreToDisk).toHaveBeenCalledTimes(1);
});

test("los registros existentes que no envían identidad siguen recibiendo identificadores distintos", () => {
  const sinId = { ...input, id: undefined };
  demo.demoCreateCaja(sinId);
  demo.demoCreateCaja(sinId);
  const rows = demo.demoCajaRows().filter(row => row.organization_id === org);
  expect(rows).toHaveLength(2);
  expect(rows[0].id).not.toBe(rows[1].id);
});

test("el reintento puede detectar un registro anulado aunque ya no figure en el historial activo", () => {
  demo.demoCreateCaja(input);
  demo.demoVoidCajaMov(id, "Prueba en memoria");
  expect(demo.demoCajaRows().some(row => row.id === id)).toBe(false);
  expect(demo.demoCajaMovimientoById(id, org)?.voided_at).toBeTruthy();
  expect(() => demo.demoCreateCaja(input)).toThrow("ya está registrado");
  expect(mocks.writeStoreToDisk).toHaveBeenCalledTimes(1);
});
