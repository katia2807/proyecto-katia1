import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  hasSupabaseEnv: vi.fn(), getSupabaseServerClient: vi.fn(),
  demoCotizacionesUnificadasRows: vi.fn(), demoAlquilerRows: vi.fn(), demoVentasRows: vi.fn(),
  demoVentasMuebleTerminadoRows: vi.fn(), demoServiciosAserraderoRows: vi.fn(),
  demoClientesRows: vi.fn(), demoMueblesCatalogoRows: vi.fn(),
}));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock("@/lib/demo-store", () => mocks);

import { getVentasHistorial } from "@/lib/ventas-historial-data";
import { VentasListWithFilters } from "@/components/ventas/ventas-list-with-filters";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { defaultCotizacionDetalleV1 } from "@/lib/cotizacion-unificada-payload";
import { resumenVentaCotizacion } from "@/lib/cotizacion-venta-resumen";

const navigation = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

type Row = Record<string, unknown> & { id: string };
const org = "00000000-0000-0000-0000-000000000001";
let tablas: Record<string, Row[]>;
let falloTabla: string | null;
let requests: URL[];
const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const venta = (n: number, fecha = "2026-09-01"): Row => ({
  id: uuid(n), organization_id: org, cliente_id: "cliente-antiguo", fecha,
  correlativo: `MA-${n}`, total: n,
});
function cotizacion(n: number, estado = "cobrada", rubros = { muebles: false, aserradero: true, alquiler: false }): Row {
  const detalle = defaultCotizacionDetalleV1();
  detalle.rubros = rubros;
  detalle.alquiler!.nombre_maquinaria = "Mixer";
  return { ...venta(n), estado_flujo: estado, correlativo: `C-${n}`, detalle };
}

// El SDK real recibe tablas locales y aplica el rango, el orden y los filtros
// enviados en la consulta. Ninguna prueba contacta una base de producción.
const fixtureFetch: typeof fetch = async input => {
  const url = new URL(String(input));
  requests.push(url);
  const tabla = url.pathname.split("/").at(-1) ?? "";
  if (tabla === falloTabla) return new Response(JSON.stringify({ message: "Fallo local" }), { status: 400 });
  let rows = [...(tablas[tabla] ?? [])];
  for (const [campo, filtro] of url.searchParams) {
    if (filtro.startsWith("eq.")) rows = rows.filter(row => String(row[campo]) === filtro.slice(3));
    if (filtro === "is.null") rows = rows.filter(row => row[campo] == null);
  }
  const ids = url.searchParams.get("id");
  if (ids?.startsWith("in.(")) {
    const seleccion = ids.slice(4, -1).split(",");
    rows = rows.filter(row => seleccion.includes(row.id));
  }
  const orden = url.searchParams.get("order")?.split(",") ?? [];
  rows.sort((a, b) => {
    for (const campo of orden) {
      const [nombre, direccion] = campo.split(".");
      const diff = String(a[nombre] ?? "").localeCompare(String(b[nombre] ?? ""));
      if (diff) return direccion === "desc" ? -diff : diff;
    }
    return 0;
  });
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 1000);
  rows = rows.slice(offset, offset + Math.min(limit, 1000));
  return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
};

describe("Historial de ventas: registros anteriores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.search = "";
    requests = [];
    falloTabla = null;
    tablas = { clientes: [{ id: "cliente-antiguo", organization_id: org, nombre: "Cliente antiguo" }] };
    mocks.hasSupabaseEnv.mockReturnValue(true);
    mocks.getSupabaseServerClient.mockImplementation(() => createClient("https://historial.test", "test-key", {
      global: { fetch: fixtureFetch }, auth: { persistSession: false, autoRefreshToken: false },
    }));
    mocks.demoVentasRows.mockImplementation(() => tablas.demo_ventas ?? []);
    mocks.demoCotizacionesUnificadasRows.mockImplementation(() => tablas.cotizaciones_unificadas ?? []);
    mocks.demoAlquilerRows.mockImplementation(() => tablas.alquileres ?? []);
    mocks.demoVentasMuebleTerminadoRows.mockImplementation(() => tablas.ventas_mueble_terminado ?? []);
    mocks.demoServiciosAserraderoRows.mockImplementation(() => tablas.servicios_aserradero ?? []);
    mocks.demoClientesRows.mockImplementation(() => tablas.clientes ?? []);
    mocks.demoMueblesCatalogoRows.mockImplementation(() => tablas.muebles_catalogo ?? []);
  });

  test("cargar más alcanza ventas y alquileres anteriores a los límites antiguos sin perder registros", async () => {
    tablas.ventas_madera = Array.from({ length: 75 }, (_, i) => venta(i + 1, "2026-10-03"));
    tablas.alquileres = Array.from({ length: 125 }, (_, i) => ({
      id: uuid(i + 500), organization_id: org, cliente_id: "cliente-antiguo", fecha_inicio: "2026-09-01",
      activo: "Mixer", codigo: `CT-${i + 1}`, monto_total: null,
    }));
    const primera = await getVentasHistorial(1, org);
    expect(primera.ventas).toHaveLength(50);
    expect(primera.hasMore).toBe(true);
    const completa = await getVentasHistorial(4, org);
    expect(completa.ventas).toHaveLength(200);
    expect(new Set(completa.ventas.map(v => v.detalleHref)).size).toBe(200);
    expect(completa.ventas.some(v => v.concepto.includes("CT-1)"))).toBe(true);
    expect(completa.ventas.some(v => v.concepto === "Madera: MA-1")).toBe(true);
    expect(completa.hasMore).toBe(false);
    expect(completa.failedCategories).toEqual([]);
    expect(completa.ventas.every(v => v.clienteNombre === "Cliente antiguo")).toBe(true);
    expect(completa.ventas.filter(v => v.categoria === "alquileres").every(v => v.total === null)).toBe(true);
  });

  test("mezcla todos los orígenes por fecha, mantiene empates estables y no confunde IDs iguales", async () => {
    tablas.ventas_madera = [venta(1)];
    tablas.ventas_madera_cortada = [venta(1, "2026-09-02")];
    tablas.ventas_mueble_terminado = [{ ...venta(2, "2026-09-03"), mueble_catalogo_id: "mueble-antiguo", cantidad: 2 }];
    tablas.muebles_catalogo = [{ id: "mueble-antiguo", organization_id: org, nombre: "Ropero antiguo" }];
    tablas.servicios_aserradero = [{ ...venta(3, "2026-09-04"), precio_cobrado: 450, pies_cubicos: 30 }];
    const resultado = await getVentasHistorial(1, org);
    expect(resultado.ventas.map(v => v.detalleHref.split("/").at(-2))).toEqual(["aserradero", "mueble", "madera", "venta-madera"]);
    expect(resultado.ventas[1].concepto).toBe("Mueble: Ropero antiguo (x2)");
    expect(resultado.ventas[0].total).toBe(450);
    expect(resultado.ventas[0].concepto).toContain("30.00 PT");
  });

  test("supera el máximo de respuesta de 1.000 filas con consultas pequeñas y no termina antes de tiempo", async () => {
    tablas.ventas_madera = Array.from({ length: 1201 }, (_, i) => venta(i + 1));
    const parcial = await getVentasHistorial(24, org);
    expect(parcial.ventas).toHaveLength(1200);
    expect(parcial.hasMore).toBe(true);
    const completo = await getVentasHistorial(25, org);
    expect(completo.ventas).toHaveLength(1201);
    expect(completo.hasMore).toBe(false);
    expect(completo.ventas.at(-1)?.concepto).toBe("Madera: MA-1");
    const consultasMadera = requests.filter(url => url.pathname.endsWith("/ventas_madera"));
    expect(consultasMadera.some(url => Number(url.searchParams.get("offset")) >= 1000)).toBe(true);
    expect(consultasMadera.every(url => Number(url.searchParams.get("limit")) <= 250)).toBe(true);
    expect(consultasMadera.every(url => url.searchParams.get("order") === "fecha.desc,id.desc")).toBe(true);
  });

  test("un fallo en una fuente no se convierte en un falso final del historial", async () => {
    tablas.ventas_madera = [venta(1)];
    falloTabla = "alquileres";
    const resultado = await getVentasHistorial(1, org);
    expect(resultado.failedCategories).toEqual(["alquileres"]);
    expect(resultado.ventas).toHaveLength(1);
    const html = renderToStaticMarkup(createElement(VentasListWithFilters, resultado));
    expect(html).toContain("No pudimos cargar los alquileres.");
    expect(html).toContain("No podemos confirmar el final del historial");
    expect(html).not.toContain("Llegaste al final del historial.");
  });

  test("muestra que una búsqueda sin coincidencias es parcial mientras quedan operaciones anteriores", async () => {
    tablas.ventas_madera = Array.from({ length: 51 }, (_, i) => venta(i + 1));
    const resultado = await getVentasHistorial(1, org);
    navigation.search = "buscar=Cliente+que+no+está";
    const html = renderToStaticMarkup(createElement(VentasListWithFilters, resultado));
    expect(html).toContain("No hay coincidencias en las operaciones cargadas.");
    expect(html).toContain("Ver más operaciones");
    expect(html).not.toContain("No hay resultados con estos filtros.");
  });

  test("filtra las operaciones y sus nombres por la organización de la sesión", async () => {
    tablas.ventas_madera = [venta(1), { ...venta(2), organization_id: "otra-organizacion" }];
    tablas.clientes.push({ id: "cliente-ajeno", organization_id: "otra-organizacion", nombre: "Dato ajeno" });
    const resultado = await getVentasHistorial(1, org);
    expect(resultado.ventas).toHaveLength(1);
    expect(resultado.ventas[0].clienteNombre).toBe("Cliente antiguo");
    expect(requests.every(url => url.searchParams.get("organization_id") === `eq.${org}`)).toBe(true);
  });

  test.each([true, false])("incluye solo cotizaciones cobradas de la empresa, una vez y sin depender de Caja (Supabase: %s)", async supabase => {
    mocks.hasSupabaseEnv.mockReturnValue(supabase);
    tablas.cotizaciones_unificadas = [
      cotizacion(1), cotizacion(2, "pendiente"), cotizacion(3, "lista_produccion"),
      cotizacion(4, "en_produccion"), cotizacion(5, "terminado"), cotizacion(6, "entregado"),
      cotizacion(7, "inactivo"), cotizacion(8, "deudor"), { ...cotizacion(9), organization_id: "otra" },
    ];
    tablas.movimientos_caja = Array.from({ length: 2 }, (_, i) => ({ ...venta(i + 50), referencia_id: uuid(1), monto: 1 }));
    const resultado = await getVentasHistorial(1, org);
    expect(resultado.ventas).toEqual([expect.objectContaining({
      id: uuid(1), clienteNombre: "Cliente antiguo", total: 1, categoria: "aserradero",
      concepto: "Cotización cobrada C-1 · Servicio de aserradero", detalleHref: `/ventas/detalle/cotizacion/${uuid(1)}`,
    })]);
    expect(resultado.cotizacionesLoadFailed).toBe(false);
    expect(requests.some(url => url.pathname.endsWith("/movimientos_caja"))).toBe(false);
    if (supabase) expect(requests.find(url => url.pathname.endsWith("/cotizaciones_unificadas"))?.searchParams.get("estado_flujo")).toBe("eq.cobrada");
  });

  test("clasifica el servicio y conserva el total único de una propuesta con varios rubros", async () => {
    tablas.cotizaciones_unificadas = [
      cotizacion(1, "cobrada", { muebles: true, aserradero: false, alquiler: false }),
      cotizacion(2), cotizacion(3, "cobrada", { muebles: false, aserradero: false, alquiler: true }),
      cotizacion(4, "cobrada", { muebles: true, aserradero: true, alquiler: true }),
    ];
    tablas.ventas_madera = [venta(4)];
    const resultado = await getVentasHistorial(1, org);
    const cotizaciones = resultado.ventas.filter(v => v.detalleHref.includes("/cotizacion/"));
    expect(cotizaciones).toHaveLength(4);
    expect(Object.fromEntries(cotizaciones.map(v => [v.id, v.categoria]))).toEqual({
      [uuid(1)]: "muebles", [uuid(2)]: "aserradero", [uuid(3)]: "alquileres", [uuid(4)]: "otros",
    });
    expect(cotizaciones.find(v => v.id === uuid(4))?.total).toBe(4);
    expect(new Set(resultado.ventas.map(v => v.detalleHref)).size).toBe(5);
    navigation.search = "categoria=alquileres&buscar=Mixer";
    const html = renderToStaticMarkup(createElement(VentasListWithFilters, resultado));
    expect(html).toContain("1 operación encontrada");
    expect(html).toContain("Cotización cobrada C-3");
    expect(html).not.toContain("Cotización cobrada C-4");
  });

  test("filtra cobradas antes del rango y alcanza propuestas antiguas sin el límite de 100 o 1.000", async () => {
    tablas.cotizaciones_unificadas = [
      ...Array.from({ length: 60 }, (_, i) => ({ ...cotizacion(i + 2000, "pendiente"), fecha: "2026-10-04" })),
      ...Array.from({ length: 1001 }, (_, i) => cotizacion(i + 1)),
    ];
    const primera = await getVentasHistorial(1, org);
    expect(primera.ventas).toHaveLength(50);
    expect(primera.hasMore).toBe(true);
    const parcial = await getVentasHistorial(20, org);
    expect(parcial.ventas).toHaveLength(1000);
    expect(parcial.hasMore).toBe(true);
    const completa = await getVentasHistorial(21, org);
    expect(completa.ventas).toHaveLength(1001);
    expect(completa.hasMore).toBe(false);
    expect(completa.ventas.at(-1)?.id).toBe(uuid(1));
    const consultas = requests.filter(url => url.pathname.endsWith("/cotizaciones_unificadas"));
    expect(consultas.some(url => Number(url.searchParams.get("offset")) === 1000)).toBe(true);
    expect(consultas.every(url => url.searchParams.get("estado_flujo") === "eq.cobrada")).toBe(true);
    expect(consultas.every(url => Number(url.searchParams.get("limit")) <= 250)).toBe(true);
  });

  test("un fallo de cotizaciones conserva los otros servicios y avisa que sus resultados son parciales", async () => {
    tablas.servicios_aserradero = [{ ...venta(1), precio_cobrado: 120, pies_cubicos: 4 }];
    falloTabla = "cotizaciones_unificadas";
    const resultado = await getVentasHistorial(1, org);
    expect(resultado.failedCategories).toEqual([]);
    expect(resultado.cotizacionesLoadFailed).toBe(true);
    expect(resultado.ventas).toHaveLength(1);
    navigation.search = "categoria=aserradero";
    const html = renderToStaticMarkup(createElement(VentasListWithFilters, resultado));
    expect(html).toContain("Servicio Aserradero");
    expect(html).toContain("1 operación encontrada en los datos disponibles");
    expect(html).toContain("No pudimos cargar las cotizaciones cobradas.");
    expect(html).not.toContain("Llegaste al final del historial.");
    navigation.search = "categoria=muebles";
    const vacio = renderToStaticMarkup(createElement(VentasListWithFilters, resultado));
    expect(vacio).toContain("No pudimos cargar las cotizaciones cobradas.");
    expect(vacio).not.toContain("No hay resultados con estos filtros.");
    navigation.search = "categoria=madera";
    expect(renderToStaticMarkup(createElement(VentasListWithFilters, resultado))).not.toContain("No pudimos cargar las cotizaciones cobradas.");
  });

  test("el resumen usa la descripción comercial y conserva un texto manual vacío o un histórico ilegible", () => {
    const detalle = defaultCotizacionDetalleV1();
    detalle.rubros.aserradero = true;
    detalle.aserradero!.descripcion = "Corte para obra";
    detalle.descripcion_cliente = "Texto antiguo";
    detalle.descripcion_modo = "automatica";
    expect(resumenVentaCotizacion(detalle).descripcion).toContain("Corte para obra");
    expect(resumenVentaCotizacion(detalle).descripcion).not.toContain("Texto antiguo");
    detalle.descripcion_modo = "manual";
    detalle.descripcion_cliente = "";
    expect(resumenVentaCotizacion(detalle).descripcion).toBeNull();
    expect(resumenVentaCotizacion(null)).toMatchObject({ categoria: "otros", rubro: "Cotización guiada", descripcion: null });
  });

  test.each([true, false])("excluye operaciones eliminadas antes de paginar sin perder las activas (Supabase: %s)", async supabase => {
    mocks.hasSupabaseEnv.mockReturnValue(supabase);
    tablas.cotizaciones_unificadas = [
      ...Array.from({ length: 60 }, (_, i) => ({ ...cotizacion(i + 100), fecha: "2026-10-04", deleted_at: "2026-10-04T10:00:00Z" })),
      cotizacion(1),
    ];
    tablas.ventas_madera = [venta(2), { ...venta(3), deleted_at: "2026-10-04T10:00:00Z" }];
    tablas.demo_ventas = tablas.ventas_madera;
    tablas.alquileres = [{ ...venta(4), fecha_inicio: "2026-10-04", monto_total: 900, deleted_at: "2026-10-04T10:00:00Z" }];
    tablas.ventas_mueble_terminado = [{ ...venta(5), deleted_at: "2026-10-04T10:00:00Z" }];
    tablas.ventas_madera_cortada = [{ ...venta(6), deleted_at: "2026-10-04T10:00:00Z" }];
    tablas.servicios_aserradero = [{ ...venta(7), precio_cobrado: 700 }];
    const resultado = await getVentasHistorial(1, org);
    expect(resultado.ventas.map(v => v.id)).toEqual([uuid(7), uuid(2), uuid(1)]);
    expect(resultado.hasMore).toBe(false);
    expect(resultado.failedCategories).toEqual([]);
    if (supabase) {
      expect(requests.filter(url => !url.pathname.endsWith("/clientes") && !url.pathname.endsWith("/servicios_aserradero"))
        .every(url => url.searchParams.get("deleted_at") === "is.null")).toBe(true);
      expect(requests.find(url => url.pathname.endsWith("/servicios_aserradero"))?.searchParams.has("deleted_at")).toBe(false);
    }
  });
});
