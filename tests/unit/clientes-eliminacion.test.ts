import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
const m = vi.hoisted(() => ({ auth: vi.fn(), env: vi.fn(), server: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: m.auth }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: m.env }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: m.server }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: vi.fn() }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn() }));
import { deleteCliente } from "@/app/actions";
import { getClienteEliminacion } from "@/lib/cliente-eliminacion";

const org = "00000000-0000-0000-0000-000000000001";
const id = "81000000-0000-4000-8000-000000000001";
type Row = Record<string, unknown>;
let tablas: Record<string, Row[]>;
let requests: { url: URL; method: string }[];
let fault: string | null;
let deleteMode: "normal" | "reference" | "changed" | "uncertain";
let noCount: boolean;
const refs = ["cotizaciones_mueble", "cotizaciones_unificadas", "ventas_madera", "ventas_madera_cortada", "ventas_mueble_terminado", "servicios_aserradero", "alquileres", "ordenes_produccion"];
const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.origin !== "https://clientes-eliminacion.invalid") throw new Error("La prueba bloquea conexiones externas.");
  const method = init?.method ?? "GET"; requests.push({ url, method });
  const table = url.pathname.split("/").at(-1)!;
  if (table === fault) return new Response(JSON.stringify({ code: "FICTICIO", message: "Detalle interno que no debe mostrarse" }), { status: 400 });
  const rows = (tablas[table] ?? []).filter(r => [...url.searchParams].every(([key, value]) =>
    value.startsWith("eq.") ? String(r[key]) === value.slice(3) : value === "is.null" ? r[key] == null : true));
  if (method === "HEAD") return new Response(null, { headers: noCount ? {} : { "content-range": "0-" + Math.max(0, rows.length - 1) + "/" + rows.length } });
  if (method === "DELETE") {
    if (deleteMode === "reference") return new Response(JSON.stringify({ code: "23503", message: "Referencia interna" }), { status: 409 });
    if (deleteMode === "uncertain") return new Response(JSON.stringify({ code: "FICTICIO", message: "Respuesta incierta" }), { status: 400 });
    if (deleteMode === "changed") return new Response("[]", { headers: { "content-type": "application/json" } });
    tablas[table] = tablas[table].filter(r => !rows.includes(r));
  }
  return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
};
function form(overrides: Record<string, string> = {}) {
  const f = new FormData(); Object.entries({ id, confirmacion: "ELIMINAR CLIENTE", ...overrides }).forEach(([k, v]) => f.set(k, v)); return f;
}
async function submit(f = form()) {
  await expect(deleteCliente(f)).rejects.toThrow("NEXT_REDIRECT");
  return new URL(m.redirect.mock.calls.at(-1)![0] as string, "https://katia.invalid");
}
const deletes = () => requests.filter(r => r.method === "DELETE");
describe("Eliminación ordinaria de clientes: protecciones y respuesta comprensible", () => {
  beforeEach(() => {
    vi.clearAllMocks(); fault = null; noCount = false; deleteMode = "normal"; requests = [];
    tablas = { clientes: [{ id, organization_id: org, estado: "inactivo", deleted_at: null }] };
    m.env.mockReturnValue(true);
    m.auth.mockResolvedValue({ role: "owner_admin", uiRole: "owner_admin", organizationId: org });
    m.server.mockReturnValue(createClient("https://clientes-eliminacion.invalid", "clave-ficticia", { global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false } }));
    m.redirect.mockImplementation((url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;" + url }); });
  });
  test("el cliente activo no se elimina aunque se invoque directamente la acción", async () => {
    tablas.clientes[0].estado = "activo";
    const url = await submit();
    expect(url.searchParams.get("resultado")).toBe("error");
    expect(url.searchParams.get("mensaje")).toContain("Primero marca Inactivo");
    expect(deletes()).toHaveLength(0); expect(tablas.clientes).toHaveLength(1);
  });
  test.each(refs)("bloquea registros vinculados en %s sin borrar historial", async table => {
    tablas[table] = [{ id: "registro", organization_id: org, cliente_id: id }];
    const url = await submit();
    expect(url.searchParams.get("mensaje")).toContain("registros");
    expect(url.searchParams.get("resultado")).toBe("error");
    expect(deletes()).toHaveLength(0); expect(tablas[table]).toHaveLength(1); expect(tablas.clientes).toHaveLength(1);
  });
  test("los registros archivados aún vinculados también bloquean el borrado", async () => {
    tablas.ventas_madera_cortada = [{ id: "archivada", organization_id: org, cliente_id: id, deleted_at: "2026-10-01" }];
    expect((await getClienteEliminacion(id, org))?.dependencias).toEqual([expect.objectContaining({ count: 1, label: "ventas de madera cortada" })]);
    expect((await submit()).searchParams.get("resultado")).toBe("error"); expect(deletes()).toHaveLength(0);
  });
  test("elimina solo al cliente inactivo sin vínculos y confirma éxito en Clientes 360", async () => {
    tablas.clientes.push({ id: "otro", organization_id: org, estado: "inactivo" });
    const url = await submit();
    expect(tablas.clientes.map(c => c.id)).toEqual(["otro"]);
    expect(deletes()).toHaveLength(1);
    expect(deletes()[0].url.searchParams.get("organization_id")).toBe("eq." + org);
    expect(deletes()[0].url.searchParams.get("estado")).toBe("eq.inactivo");
    expect(url.pathname).toBe("/gerencial"); expect(url.searchParams.get("tab")).toBe("clientes360");
    expect(url.searchParams.get("resultado")).toBe("exito"); expect(url.searchParams.has("cliente")).toBe(false);
    expect(m.revalidate).toHaveBeenCalledWith("/ventas/clientes");
  });
  test("el bloqueo conserva el cliente, la pestaña y el destino de eliminación", async () => {
    const url = await submit(form({ confirmacion: "" }));
    expect(url.searchParams.get("tab")).toBe("clientes360"); expect(url.searchParams.get("cliente")).toBe(id);
    expect(url.hash).toBe("#eliminar-cliente"); expect(requests).toHaveLength(0);
  });
  test("rechaza identificadores inválidos antes de consultar o mutar", async () => {
    expect((await submit(form({ id: "no-id" }))).searchParams.get("resultado")).toBe("error");
    expect(requests).toHaveLength(0);
  });
  test("una cuenta de solo lectura no llega a consultar ni eliminar", async () => {
    m.auth.mockResolvedValue({ role: "owner_admin", uiRole: "readonly", organizationId: org });
    await expect(deleteCliente(form())).rejects.toThrow("solo lectura"); expect(requests).toHaveLength(0);
  });
  test("una sesión sin permiso se rechaza antes de consultar", async () => {
    m.auth.mockRejectedValue(new Error("Acceso denegado"));
    await expect(deleteCliente(form())).rejects.toThrow("Acceso denegado"); expect(requests).toHaveLength(0);
  });
  test.each(["clientes", "alquileres"])("un fallo leyendo %s no se interpreta como permiso para eliminar", async table => {
    fault = table; const url = await submit();
    expect(url.searchParams.get("resultado")).toBe("error"); expect(url.searchParams.get("mensaje")).toContain("No pudimos comprobar");
    expect(url.searchParams.get("mensaje")).not.toContain("Detalle interno"); expect(deletes()).toHaveLength(0);
  });
  test("la ausencia del conteo no se interpreta como cero registros", async () => {
    noCount = true; expect((await submit()).searchParams.get("resultado")).toBe("error"); expect(deletes()).toHaveLength(0);
  });
  test("no consulta ni elimina datos de otra organización", async () => {
    tablas.clientes[0].organization_id = "otra";
    const url = await submit(); expect(url.searchParams.get("mensaje")).toContain("no encontrado");
    expect(deletes()).toHaveLength(0); expect(tablas.clientes).toHaveLength(1);
    expect(requests.every(r => r.url.searchParams.get("organization_id") === "eq." + org)).toBe(true);
  });
  test("las referencias de otro cliente u organización no bloquean una ficha vacía", async () => {
    tablas.alquileres = [{ cliente_id: id, organization_id: "otra" }, { cliente_id: "otro", organization_id: org }];
    expect((await submit()).searchParams.get("resultado")).toBe("exito"); expect(tablas.alquileres).toHaveLength(2);
  });
  test("un vínculo creado entre comprobación y borrado devuelve un bloqueo comprensible", async () => {
    deleteMode = "reference"; const url = await submit();
    expect(url.searchParams.get("resultado")).toBe("error"); expect(url.searchParams.get("mensaje")).toContain("registros vinculados");
    expect(tablas.clientes).toHaveLength(1); expect(m.revalidate).not.toHaveBeenCalled();
  });
  test("una respuesta incierta no afirma que se borró o conservó la ficha", async () => {
    deleteMode = "uncertain"; const url = await submit();
    expect(url.searchParams.get("resultado")).toBe("error");
    expect(url.searchParams.get("mensaje")).toContain("No pudimos confirmar");
    expect(url.searchParams.get("mensaje")).toContain("antes de reintentar");
    expect(m.revalidate).not.toHaveBeenCalled();
  });
  test("un estado cambiado antes del DELETE no se presenta como borrado exitoso", async () => {
    deleteMode = "changed"; const url = await submit();
    expect(url.searchParams.get("resultado")).toBe("error"); expect(url.searchParams.get("mensaje")).toContain("cambió");
    expect(tablas.clientes).toHaveLength(1);
  });
  test("los clientes antiguos sin estado conservan su tratamiento compatible", async () => {
    tablas.clientes[0].estado = null;
    expect((await submit()).searchParams.get("resultado")).toBe("exito");
    expect(deletes()[0].url.searchParams.get("estado")).toBe("is.null");
  });
});
