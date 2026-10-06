import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(), hasSupabaseEnv: vi.fn(), compressImage: vi.fn(),
  mkdir: vi.fn(), writeFile: vi.fn(), upload: vi.fn(), getPublicUrl: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  getAuthContext: mocks.getAuthContext,
  WRITER_ROLES: ["owner_admin", "gerencia", "operaciones_caja", "ventas", "rrhh"],
}));
vi.mock("@/lib/image-compress", () => ({ compressImage: mocks.compressImage }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/server-data-dir", () => ({ getServerWritableDataDir: () => "/prueba-en-memoria" }));
vi.mock("node:fs/promises", () => ({ mkdir: mocks.mkdir, writeFile: mocks.writeFile }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: () => ({
  storage: { from: () => ({ upload: mocks.upload, getPublicUrl: mocks.getPublicUrl }) },
}) }));

import { subirArchivo } from "@/lib/archivo-upload";
import { POST } from "@/app/api/uploads/route";

const org = "organizacion-de-prueba";
function archivo(tipo = "application/pdf", contenido: BlobPart = "comprobante de prueba") {
  return new File([contenido], tipo === "application/pdf" ? "prueba.pdf" : "prueba.png", { type: tipo });
}
function peticion(bucket = "caja", file: File = archivo()) {
  const datos = new FormData();
  datos.set("bucket", bucket);
  datos.set("file", file);
  return new Request("http://localhost/api/uploads", { method: "POST", body: datos });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mocks.getAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: null, organizationId: org });
  mocks.hasSupabaseEnv.mockReturnValue(false);
  mocks.compressImage.mockImplementation(async file => file);
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.writeFile.mockResolvedValue(undefined);
  mocks.upload.mockResolvedValue({ error: null });
  mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: "https://storage.example/prueba.pdf" } });
});

describe("subida del comprobante", () => {
  test("no devuelve una URL hasta que la subida lenta termina", async () => {
    let completar!: (respuesta: Response) => void;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>(resolve => { completar = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    let termino = false;
    const subida = subirArchivo(archivo(), "caja").then(url => { termino = true; return url; });
    await Promise.resolve();
    expect(termino).toBe(false);
    const datos = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(datos.get("bucket")).toBe("caja");
    expect((datos.get("file") as File).type).toBe("application/pdf");
    completar(Response.json({ url: "/api/uploads/caja/prueba.pdf" }));
    expect(await subida).toBe("/api/uploads/caja/prueba.pdf");
    expect(termino).toBe(true);
    expect(mocks.compressImage).not.toHaveBeenCalled();
  });

  test("espera a preparar la imagen y envía el archivo optimizado", async () => {
    let preparar!: (file: File) => void;
    mocks.compressImage.mockImplementation(() => new Promise(resolve => { preparar = resolve; }));
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ url: "/foto.jpg" }));
    vi.stubGlobal("fetch", fetchMock);
    const subida = subirArchivo(archivo("image/png"), "caja");
    expect(fetchMock).not.toHaveBeenCalled();
    preparar(new File(["foto optimizada"], "foto.jpg", { type: "image/jpeg" }));
    expect(await subida).toBe("/foto.jpg");
    expect((fetchMock.mock.calls[0][1].body.get("file") as File).type).toBe("image/jpeg");
  });

  test("permite reintentar el mismo archivo después de perder la conexión", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(Response.json({ url: "/comprobante.pdf" }));
    vi.stubGlobal("fetch", fetchMock);
    const file = archivo();
    await expect(subirArchivo(file, "caja")).rejects.toThrow("Revisa la conexión");
    expect(await subirArchivo(file, "caja")).toBe("/comprobante.pdf");
  });

  test.each([{}, { url: "" }, { url: 123 }, { url: "   " }, null])("no confirma respuestas sin URL válida: %j", async resultado => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(resultado)));
    await expect(subirArchivo(archivo(), "caja")).rejects.toThrow("No se pudo subir");
  });
  test("explica los límites del archivo y no muestra errores internos del servidor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ error: "Máximo 5 MB." }, { status: 413 }))
      .mockResolvedValueOnce(new Response("error interno", { status: 500 })));
    await expect(subirArchivo(archivo(), "caja")).rejects.toThrow("Máximo 5 MB.");
    await expect(subirArchivo(archivo(), "caja")).rejects.toThrow("Vuelve a seleccionarlo");
  });
});

describe("permisos y almacenamiento del comprobante", () => {
  test.each(["owner_admin", "gerencia", "caja", "operaciones_caja"])("permite adjuntar al rol de Caja %s", async role => {
    mocks.getAuthContext.mockResolvedValue({ role, uiRole: null, organizationId: org });
    const respuesta = await POST(peticion());
    expect(respuesta.status).toBe(200);
    expect((await respuesta.json()).url).toMatch(/^\/api\/uploads\/caja\/.*\.pdf$/);
    expect(mocks.writeFile).toHaveBeenCalledOnce();
  });
  test.each(["vendedor", "partner_readonly", "almacen", "ventas", "rrhh"])("no permite subir a Caja con el rol %s", async role => {
    mocks.getAuthContext.mockResolvedValue({ role, uiRole: null, organizationId: org });
    expect((await POST(peticion())).status).toBe(403);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
  test("respeta el rol de solo lectura y conserva los permisos existentes de otros apartados", async () => {
    mocks.getAuthContext.mockResolvedValue({ role: "owner_admin", uiRole: "readonly", organizationId: org });
    expect((await POST(peticion())).status).toBe(403);
    mocks.getAuthContext.mockResolvedValue({ role: "ventas", uiRole: null, organizationId: org });
    expect((await POST(peticion("muebles"))).status).toBe(200);
    mocks.getAuthContext.mockResolvedValue({ role: "caja", uiRole: null, organizationId: org });
    expect((await POST(peticion("muebles"))).status).toBe(403);
  });
  test("rechaza una petición sin sesión antes de leer el archivo", async () => {
    mocks.getAuthContext.mockResolvedValue(null);
    const leer = vi.fn();
    expect((await POST({ formData: leer } as unknown as Request)).status).toBe(401);
    expect(leer).not.toHaveBeenCalled();
  });
  test.each([
    ["caja", archivo("text/plain"), 400], ["otro", archivo(), 400],
    ["caja", archivo("application/pdf", ""), 400],
    ["caja", archivo("application/pdf", new Uint8Array(5 * 1024 * 1024 + 1)), 413],
  ])("rechaza archivos inválidos sin escribir (%s, %s)", async (bucket, file, status) => {
    expect((await POST(peticion(bucket as string, file as File))).status).toBe(status);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
  test("guarda en la organización de la sesión y conserva el contenido y el tipo del PDF", async () => {
    mocks.hasSupabaseEnv.mockReturnValue(true);
    expect((await POST(peticion())).status).toBe(200);
    const [ruta, buffer, opciones] = mocks.upload.mock.calls[0];
    expect(ruta).toMatch(new RegExp(`^${org}/.*\\.pdf$`));
    expect(buffer.toString()).toBe("comprobante de prueba");
    expect(opciones.contentType).toBe("application/pdf");
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
});
