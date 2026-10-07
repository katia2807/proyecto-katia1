import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: () => false }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));
vi.mock("@/components/gerencial/cash-flow-chart", () => ({ CashFlowChart: () => React.createElement("div", null, "Gráfico verificado aparte") }));
import { DecisionPanel } from "@/components/gerencial/decision-panel";
import { buildGerencialModel } from "@/lib/gerencial-model";
import { GERENCIAL_TABLES, type GerencialSources } from "@/lib/gerencial-data";
const sources = () => Object.fromEntries(GERENCIAL_TABLES.map(t => [t, []])) as unknown as GerencialSources;
test("una fuente fallida muestra aviso y no declara que todo esté resuelto", () => {
  const s = sources(); s.movimientos_caja = null;
  const html = renderToStaticMarkup(React.createElement(DecisionPanel, { model: buildGerencialModel(s), tab: "hoy" }));
  expect(html).toContain('role="alert"'); expect(html).toContain("Información incompleta"); expect(html).toContain("No disponible"); expect(html).toContain("Falta información para completar la revisión");
  expect(html).not.toContain("Todo bajo control"); expect(html).not.toContain("ya revisadas");
});
test("un historial comprobado vacío se distingue del fallo de consulta", () => {
  const html = renderToStaticMarkup(React.createElement(DecisionPanel, { model: buildGerencialModel(sources()), tab: "hoy" }));
  expect(html).not.toContain('role="alert"'); expect(html).toContain("No se identificaron pendientes con los criterios de este panel");
});
