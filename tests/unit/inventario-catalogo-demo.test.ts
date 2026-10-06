import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ writeStoreToDisk: vi.fn() }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: mocks.writeStoreToDisk }));

import * as demo from "@/lib/demo-store";
import { DEFAULT_ORG_ID } from "@/lib/constants";

const id = "22222222-2222-4222-8222-222222222222";
const producto = { id, organization_id: DEFAULT_ORG_ID, codigo: "M-PRUEBA", nombre: "Mueble de prueba",
  categoria: "Muebles", unidad: "unidad", stock_minimo: 1, foto_url: null, costo_unitario: 250 };

function crearMuebleConPrecio() {
  demo.demoCreateInventarioProducto(producto);
  demo.demoUpdateInventarioProducto(id, { stock_actual: 8 });
  demo.demoUpdateMuebleCatalogo(id, { precio_lista: 650, foto_url: "antes.jpg" });
}

describe("Demo: consultas y sincronización al guardar", () => {
  beforeEach(() => { demo.demoResetStore(); vi.clearAllMocks(); });

  test("consultar no cambia ni persiste una copia con diferencias y un producto sin catálogo", () => {
    crearMuebleConPrecio();
    const fixture = demo.demoExportStore();
    fixture.inventarioProductos.find(row => row.id === id)!.stock_actual = 3;
    fixture.inventarioProductos.find(row => row.id === id)!.foto_url = null;
    fixture.inventarioProductos.push({ ...fixture.inventarioProductos.find(row => row.id === id)!,
      id: "33333333-3333-4333-8333-333333333333", codigo: "SIN-CAT", nombre: "Sin catálogo" });
    demo.demoImportStore(JSON.stringify(fixture));
    const before = demo.demoExportStore();
    vi.clearAllMocks();
    for (let index = 0; index < 2; index++) {
      expect(demo.demoMueblesCatalogoRows().find(row => row.id === id)).toMatchObject({ precio_lista: 650, stock_disponible: 8 });
    }
    expect(demo.demoExportStore()).toEqual(before);
    expect(mocks.writeStoreToDisk).not.toHaveBeenCalled();
  });

  test("crear desde inventario provisiona al guardar sin tomar el costo como precio", () => {
    demo.demoCreateInventarioProducto(producto);
    expect(demo.demoMueblesCatalogoRows().find(row => row.id === id)).toMatchObject({ precio_lista: 0, stock_disponible: 0 });
    expect(demo.demoInventarioProductosRows().find(row => row.id === id)?.costo_unitario).toBe(250);
    expect(mocks.writeStoreToDisk).toHaveBeenCalledTimes(1);
  });

  test("editar costo sincroniza stock y foto sin sustituir el precio", () => {
    crearMuebleConPrecio();
    demo.demoUpdateInventarioProducto(id, { costo_unitario: 300, stock_actual: 10, foto_url: "inventario.jpg" });
    expect(demo.demoMueblesCatalogoRows().find(row => row.id === id)).toMatchObject({ precio_lista: 650, stock_disponible: 10, foto_url: "inventario.jpg" });
  });

  test("editar precio sincroniza foto sin sustituir el costo", () => {
    crearMuebleConPrecio();
    demo.demoUpdateMuebleCatalogo(id, { precio_lista: 720, foto_url: "catalogo.jpg" });
    expect(demo.demoInventarioProductosRows().find(row => row.id === id)).toMatchObject({ costo_unitario: 250, foto_url: "catalogo.jpg" });
    expect(demo.demoMueblesCatalogoRows().find(row => row.id === id)?.precio_lista).toBe(720);
  });

  test("entrada y reversión actualizan ambos stocks al guardar y conservan el precio", () => {
    crearMuebleConPrecio();
    demo.demoCreateInventarioMovimiento({ organization_id: DEFAULT_ORG_ID, producto_id: id, fecha: "2026-10-06",
      tipo: "entrada_compra", cantidad: 2, costo_unitario: 300, referencia: "Prueba en memoria" });
    expect(demo.demoMueblesCatalogoRows().find(row => row.id === id)).toMatchObject({ stock_disponible: 10, precio_lista: 650 });
    expect(demo.demoInventarioProductosRows().find(row => row.id === id)?.stock_actual).toBe(10);
    const movimiento = demo.demoInventarioMovimientosRows().find(row => row.producto_id === id)!;
    demo.demoDeleteInventarioMovimiento(movimiento.id);
    expect(demo.demoMueblesCatalogoRows().find(row => row.id === id)).toMatchObject({ stock_disponible: 8, precio_lista: 650 });
    expect(demo.demoInventarioProductosRows().find(row => row.id === id)?.stock_actual).toBe(8);
  });

  test("la venta local descuenta ambos stocks y recargar no revierte el descuento", () => {
    crearMuebleConPrecio();
    demo.demoCreateVentaMuebleTerminado({ organization_id: DEFAULT_ORG_ID, cliente_id: "cliente-prueba",
      mueble_catalogo_id: id, cantidad: 2, precio_unitario: 650, total: 1300, fecha: "2026-10-06", chofer_id: null,
      tipo_entrega: "entrega_local", direccion_entrega: null, estado_entrega: "pendiente", metodo_pago: "efectivo",
      modalidad_pago: "contado", fecha_pago_credito: null, confirmaIngreso: false });
    expect(demo.demoInventarioProductosRows().find(row => row.id === id)?.stock_actual).toBe(6);
    vi.clearAllMocks();
    expect(demo.demoMueblesCatalogoRows().find(row => row.id === id)).toMatchObject({ stock_disponible: 6, precio_lista: 650 });
    expect(mocks.writeStoreToDisk).not.toHaveBeenCalled();
  });

  test("crear desde catálogo no inventa un costo a partir del precio de venta", () => {
    demo.demoCreateMuebleCatalogo({ organization_id: DEFAULT_ORG_ID, codigo: "CAT-PRUEBA", nombre: "Mueble desde catálogo", precio_lista: 650, stock_disponible: 4 });
    expect(demo.demoInventarioProductosRows().find(row => row.codigo === "CAT-PRUEBA")).toMatchObject({ costo_unitario: null, stock_actual: 4 });
  });
});
