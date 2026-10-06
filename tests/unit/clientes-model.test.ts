import { describe, expect, test } from "vitest";
import { clientesHref, coincideCliente, documentoCliente, etiquetaTipoCliente, filtrosClientes, importeCliente, safeClientesReturn } from "@/lib/clientes-model";

describe("Clientes: filtros y datos consistentes", () => {
  test("encuentra un RUC guardado separado del documento", () => {
    const cliente = { nombre: "Empresa", documento: "00000001", ruc: "20000000001", tipo_persona: "empresa" };
    expect(coincideCliente(cliente, filtrosClientes({ q: cliente.ruc }))).toBe(true);
    expect(coincideCliente(cliente, filtrosClientes({ q: cliente.documento }))).toBe(true);
    expect(documentoCliente({ documento: " ", ruc: cliente.ruc })).toBe(cliente.ruc);
  });
  test("tipo ausente no se convierte en persona natural", () => {
    expect(etiquetaTipoCliente(null)).toBe("Sin especificar");
  });
  test("el regreso conserva los filtros admitidos y la escritura del nombre", () => {
    const filtros = filtrosClientes({ q: "Empresa Revisión", tipo: "empresa", estado: "vip", tab: "base_datos" });
    expect(safeClientesReturn(clientesHref(filtros))).toBe(clientesHref(filtros));
    expect(filtros.q).toBe("Empresa Revisión");
  });
  test.each(["https://evil.test/ventas/clientes?q=hola", "//evil.test/ventas/clientes", "/ventas/clientes/otro", "/ventas?buscar=hola"])("bloquea un regreso ajeno al listado: %s", raw => {
    expect(safeClientesReturn(raw)).toBe("/ventas/clientes");
  });
  test("parámetros desconocidos vuelven al listado habitual", () => {
    expect(filtrosClientes({ tab: "otro", estado: "otro", tipo: "otro" })).toEqual({ tab: "compradores", q: "", tipo: "", estado: "" });
  });
  test("importe ausente no se presenta como cero y cero explícito sí es válido", () => {
    expect(importeCliente(null)).toBeNull(); expect(importeCliente(0)).toBe(0); expect(importeCliente(Number.NaN)).toBeNull();
  });
});
