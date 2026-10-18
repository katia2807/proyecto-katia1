import { describe, expect, test } from "vitest";
import { parsePdfCliente, pdfItemsToText, type PaginaPdfCliente } from "@/lib/pdf-cliente-parser";
const page = (texto: string, pagina = 1, origen: "texto" | "ocr" = "texto"): PaginaPdfCliente => ({ texto, pagina, origen });
const sheet = [
  "DOCUMENTO FICTICIO - SIN VALOR",
  "Razón social: CARPINTERIA ENSAYO DEL BOSQUE SAC",
  "RUC: 20000000001", "Dirección: Jr. Modelo 123, Tarapoto",
  "Teléfono: 999 123 456", "Correo: contacto@ejemplo.invalid",
  "Banco: BCP", "Moneda: Soles", "Titular: CARPINTERIA ENSAYO DEL BOSQUE SAC",
  "Número de cuenta: 001234567890", "CCI: 00212300012345678903",
].join("\n");
describe("Datos reales extraídos de un PDF de cliente", () => {
  test("extrae etiquetas y conserva los ceros de cuenta y CCI", () => {
    const r = parsePdfCliente([page(sheet)]);
    expect(r.campos.nombre[0].valor).toBe("CARPINTERIA ENSAYO DEL BOSQUE SAC");
    expect(r.campos.ruc[0].valor).toBe("20000000001");
    expect(r.campos.email[0].valor).toBe("contacto@ejemplo.invalid");
    expect(r.campos.tipo_persona[0].valor).toBe("empresa");
    expect(r.cuentas).toHaveLength(1);
    expect(r.cuentas[0].cuenta).toEqual({ banco: "BCP", moneda: "PEN", titular: "CARPINTERIA ENSAYO DEL BOSQUE SAC", numero: "001234567890", cci: "00212300012345678903" });
  });
  test("conserva las alternativas si figuran emisor y receptor", () => {
    const r = parsePdfCliente([page("Razón social: EMPRESA EMISORA SAC\nRUC: 20000000001\nRazón social: EMPRESA RECEPTORA SAC\nRUC: 20000000002")]);
    expect(r.campos.ruc.map(c => c.valor)).toEqual(["20000000001", "20000000002"]);
    expect(r.campos.nombre).toHaveLength(2); expect(r.advertencias.some(a => a.includes("varios valores de RUC".toLowerCase()))).toBe(true);
  });
  test("no inventa datos a partir de números sin etiqueta", () => {
    const r = parsePdfCliente([page("20000000001\n00212300012345678903\nPrecio 500\nS/ 100")]);
    expect(r.campos.ruc).toEqual([]); expect(r.campos.documento).toEqual([]); expect(r.cuentas).toEqual([]);
  });
  test("no convierte letras de OCR en dígitos", () => {
    expect(parsePdfCliente([page("RUC: 2O000000001\nNúmero de cuenta: OO12345678", 1, "ocr")]).campos.ruc).toEqual([]);
  });
  test("mantiene la evidencia y marca la lectura de escaneo", () => {
    const r = parsePdfCliente([page(sheet, 2, "ocr")]);
    expect(r.campos.ruc[0]).toMatchObject({ pagina: 2, origen: "ocr", evidencia: "RUC: 20000000001" });
    expect(r.advertencias.some(a => a.includes("escaneo"))).toBe(true);
  });
  test("DNI y RUC son campos distintos", () => {
    const r = parsePdfCliente([page("Nombres y apellidos: Rosa Prueba\nDNI: 00123456\nRUC: 10000000001")]);
    expect(r.campos.documento[0].valor).toBe("00123456"); expect(r.campos.ruc[0].valor).toBe("10000000001");
  });
  test("no usa el titular bancario como nombre del cliente", () => {
    const r = parsePdfCliente([page("Banco: BBVA\nTitular: Nombre de prueba\nCuenta: 001234567890")]);
    expect(r.campos.nombre).toEqual([]); expect(r.cuentas[0].cuenta.titular).toBe("Nombre de prueba");
  });
  test("separa bancos y monedas sin mezclar números", () => {
    const r = parsePdfCliente([page("Banco: BCP\nMoneda: Soles\nCuenta: 001234567890\nBanco: Interbank\nMoneda: USD\nCuenta: 009876543210")]);
    expect(r.cuentas.map(c => [c.cuenta.banco, c.cuenta.moneda, c.cuenta.numero])).toEqual([["BCP", "PEN", "001234567890"], ["Interbank", "USD", "009876543210"]]);
  });
  test("conserva dos cuentas del mismo banco", () => {
    const r = parsePdfCliente([page("Banco: BCP\nMoneda: Soles\nCuenta: 001234567890\nMoneda: Dólares\nCuenta: 009876543210")]);
    expect(r.cuentas.map(c => [c.cuenta.moneda, c.cuenta.numero])).toEqual([["PEN", "001234567890"], ["USD", "009876543210"]]);
  });
  test("no supone una moneda si no aparece", () => {
    const r = parsePdfCliente([page("Banco: BCP\nCuenta: 001234567890")]); expect(r.cuentas[0].cuenta.moneda).toBe("");
  });
  test("no hereda un banco a otra página", () => {
    const r = parsePdfCliente([page("Banco: BCP\nCuenta: 001234567890"), page("Cuenta: 009876543210", 2)]);
    expect(r.cuentas[1].cuenta.banco).toBe("");
  });
  test("tolera un valor en el renglón siguiente", () => {
    const r = parsePdfCliente([page("Razón social:\nEMPRESA PRUEBA SAC\nDirección:\nJr. Ejemplo 123\nBanco: BCP\nNúmero de cuenta:\n001234567890")]);
    expect(r.campos.nombre[0].valor).toBe("EMPRESA PRUEBA SAC"); expect(r.campos.direccion[0].valor).toBe("Jr. Ejemplo 123");
    expect(r.cuentas[0].cuenta.numero).toBe("001234567890");
  });
  test("omite indicaciones vacías", () => {
    const r = parsePdfCliente([page("Nombre comercial: -\nDirección: No registra\nCorreo: Sin datos")]);
    expect(r.campos.nombre).toEqual([]); expect(r.campos.direccion).toEqual([]);
  });
  test("reconstruye líneas por coordenadas y ordena columnas", () => {
    expect(pdfItemsToText([{ str: "20000000001", transform: [1, 0, 0, 1, 80, 700] }, { str: "RUC:", transform: [1, 0, 0, 1, 20, 701] }, { str: "Nombre: PRUEBA", transform: [1, 0, 0, 1, 20, 680] }])).toBe("RUC: 20000000001\nNombre: PRUEBA");
  });
});

describe("Formatos bancarios de ficha", () => {
  test.each(["Cuenta corriente en soles", "Nro. de cuenta", "Cta.", "Cuenta bancaria USD"])("reconoce %s sin quitar ceros", label => {
    const r = parsePdfCliente([page("Banco: BCP\n" + label + ": 001234567890")]);
    expect(r.cuentas[0].cuenta.numero).toBe("001234567890");
  });
  test("CCI no se duplica como cuenta normal", () => {
    const r = parsePdfCliente([page("Banco: BCP\nCuenta interbancaria: 00212300012345678903")]);
    expect(r.cuentas[0].cuenta.numero).toBe(""); expect(r.cuentas[0].cuenta.cci).toBe("00212300012345678903");
  });
  test("texto más OCR de la misma página se cuentan una sola vez", () => {
    expect(parsePdfCliente([page(sheet), page(sheet,1,"ocr")]).paginas).toBe(1);
  });
});

test("texto y escaneo complementan la misma cuenta sin duplicarla", () => {
 const r = parsePdfCliente([page("Banco: BCP\nMoneda: Soles\nCuenta: 001234567890", 1, "ocr"), page(sheet)]);
 expect(r.cuentas).toHaveLength(1); expect(r.cuentas[0].cuenta.cci).toBe("00212300012345678903");
});
test("las versiones de cuenta con CCI contradictorio se muestran para elegir", () => {
 const r = parsePdfCliente([page("Banco: BCP\nCuenta: 001234567890\nCCI: 00212300012345678903"),page("Banco: BCP\nCuenta: 001234567890\nCCI: 00212300012345678904",1,"ocr")]);
 expect(r.cuentas).toHaveLength(2); expect(r.advertencias.some(a=>a.includes("versiones distintas"))).toBe(true);
});
