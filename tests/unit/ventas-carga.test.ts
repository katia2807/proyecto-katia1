import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";
import type {} from "styled-jsx";

const mocks = vi.hoisted(() => ({
  hasSupabaseEnv: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  search: "",
  refresh: vi.fn(),
}));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/demo-store", () => ({ demoAlquilerRows: () => [] }));
vi.mock("@/lib/current-user-role", () => ({ getCurrentUserRole: async () => "readonly" }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: async () => ({ organizationId: "00000000-0000-0000-0000-000000000001" }) }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/components/ventas/ventas-hub-context-panels", () => ({ VentasHubContextPanels: () => null }));
vi.mock("@/components/ventas/ventas-pdf-import", () => ({ VentasPdfImport: () => null }));
vi.mock("@/components/inicio/ventas-pendientes-view", () => ({ VentasPendientesView: () => null }));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/data")>(),
  getClientesRows: async () => [{ id: "cliente", nombre: "Cliente local" }],
  getProveedoresRows: async () => [],
  getChoferesRows: async () => [],
  getMueblesCatalogoRows: async () => [],
  getVentasMuebleTerminadoRows: async () => [],
  getOrdenesProduccionRows: async () => [],
  getServiciosAserraderoRows: async () => [],
  getCobrosVencidos: async () => [],
  getVentasRows: async () => [{
    id: "madera", cliente_id: "cliente", fecha: "2026-10-04", correlativo: "MA-LOCAL",
    total: 100, comprobanteTipo: "venta-madera",
  }],
}));

import { DEFAULT_ORG_ID } from "@/lib/constants";
import { getAlquilerRows } from "@/lib/data";
import VentasHubPage from "@/app/(dashboard)/ventas/page";

let fallo: "respuesta" | "interrumpida" | null;
let alquileres: Record<string, unknown>[];

// El SDK real recibe respuestas locales; la página y el historial se renderizan
// juntos para comprobar que un error de datos llega al aviso visible.
const fixtureFetch: typeof fetch = async (input) => {
  const tabla = new URL(String(input)).pathname.split("/").at(-1);
  if (tabla === "alquileres" && fallo === "interrumpida") throw new DOMException("Consulta interrumpida", "AbortError");
  if (tabla === "alquileres" && fallo === "respuesta") {
    return new Response(JSON.stringify({ message: "Consulta no disponible", code: "TEST_FAILURE" }), { status: 400 });
  }
  const rows = tabla === "alquileres" ? alquileres
    : tabla === "ventas_madera" ? [{ id: "madera", cliente_id: "cliente", fecha: "2026-10-04", correlativo: "MA-LOCAL", total: 100 }]
    : tabla === "clientes" ? [{ id: "cliente", nombre: "Cliente local" }] : [];
  return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
};

async function renderHistorial() {
  return renderToStaticMarkup(await VentasHubPage({}));
}

describe("Ventas: aviso de carga de alquileres", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fallo = "respuesta";
    alquileres = [];
    mocks.search = "categoria=alquileres&buscar=Mixer";
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.getSupabaseServerClient.mockImplementation(() => createClient("https://ventas-carga.test", "test-key", {
      global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false },
    }));
  });

  test("un fallo al consultar alquileres muestra Reintentar y no afirma que la lista está vacía", async () => {
    const html = await renderHistorial();
    expect(html).toContain('role="alert"');
    expect(html).toContain("No pudimos cargar los alquileres.");
    expect(html).toContain("Reintentar");
    expect(html).toContain('aria-label="Alquileres: datos sin cargar"');
    expect(html).not.toContain("No hay resultados con estos filtros.");
    expect(html).not.toContain("MA-LOCAL");
  });

  test("un historial parcial mantiene las operaciones que se cargaron", async () => {
    mocks.search = "";
    const html = await renderHistorial();
    expect(html).toContain("El historial está incompleto.");
    expect(html).toContain("MA-LOCAL");
    expect(html).toContain("Ver detalle");
  });

  test("otras categorías siguen funcionando sin un aviso ajeno a sus resultados", async () => {
    mocks.search = "categoria=madera";
    const html = await renderHistorial();
    expect(html).toContain("MA-LOCAL");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Reintentar");
    expect(html).toContain('aria-label="Alquileres: datos sin cargar"');
  });

  test("una consulta correcta sin contratos conserva el mensaje de búsqueda vacía", async () => {
    fallo = null;
    expect(await getAlquilerRows()).toEqual({ rows: [], loadWarning: null });
    const html = await renderHistorial();
    expect(html).toContain("No hay resultados con estos filtros.");
    expect(html).not.toContain("No pudimos cargar");
    expect(html).not.toContain("Reintentar");
  });

  test("al recuperarse la consulta aparecen los alquileres y desaparece el aviso con los mismos filtros", async () => {
    expect(await renderHistorial()).toContain("Reintentar");
    fallo = null;
    alquileres = [{
      id: "alquiler-local", organization_id: DEFAULT_ORG_ID, cliente_id: "cliente",
      fecha_inicio: "2026-10-04", activo: "Bomba Mixer", codigo: "CT-LOCAL", monto_total: 650,
    }];
    const html = await renderHistorial();
    expect(html).toContain("CT-LOCAL");
    expect(html).toContain('value="Mixer"');
    expect(html).toContain("volver=%2Fventas%3Fcategoria%3Dalquileres%26buscar%3DMixer%23historial-ventas");
    expect(html).not.toContain("Reintentar");
    expect(html).not.toContain("No pudimos cargar");
  });

  test("una consulta interrumpida también se presenta como carga fallida", async () => {
    fallo = "interrumpida";
    const html = await renderHistorial();
    expect(html).toContain("No pudimos cargar los alquileres.");
    expect(html).not.toContain("No hay resultados con estos filtros.");
    expect(html).not.toContain("Consulta interrumpida");
  });
});
