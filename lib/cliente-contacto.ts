import { z } from "zod";

const digits = (value: string) => value.replace(/[\s-]/g, "");
export const cuentaClienteSchema = z.object({
  banco: z.string().trim().max(100),
  moneda: z.enum(["", "PEN", "USD"]).default(""),
  numero: z.string().trim().max(40).transform(digits).refine(v => !v || /^\d{6,30}$/.test(v), "Revisa el número de cuenta; conserva sus ceros iniciales."),
  cci: z.string().trim().max(32).transform(digits).refine(v => !v || /^\d{20}$/.test(v), "El CCI debe tener 20 dígitos."),
  titular: z.string().trim().max(180).default(""),
}).strict().refine(v => !!v.banco && !!(v.numero || v.cci), "Indica el banco y un número de cuenta o CCI.");
export type CuentaCliente = z.infer<typeof cuentaClienteSchema>;
export const datosContactoClienteSchema = z.object({
  email: z.string().trim().max(254).refine(v => !v || z.email().safeParse(v).success, "Revisa el correo electrónico.").default(""),
  cuentas_bancarias: z.array(cuentaClienteSchema).max(5, "Puedes registrar hasta cinco cuentas.").default([]),
}).strict();
export type DatosContactoCliente = z.infer<typeof datosContactoClienteSchema>;

const mismoBanco = (a: string, b: string) => a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");
export function esMismaReferenciaCuenta(a: CuentaCliente, b: CuentaCliente): boolean {
  return !!((a.cci && b.cci && a.cci === b.cci) || (a.numero && b.numero && a.banco && b.banco && a.numero === b.numero && mismoBanco(a.banco, b.banco)));
}
export function cuentasCompatiblesCliente(a: CuentaCliente, b: CuentaCliente): boolean {
  return esMismaReferenciaCuenta(a, b) && (!a.numero || !b.numero || a.numero === b.numero)
    && (!a.cci || !b.cci || a.cci === b.cci) && (!a.moneda || !b.moneda || a.moneda === b.moneda)
    && (!a.banco || !b.banco || mismoBanco(a.banco, b.banco));
}
export function combinarCuentasCliente(existing: CuentaCliente[], incoming: CuentaCliente[]): CuentaCliente[] {
  const combined = existing.map(c => ({ ...c }));
  for (const account of incoming) {
    const previous = combined.find(c => cuentasCompatiblesCliente(c, account));
    if (previous) { for (const key of ["banco", "moneda", "numero", "cci", "titular"] as const) if (!previous[key]) Object.assign(previous, { [key]: account[key] }); }
    else combined.push({ ...account });
  }
  return combined;
}
export const contactoClienteVacio = (): DatosContactoCliente => ({ email: "", cuentas_bancarias: [] });
/** Solo lectura de fichas anteriores. El guardado usa la validación estricta. */
export function leerContactoCliente(value: unknown): DatosContactoCliente {
  const parsed = datosContactoClienteSchema.safeParse(value);
  return parsed.success ? parsed.data : contactoClienteVacio();
}
export function parseContactoCliente(raw: unknown): DatosContactoCliente {
  if (typeof raw !== "string" || raw.length > 12000) throw new Error("Los datos adicionales no son válidos.");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Los datos adicionales no son válidos."); }
  const parsed = datosContactoClienteSchema.safeParse(value);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Revisa los datos adicionales.");
  const accounts = parsed.data.cuentas_bancarias;
  if (accounts.some((a, i) => accounts.slice(0, i).some(b => esMismaReferenciaCuenta(a, b)))) throw new Error("Hay una cuenta bancaria repetida.");
  return parsed.data;
}

export const clienteFichaSnapshotSchema = z.object({
  nombre: z.string().max(500),
  documento: z.string().max(100).nullable(),
  ruc: z.string().max(100).nullable(),
  telefono: z.string().max(100).nullable(),
  direccion: z.string().max(1000).nullable(),
  tipo_persona: z.enum(["natural", "empresa"]).nullable(),
  datos_adicionales: z.record(z.string(), z.unknown()),
}).strict();
export type ClienteFichaSnapshot = z.infer<typeof clienteFichaSnapshotSchema>;
export function clienteFichaSnapshot(row: {
  nombre: string; documento?: string | null; ruc?: string | null; telefono?: string | null;
  direccion?: string | null; tipo_persona?: "natural" | "empresa" | null; datos_adicionales?: unknown;
}): ClienteFichaSnapshot {
  return { nombre: row.nombre, documento: row.documento ?? null, ruc: row.ruc ?? null,
    telefono: row.telefono ?? null, direccion: row.direccion ?? null, tipo_persona: row.tipo_persona ?? null,
    datos_adicionales: row.datos_adicionales && typeof row.datos_adicionales === "object" && !Array.isArray(row.datos_adicionales)
      ? row.datos_adicionales as Record<string, unknown> : {} };
}
