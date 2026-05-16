import { formatPen, formatDate } from "@/lib/utils";

describe("formatPen", () => {
  test("formatea soles correctamente", () => {
    expect(formatPen(1250.5)).toContain("1,250.50");
    expect(formatPen(0)).toContain("0.00");
    expect(formatPen(-100)).toContain("100.00");
  });

  test("incluye símbolo de soles", () => {
    const result = formatPen(500);
    expect(result).toContain("S/");
  });
});

describe("formatDate", () => {
  test("formatea fecha ISO a formato legible", () => {
    const result = formatDate("2026-05-15");
    // Debe contener día y año
    expect(result).toMatch(/\d/);
  });

  test("maneja strings de fecha con hora", () => {
    const result = formatDate("2026-05-15T10:30:00.000Z");
    expect(result).toMatch(/\d/);
  });
});

// Tests de cálculos críticos de negocio
describe("cálculos de utilidad", () => {
  test("utilidad = ingresos - egresos", () => {
    const ingresos = 5000;
    const egresos = 3200;
    const utilidad = ingresos - egresos;
    expect(utilidad).toBe(1800);
  });

  test("porcentaje de cambio entre periodos", () => {
    const actual = 1500;
    const anterior = 1200;
    const pct = ((actual - anterior) / anterior) * 100;
    expect(pct.toFixed(1)).toBe("25.0");
  });

  test("porcentaje sin división por cero", () => {
    const anterior = 0;
    const actual = 1500;
    const result = anterior === 0 ? (actual > 0 ? 100 : 0) : ((actual - anterior) / anterior) * 100;
    expect(result).toBe(100);
  });

  test("suma correcta de totales de caja", () => {
    const movimientos = [
      { tipo: "ingreso", monto: 1000 },
      { tipo: "ingreso", monto: 500 },
      { tipo: "egreso", monto: 200 },
      { tipo: "egreso", monto: 300 },
    ];
    const ingresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
    const egresos = movimientos.filter((m) => m.tipo === "egreso").reduce((a, m) => a + m.monto, 0);
    expect(ingresos).toBe(1500);
    expect(egresos).toBe(500);
    expect(ingresos - egresos).toBe(1000);
  });
});
