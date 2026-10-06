import { describe, expect, test } from "vitest";
import { coincideEstadoCotizacion, etiquetaEstadoCotizacion } from "@/lib/cotizacion-estados";

describe("estado visible y filtro de Cotizaciones", () => {
  test("el filtro de aceptadas excluye cobradas, inactivas y deudoras", () => {
    const estados = ["pendiente", "lista_produccion", "en_produccion", "cobrada", "inactivo", "deudor"];
    expect(estados.filter((estado) => coincideEstadoCotizacion(estado, "lista_produccion"))).toEqual(["lista_produccion"]);
  });
  test("producción y cobradas conservan su estado exacto", () => {
    expect(coincideEstadoCotizacion("en_produccion", "en_produccion")).toBe(true);
    expect(coincideEstadoCotizacion("cobrada", "pendiente")).toBe(false);
    expect(etiquetaEstadoCotizacion("cobrada")).toBe("Cobrada");
    expect(etiquetaEstadoCotizacion("lista_produccion")).toBe("Cotización aceptada");
  });
  test("Todos incluye cualquier estado sin convertir uno desconocido a pendiente", () => {
    expect(coincideEstadoCotizacion("estado_histórico", "todos")).toBe(true);
    expect(etiquetaEstadoCotizacion("estado_histórico")).toBe("estado_histórico");
  });
});
