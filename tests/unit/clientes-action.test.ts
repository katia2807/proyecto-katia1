import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  demoCreateCliente: vi.fn(),
  hasSupabaseEnv: vi.fn(),
  redirect: vi.fn(),
  requireAuthContext: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.requireAuthContext }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/demo-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demo-store")>();
  return { ...actual, demoCreateCliente: mocks.demoCreateCliente };
});

import { submitCreateClienteForm } from "@/app/actions";
import { mutationFormInitialState } from "@/lib/mutation-form-state";

describe("submitCreateClienteForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthContext.mockResolvedValue(undefined);
    mocks.hasSupabaseEnv.mockReturnValue(false);
    mocks.demoCreateCliente.mockReturnValue("11111111-1111-4111-8111-111111111111");
    mocks.redirect.mockImplementation((destination: string) => {
      throw Object.assign(new Error("NEXT_REDIRECT"), {
        digest: `NEXT_REDIRECT;replace;${destination};307;`,
      });
    });
  });

  test("crea una vez y devuelve éxito cuando no hay return_to", async () => {
    const formData = new FormData();
    formData.set("nombre", "Cliente sin retorno");
    formData.set("documento", "12345678");
    formData.set("telefono", "");
    formData.set("ruc", "");
    formData.set("direccion", "");
    formData.set("tipo_persona", "natural");

    await expect(submitCreateClienteForm(mutationFormInitialState, formData)).resolves.toEqual({
      success: true,
      error: null,
      message: "Cliente registrado con éxito.",
    });
    expect(mocks.demoCreateCliente).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  test("propaga la navegación interna después de persistir exactamente una vez", async () => {
    const formData = new FormData();
    formData.set("nombre", "Cliente con retorno");
    formData.set("documento", "12345678");
    formData.set("telefono", "");
    formData.set("ruc", "");
    formData.set("direccion", "");
    formData.set("tipo_persona", "natural");
    formData.set("return_to", "/ventas/clientes?tab=base_datos");

    await expect(submitCreateClienteForm(mutationFormInitialState, formData)).rejects.toMatchObject({
      message: "NEXT_REDIRECT",
      digest: "NEXT_REDIRECT;replace;/ventas/clientes?tab=base_datos;307;",
    });
    expect(mocks.demoCreateCliente).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith("/ventas/clientes?tab=base_datos");
  });

  test("reemplaza un return_to externo por el destino interno seguro", async () => {
    const formData = new FormData();
    formData.set("nombre", "Cliente retorno externo");
    formData.set("documento", "12345678");
    formData.set("telefono", "");
    formData.set("ruc", "");
    formData.set("direccion", "");
    formData.set("tipo_persona", "natural");
    formData.set("return_to", "https://example.com/phishing");

    await expect(submitCreateClienteForm(mutationFormInitialState, formData)).rejects.toMatchObject({
      message: "NEXT_REDIRECT",
      digest: "NEXT_REDIRECT;replace;/ventas;307;",
    });
    expect(mocks.demoCreateCliente).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith("/ventas");
  });

  test("devuelve los errores reales de validación sin persistir ni redirigir", async () => {
    const formData = new FormData();
    formData.set("nombre", "X");
    formData.set("documento", "");
    formData.set("telefono", "");
    formData.set("ruc", "");
    formData.set("direccion", "");
    formData.set("tipo_persona", "natural");
    formData.set("return_to", "/ventas");

    await expect(submitCreateClienteForm(mutationFormInitialState, formData)).resolves.toEqual({
      success: false,
      error: "Datos de cliente inválidos.",
      message: null,
    });
    expect(mocks.demoCreateCliente).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  test("devuelve los errores reales de persistencia sin redirigir", async () => {
    const formData = new FormData();
    formData.set("nombre", "Cliente error store");
    formData.set("documento", "12345678");
    formData.set("telefono", "");
    formData.set("ruc", "");
    formData.set("direccion", "");
    formData.set("tipo_persona", "natural");
    formData.set("return_to", "/ventas");
    mocks.demoCreateCliente.mockImplementationOnce(() => {
      throw new Error("Fallo de persistencia controlado");
    });

    await expect(submitCreateClienteForm(mutationFormInitialState, formData)).resolves.toEqual({
      success: false,
      error: "Fallo de persistencia controlado",
      message: null,
    });
    expect(mocks.demoCreateCliente).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
