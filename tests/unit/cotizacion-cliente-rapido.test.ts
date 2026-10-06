import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthContext: vi.fn(),
  hasSupabaseEnv: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.requireAuthContext }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn() }));
vi.mock("@/lib/company-config", () => ({ getEmpresaConfig: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: vi.fn() }));

import { createClienteCotizacionRapida, updateClienteCotizacionRapida } from "@/app/actions";
import { demoClientesRows, demoCreateCliente } from "@/lib/demo-store";
import { DEFAULT_ORG_ID } from "@/lib/constants";

const clienteId = "91919191-9191-4191-8191-919191919191";
const datos = {
  nombre: "Cliente ficticio",
  documento: "00000000",
  telefono: "",
  direccion: "Dirección ficticia",
  tipoPersona: "natural" as "natural" | "empresa",
};

describe("completar el cliente recién registrado en Cotizaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "owner_admin" });
    mocks.hasSupabaseEnv.mockReturnValue(false);
    const query = { eq: mocks.eq, is: mocks.is, select: mocks.select, maybeSingle: mocks.maybeSingle };
    mocks.update.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.is.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.maybeSingle.mockResolvedValue({ data: { id: clienteId }, error: null });
    mocks.getSupabaseServerClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ update: mocks.update, insert: mocks.insert }),
    });
  });

  test("crear sin documento y completarlo conserva un solo cliente y su ID", async () => {
    const antes = demoClientesRows().length;
    const creado = await createClienteCotizacionRapida({ ...datos, documento: "", direccion: "" });
    expect(creado.ok).toBe(true);
    if (!creado.ok) throw new Error(creado.error);
    const original = { ...demoClientesRows().find((cliente) => cliente.id === creado.id)! };

    await expect(updateClienteCotizacionRapida(creado.id, datos)).resolves.toEqual({ ok: true, id: creado.id });
    await expect(updateClienteCotizacionRapida(creado.id, datos)).resolves.toEqual({ ok: true, id: creado.id });

    expect(demoClientesRows()).toHaveLength(antes + 1);
    expect(demoClientesRows().find((cliente) => cliente.id === creado.id)).toEqual({
      ...original, documento: datos.documento, direccion: datos.direccion,
    });
  });

  test("una empresa conserva el tipo y su RUC al completar datos", async () => {
    const empresa = { ...datos, nombre: "Empresa ficticia", tipoPersona: "empresa" as const, documento: "20000000000" };
    const creado = await createClienteCotizacionRapida({ ...empresa, direccion: "" });
    if (!creado.ok) throw new Error(creado.error);
    await updateClienteCotizacionRapida(creado.id, empresa);
    expect(demoClientesRows().find((cliente) => cliente.id === creado.id)).toMatchObject({
      tipo_persona: "empresa", documento: empresa.documento, ruc: empresa.documento, direccion: empresa.direccion,
    });
  });

  test("un cliente inexistente no se sustituye por un alta nueva", async () => {
    const antes = demoClientesRows().length;
    await expect(updateClienteCotizacionRapida(clienteId, datos)).resolves.toMatchObject({ ok: false });
    expect(demoClientesRows()).toHaveLength(antes);
  });

  test("no modifica clientes de otra organización", async () => {
    const id = demoCreateCliente({
      organization_id: "92929292-9292-4292-8292-929292929292",
      nombre: "Cliente de otra organización", documento: null, telefono: null,
      direccion: null, tipo_persona: "natural", ruc: null,
    });
    const antes = { ...demoClientesRows().find((cliente) => cliente.id === id)! };
    await expect(updateClienteCotizacionRapida(id, datos)).resolves.toMatchObject({ ok: false });
    expect(demoClientesRows().find((cliente) => cliente.id === id)).toEqual(antes);
  });

  test("el guardado real filtra ID, organización y registros no eliminados; no inserta", async () => {
    mocks.hasSupabaseEnv.mockReturnValue(true);
    await expect(updateClienteCotizacionRapida(clienteId, { ...datos, nombre: "  Cliente ficticio  " }))
      .resolves.toEqual({ ok: true, id: clienteId });
    expect(mocks.update).toHaveBeenCalledWith({
      nombre: datos.nombre, documento: datos.documento, telefono: null,
      direccion: datos.direccion, tipo_persona: "natural", ruc: null,
    });
    expect(mocks.eq).toHaveBeenCalledWith("id", clienteId);
    expect(mocks.eq).toHaveBeenCalledWith("organization_id", DEFAULT_ORG_ID);
    expect(mocks.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  test("un fallo de la base devuelve error sin insertar un reemplazo", async () => {
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "Fallo de prueba" } });
    await expect(updateClienteCotizacionRapida(clienteId, datos)).resolves.toEqual({ ok: false, error: "Fallo de prueba" });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("un registro no encontrado en la base devuelve error sin insertar", async () => {
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(updateClienteCotizacionRapida(clienteId, datos)).resolves.toMatchObject({ ok: false });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  test("rechaza un ID inválido antes de consultar datos", async () => {
    await expect(updateClienteCotizacionRapida("id-inválido", datos)).resolves.toMatchObject({ ok: false });
    expect(mocks.getSupabaseServerClient).not.toHaveBeenCalled();
  });

  test("mantiene la comprobación de permisos", async () => {
    mocks.requireAuthContext.mockRejectedValue(new Error("Acceso denegado"));
    const antes = demoClientesRows().length;
    await expect(updateClienteCotizacionRapida(clienteId, datos)).resolves.toEqual({ ok: false, error: "Acceso denegado" });
    expect(demoClientesRows()).toHaveLength(antes);
    expect(mocks.getSupabaseServerClient).not.toHaveBeenCalled();
  });
});
