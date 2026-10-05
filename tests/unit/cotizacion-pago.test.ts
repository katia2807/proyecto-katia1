import { describe, expect, test } from "vitest";
import { cotizacionDetalleV1Schema, defaultCotizacionDetalleV1, parseCotizacionDetalle, type CondicionesPagoCotizacion } from "@/lib/cotizacion-unificada-payload";
import { lineasCondicionesPagoCotizacion, medioSugeridoCotizacion, notasDocumentoCotizacion, validarCondicionesPagoCotizacion } from "@/lib/cotizacion-pago";

const pago: CondicionesPagoCotizacion = { metodo: "transferencia", modalidad: "adelanto_saldo", adelanto: 200, plazo: 15, plazoUnidad: "dias" };

describe("Condiciones acordadas de cotización", () => {
  test("guardar y reabrir conserva medio, adelanto y plazo sin convertirlos en un cobro", () => {
    const detalle = { ...defaultCotizacionDetalleV1(), condiciones_pago: pago, notas_generales: "Entrega el viernes." };
    const recuperado = parseCotizacionDetalle(JSON.parse(JSON.stringify(cotizacionDetalleV1Schema.parse(detalle))));
    expect(recuperado.condiciones_pago).toEqual(pago);
    const notas = notasDocumentoCotizacion(recuperado, 650);
    expect(notas).toContain("Entrega el viernes.");
    expect(notas).toContain("Transferencia bancaria");
    expect(notas).toContain("Adelanto + saldo");
    expect(notas).toContain("Adelanto acordado: S/ 200.00");
    expect(notas).toContain("Saldo previsto: S/ 450.00");
    expect(notas).toContain("15 días");
    expect(notas).not.toContain("adelantado");
    expect(notas).not.toContain("recibido");
  });
  test("los históricos mantienen sus notas sin inventar condiciones", () => {
    const detalle = defaultCotizacionDetalleV1();
    detalle.notas_generales = "Condición original";
    expect(parseCotizacionDetalle(detalle).condiciones_pago).toBeUndefined();
    expect(notasDocumentoCotizacion(detalle, 650)).toBe("Condición original");
    expect(medioSugeridoCotizacion()).toBe("efectivo");
  });
  test("crédito y contado muestran las condiciones que les corresponden", () => {
    expect(lineasCondicionesPagoCotizacion({ ...pago, modalidad: "credito", plazoUnidad: "meses" }, 650).join("\n")).toContain("15 meses");
    const contado = lineasCondicionesPagoCotizacion({ ...pago, modalidad: "contado" }, 650).join("\n");
    expect(contado).toContain("Contado");
    expect(contado).not.toContain("Adelanto");
    expect(contado).not.toContain("Plazo");
  });
  test.each(["adelanto", "adelanto_saldo"] as const)("rechaza adelantos inválidos en modalidad %s", (modalidad) => {
    for (const adelanto of [undefined, 0, -1, 650.01, Infinity]) {
      expect(validarCondicionesPagoCotizacion({ ...pago, modalidad, adelanto }, 650)).toBeTruthy();
    }
    expect(validarCondicionesPagoCotizacion({ ...pago, modalidad, adelanto: 650 }, 650)).toBeNull();
  });
  test("el plazo necesita una unidad y un número entero positivo", () => {
    for (const plazo of [undefined, 0, -1, 1.5, Infinity]) {
      expect(validarCondicionesPagoCotizacion({ ...pago, modalidad: "credito", plazo }, 650)).toBeTruthy();
    }
    expect(validarCondicionesPagoCotizacion({ ...pago, plazoUnidad: undefined }, 650)).toBeTruthy();
    expect(validarCondicionesPagoCotizacion(undefined, 650)).toBeNull();
  });
  test.each([
    ["transferencia", "banco"], ["yape", "yape"], ["efectivo", "efectivo"],
    ["billetera_digital", "otro"], ["otro", "otro"],
  ] as const)("sugiere el medio de Caja para %s", (metodo, esperado) => {
    expect(medioSugeridoCotizacion({ ...pago, metodo })).toBe(esperado);
  });
});
