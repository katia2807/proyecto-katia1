import { describe, expect, test } from "vitest";
import { parseContactoCliente, leerContactoCliente } from "@/lib/cliente-contacto";
const cuenta = (extra = {}) => ({ banco: "BCP", moneda: "PEN", numero: "001234567890", cci: "00212300012345678903", titular: "ENSAYO SAC", ...extra });
const parse = (value: unknown) => parseContactoCliente(JSON.stringify(value));
describe("Contacto y cuentas opcionales del cliente", () => {
  test("fichas anteriores siguen sin campos obligatorios nuevos", () => {
    expect(leerContactoCliente(undefined)).toEqual({ email: "", cuentas_bancarias: [] }); expect(parse({})).toEqual({ email: "", cuentas_bancarias: [] });
  });
  test("conserva ceros y normaliza separadores sin convertir en número", () => {
    const c = parse({ email: "prueba@ejemplo.invalid", cuentas_bancarias: [cuenta({ numero: "001-234 567890" })] }).cuentas_bancarias[0];
    expect(c.numero).toBe("001234567890"); expect(typeof c.cci).toBe("string");
  });
  test.each([{ email: "correo roto" }, { cuentas_bancarias: [cuenta({ cci: "123" })] }, { cuentas_bancarias: [cuenta({ numero: "0012O456" })] }, { cuentas_bancarias: [cuenta({ banco: "" })] }, { cuentas_bancarias: [cuenta({ numero: "", cci: "" })] }])("rechaza datos incompletos en el servidor", value => { expect(() => parse(value)).toThrow(); });
  test("rechaza claves ajenas al contacto", () => { expect(() => parse({ total: 100, email: "" })).toThrow(); });
  test("rechaza una cuenta repetida", () => { expect(() => parse({ cuentas_bancarias: [cuenta(), cuenta()] })).toThrow(/repetida/); });
  test("limita número de cuentas y tamaño de entrada", () => {
    expect(() => parse({ cuentas_bancarias: Array.from({ length: 6 }, (_, i) => cuenta({ numero: String(i).padStart(12, "0"), cci: "" })) })).toThrow();
    expect(() => parseContactoCliente(" ".repeat(12001))).toThrow();
  });
});
