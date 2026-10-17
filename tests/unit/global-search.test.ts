import { describe, expect, test } from "vitest";
import { navItems } from "@/lib/constants";
import { buildNavHrefAllowlist, canAccessPath } from "@/lib/permissions";
import { buildGlobalSearchSections, getGlobalSearchContinuations, getGlobalSearchResults, nextGlobalSearchIndex, normalizeGlobalSearch, type GlobalSearchItem } from "@/lib/global-search";

const allowed = buildNavHrefAllowlist("owner_admin", "owner_admin");
const sections = buildGlobalSearchSections(allowed);
const customer: GlobalSearchItem = { label: "José Pérez", detail: "12345678 · 20123456789 · +51 999 888 777", href: "/ventas/clientes/cliente-a", type: "Cliente" };
const product: GlobalSearchItem = { label: "Tornillo para madera", detail: "MAD-001 · Ferretería", href: "/inventario?tab=productos&buscar=Tornillo", type: "Producto" };
const quote: GlobalSearchItem = { label: "COT-026", detail: "José Pérez · 2026-10-16 · registrada", href: "/cotizacion?cotizacion=ejemplo", type: "Cotizacion" };

describe("Búsqueda útil con el índice existente", () => {
  test("normaliza tildes, mayúsculas, espacios y signos", () => {
    expect(normalizeGlobalSearch("  CÓTIZACIÓN  /  José-PÉREZ ")).toBe("cotizacion jose perez");
  });
  test.each(["jose", "perez jose", "JOSÉ PÉREZ", "12345678", "20123456789", "999888777"])("encuentra un cliente por %s", query => {
    expect(getGlobalSearchResults([customer], [], query)).toEqual([customer]);
  });
  test("no inventa un documento juntando dos campos", () => {
    expect(getGlobalSearchResults([{ ...customer, label: "Cliente", detail: "1234 · 5678" }], [], "12345678")).toEqual([]);
  });
  test.each(["tornillo madera", "MAD001", "ferreteria"])("encuentra producto o código con %s", query => {
    expect(getGlobalSearchResults([product], [], query)).toEqual([product]);
  });
  test("encuentra una cotización por cliente y por correlativo", () => {
    expect(getGlobalSearchResults([quote], [], "jose")).toEqual([quote]);
    expect(getGlobalSearchResults([quote], [], "COT026")).toEqual([quote]);
  });
  test("muchos clientes no ocultan productos y cotizaciones", () => {
    const many = Array.from({ length: 300 }, (_, i): GlobalSearchItem => ({ ...customer, href: "/ventas/clientes/" + i, label: "Madera " + i }));
    const result = getGlobalSearchResults([...many, product, { ...quote, detail: "Madera" }], [], "madera");
    expect(result.filter(item => item.type === "Cliente")).toHaveLength(4);
    expect(result.some(item => item.type === "Producto")).toBe(true);
    expect(result.some(item => item.type === "Cotizacion")).toBe(true);
  });
  test("prioriza el nombre exacto dentro de su grupo", () => {
    const names = ["María Ana", "Anabel", "Ana"].map((label, i) => ({ ...customer, label, href: "/ventas/clientes/" + i }));
    expect(getGlobalSearchResults(names, [], "ana").map(item => item.label)).toEqual(["Ana", "Anabel", "María Ana"]);
  });
  test.each([["dinero", "/caja"], ["cotizar", "/cotizacion"], ["boleta", "/ventas"], ["backup", "/admin/respaldo"], ["cobrar", "/gerencial"], ["kardex", "/inventario"]])("%s abre el apartado existente %s", (query, href) => {
    expect(getGlobalSearchResults([], sections, query).some(item => item.href === href)).toBe(true);
  });
  test("sin consulta no expone una lista de registros", () => {
    const results = getGlobalSearchResults([customer, product, quote], sections, "");
    expect(results.length).toBeLessThanOrEqual(8);
    expect(results.every(item => item.type === "Apartado")).toBe(true);
  });
  test("si no coincide nada no declara que no existan registros en todo el historial", () => {
    expect(getGlobalSearchResults([customer], sections, "zzzz-no-coincide")).toEqual([]);
    expect(getGlobalSearchContinuations("zzzz-no-coincide", allowed).map(link => link.path)).toEqual(["/ventas/clientes", "/inventario", "/cotizacion"]);
  });
});

describe("Rutas permitidas y búsquedas completas", () => {
  test("Caja solo ofrece sus apartados", () => {
    const caja = buildGlobalSearchSections(buildNavHrefAllowlist("caja", null));
    expect(caja.map(item => item.href)).toEqual(["/", "/caja"]);
    expect(getGlobalSearchResults([], caja, "usuarios")).toEqual([]);
  });
  test("no sugiere módulos desactivados aunque la entrada contenga su ruta", () => {
    const result = buildGlobalSearchSections(new Set(navItems.map(item => item.href)));
    expect(result.map(item => item.href)).not.toEqual(expect.arrayContaining(["/seguridad", "/reportes/antifraude", "/admin/importar"]));
    for (const href of ["/seguridad", "/reportes/antifraude", "/admin/importar"]) expect(result.some(item => item.href === href)).toBe(false);
  });
  test.each(["owner_admin", "vendedor", "almacen", "caja"] as const)("las búsquedas completas respetan el acceso de %s", role => {
    for (const link of getGlobalSearchContinuations("madera", buildNavHrefAllowlist(role, null))) expect(canAccessPath(role, null, link.path)).toBe(true);
  });
  test("codifica la consulta sin añadir filtros ajenos", () => {
    const query = "José &estado=inactivo#fin";
    const links = getGlobalSearchContinuations(query, allowed);
    const client = new URL(links.find(link => link.path === "/ventas/clientes")!.href, "https://local.invalid");
    const inventory = new URL(links.find(link => link.path === "/inventario")!.href, "https://local.invalid");
    expect(client.searchParams.get("q")).toBe(query);
    expect(client.searchParams.has("estado")).toBe(false);
    expect(client.hash).toBe("");
    expect(inventory.searchParams.get("buscar")).toBe(query);
  });
  test("Inicio solo no habilita enlaces al resto del programa", () => {
    expect(getGlobalSearchContinuations("madera", new Set(["/"]))).toEqual([]);
  });
});

describe("Selección de resultados con flechas", () => {
  test("sin resultados no hay selección que abrir", () => expect(nextGlobalSearchIndex(0, 0, 1)).toBe(-1));
  test("recorre y vuelve al principio o al final", () => {
    expect(nextGlobalSearchIndex(0, 3, 1)).toBe(1);
    expect(nextGlobalSearchIndex(2, 3, 1)).toBe(0);
    expect(nextGlobalSearchIndex(0, 3, -1)).toBe(2);
  });
});
