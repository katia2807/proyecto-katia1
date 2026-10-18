import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const migration = readFileSync("supabase/migrations/20261018010000_contacto_cliente_opcional.sql", "utf8");
let db: PGlite;
describe("Migración de contacto opcional — Postgres aislado", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec("CREATE TABLE clientes(id text PRIMARY KEY, nombre text, estado text); INSERT INTO clientes VALUES('anterior','Cliente conservado','vip'); CREATE TABLE caja(id text, total numeric); INSERT INTO caja VALUES('movimiento',123.45)");
  }, 30000);
  afterAll(async () => { await db.close(); });
  test("puede repetirse sin alterar campos previos ni Caja", async () => {
    await db.exec(migration); await db.exec(migration);
    expect((await db.query("SELECT * FROM clientes")).rows).toEqual([{ id: "anterior", nombre: "Cliente conservado", estado: "vip", datos_adicionales: {} }]);
    expect((await db.query("SELECT total::text FROM caja")).rows).toEqual([{ total: "123.45" }]);
  });
  test("conserva cuentas como texto con ceros iniciales", async () => {
    const contact = { email: "prueba@ejemplo.invalid", cuentas_bancarias: [{ banco: "BCP", numero: "001234567890", cci: "00212300012345678903" }] };
    await db.query("UPDATE clientes SET datos_adicionales=$1 WHERE id='anterior'", [contact]);
    expect((await db.query("SELECT datos_adicionales FROM clientes")).rows).toEqual([{ datos_adicionales: contact }]);
  });
  test.each([[], null, { cuentas_bancarias: "incorrecto" }, { cuentas_bancarias: [{}, {}, {}, {}, {}, {}] }, { email: "a".repeat(12000) }])("rechaza metadata incompatible %#", async bad => {
    await expect(db.query("UPDATE clientes SET datos_adicionales=$1 WHERE id='anterior'", [bad])).rejects.toThrow();
    expect((await db.query("SELECT estado FROM clientes")).rows).toEqual([{ estado: "vip" }]);
  });
});
