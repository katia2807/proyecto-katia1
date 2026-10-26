import { describe, expect, it } from "vitest";
import { clienteParaComprobante, entregaParaComprobante } from "@/lib/comprobante-presentacion";
import { buildMaderaCortadaPrintModel, getMaderaCortadaCustomerItems } from "@/lib/madera-cortada-print-model";
import { buildAserraderoPrintModel } from "@/lib/aserradero-print-model";

describe("Datos de cliente visibles en comprobantes", () => {
  it.each([null, "", "   ", "PEND-12345678-1234-4000-8000-123456789012", " pend-provisional "])("no presenta %s como DNI/RUC", documento => {
    const source = Object.freeze({ nombre: "Cliente pendiente", documento, ruc: "" });
    expect(clienteParaComprobante(source)).toEqual({ nombre: "Cliente pendiente", documento: null, tipoDocumento: null });
    expect(source.documento).toBe(documento);
  });
  it("usa el DNI real cuando el RUC está vacío", () => {
    expect(clienteParaComprobante({ nombre: "Cliente de prueba", documento: "12345678", ruc: " " })).toEqual({ nombre: "Cliente de prueba", documento: "12345678", tipoDocumento: "DNI" });
  });
  it("conserva un RUC real aunque la referencia antigua sea provisional", () => {
    expect(clienteParaComprobante({ nombre: "Empresa de prueba", documento: "PEND-interno", ruc: "20123456789" })).toMatchObject({ documento: "20123456789", tipoDocumento: "RUC" });
  });
  it("no inventa nombre ni documento al faltar la ficha", () => {
    expect(clienteParaComprobante(null)).toEqual({ nombre: "—", documento: null, tipoDocumento: null });
  });
  it("conserva documentos distintos a DNI/RUC sin reclasificarlos", () => {
    expect(clienteParaComprobante({ nombre: "Cliente", documento: "AB1234567" })).toMatchObject({ documento: "AB1234567", tipoDocumento: "Documento" });
  });
});

describe("Entrega legible sin alterar direcciones", () => {
  it.each([["entrega_local", "Entrega en local"], ["entrega local", "Entrega en local"], ["puesto_en_obra", "Puesto en obra"], ["envio", "Envío"], ["recojo", "Recojo"], [null, "—"]])("presenta %s como %s", (value, expected) => {
    expect(entregaParaComprobante(value)).toBe(expected);
  });
  it("solo transforma el tipo de entrega, conservando el texto de la dirección", () => {
    expect(entregaParaComprobante("puesto_en_obra — Pasaje_A 123 — Taller")).toBe("Puesto en obra — Pasaje_A 123 — Taller");
    expect(entregaParaComprobante("Entrega pactada con el cliente")).toBe("Entrega pactada con el cliente");
  });
});

function woodSource(description: string) {
  return {
    tipo_corte: "tabla", tipo_comprobante: "boleta", total: 266.67,
    lineas_comprobante: [{ orden: 0, descripcion: description, cantidad: 20, unidad: "pzs", espesor: 2, ancho: 2, largo: 10, precio_unitario: 13.333333333333334, subtotal: 266.67 }],
  };
}
describe("Descripción y medidas: presentación sin cambiar la venta", () => {
  it("conserva el nombre comercial sin anteponer un tipo de corte global", () => {
    const source = woodSource("Cuartones de madera");
    const original = JSON.stringify(source);
    const model = buildMaderaCortadaPrintModel(source);
    expect(model.items[0].desc).toBe("Cuartones de madera");
    expect(model.items[0].medidas).toBe("2 pulg × 2 pulg × 10 pies");
    expect(model.items[0].advertenciaMedidas).toBeUndefined();
    expect(model.items[0]).toMatchObject({ quantityValue: 20, unitPriceValue: 13.333333333333334, subtotalValue: 266.67 });
    expect(model.totalSoles).toBe(266.67);
    expect(JSON.stringify(source)).toBe(original);
  });
  it.each(['Tablones 2.5" x 25 cm x 10 m', "Cuartones 2 x 2 x 3m", "Tablón, largo 10 metros"])("señala la referencia métrica de %s sin convertirla", description => {
    const source = woodSource(description); const original = JSON.stringify(source);
    const model = buildMaderaCortadaPrintModel(source);
    const customerItems = getMaderaCortadaCustomerItems(model.items, model.totalSoles);
    expect(customerItems[0].desc).toBe(description);
    expect(customerItems[0].advertenciaMedidas).toContain("registrado es 10 pies");
    expect(customerItems[0].medidas).toBe("2 pulg × 2 pulg × 10 pies");
    expect(customerItems[0].total).toContain("266.67");
    expect(JSON.stringify(source)).toBe(original);
  });
  it("no confunde un ancho en centímetros con un largo explícito en pies", () => {
    const model = buildMaderaCortadaPrintModel(woodSource('Tablones 2.5" x 25 cm x 10 pies'));
    expect(model.items[0].advertenciaMedidas).toBeUndefined();
  });
  it("no inventa medidas en una venta histórica que no las tiene guardadas", () => {
    const model = buildMaderaCortadaPrintModel({ tipo_corte: "tabla", total: 100, cantidad_piezas: 2, precio_unitario_comercial: 50 });
    expect(model.items[0].medidas).toBeUndefined();
    expect(model.items[0].advertenciaMedidas).toBeUndefined();
    expect(model.totalSoles).toBe(100);
  });
  it("mantiene cantidades, unitarios y totales de las tres líneas del ejemplo", () => {
    const prices = [13.333333333333334, 83.33333333333333, 66.66666666666667];
    const amounts = [266.67, 1333.33, 533.33];
    const quantities = [20, 16, 8];
    const model = buildMaderaCortadaPrintModel({ tipo_corte: "tabla", total: 2133.33, lineas_comprobante: prices.map((price, index) => ({
      orden: index, descripcion: "Producto " + index, cantidad: quantities[index], espesor: 2, ancho: 2, largo: 10, precio_unitario: price, subtotal: amounts[index],
    })) });
    expect(model.items.map(i => [i.quantityValue, i.unitPriceValue, i.subtotalValue])).toEqual(quantities.map((q, i) => [q, prices[i], amounts[i]]));
    expect(model.totalSoles).toBe(2133.33);
  });
  it("sanear el cliente de Aserradero no modifica PT, importes ni pagos", () => {
    const service = { id: "aserradero-ficticio", fecha: "2026-10-26", lineas_json: [], costo_cubicaje: 100, precio_cobrado: 100, pies_cubicos: 10 };
    const normal = buildAserraderoPrintModel({ service, customer: { nombre: "Cliente", documento: "12345678" }, tipoComprobante: "boleta" });
    const provisional = buildAserraderoPrintModel({ service, customer: { nombre: "Cliente pendiente", documento: "PEND-interno" }, tipoComprobante: "boleta" });
    expect(provisional.customer.documento).toBeNull();
    expect(provisional.totals).toEqual(normal.totals);
    expect(provisional.payment).toEqual(normal.payment);
  });
});
