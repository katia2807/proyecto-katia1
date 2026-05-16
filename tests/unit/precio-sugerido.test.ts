import { calcularSugerenciaPrecio, formatearSugerencia } from "@/lib/precio-sugerido";

const historialBase = [
  { producto_id: "p1", precio_cobrado: 100, fecha: "2026-05-01" },
  { producto_id: "p1", precio_cobrado: 110, fecha: "2026-04-15" },
  { producto_id: "p1", precio_cobrado: 120, fecha: "2026-03-10" },
  { producto_id: "p2", precio_cobrado: 50, fecha: "2026-05-01" },
  { producto_id: "p2", precio_cobrado: 55, fecha: "2026-04-01" },
];

describe("calcularSugerenciaPrecio", () => {
  test("retorna mostrar=false si hay menos de 3 ventas", () => {
    const result = calcularSugerenciaPrecio("p2", historialBase);
    expect(result.mostrar).toBe(false);
    expect(result.cantidadVentas).toBe(2);
  });

  test("retorna mostrar=true con promedio correcto si hay 3 o más ventas", () => {
    const result = calcularSugerenciaPrecio("p1", historialBase);
    expect(result.mostrar).toBe(true);
    expect(result.cantidadVentas).toBe(3);
    // Promedio de 100, 110, 120 ordenado por fecha desc = (100 + 110 + 120) / 3 = 110
    expect(result.promedio).toBe(110);
    expect(result.ultimoPrecio).toBe(100);
  });

  test("retorna mostrar=false para producto sin ventas", () => {
    const result = calcularSugerenciaPrecio("no-existe", historialBase);
    expect(result.mostrar).toBe(false);
    expect(result.cantidadVentas).toBe(0);
  });

  test("usa máximo 5 ventas para el promedio", () => {
    const historial = [
      { producto_id: "p3", precio_cobrado: 10, fecha: "2026-05-10" },
      { producto_id: "p3", precio_cobrado: 20, fecha: "2026-05-09" },
      { producto_id: "p3", precio_cobrado: 30, fecha: "2026-05-08" },
      { producto_id: "p3", precio_cobrado: 40, fecha: "2026-05-07" },
      { producto_id: "p3", precio_cobrado: 50, fecha: "2026-05-06" },
      { producto_id: "p3", precio_cobrado: 1000, fecha: "2026-04-01" }, // Esta no entra en promedio
    ];
    const result = calcularSugerenciaPrecio("p3", historial);
    expect(result.mostrar).toBe(true);
    // Promedio de las últimas 5: (10+20+30+40+50)/5 = 30
    expect(result.promedio).toBe(30);
    expect(result.cantidadVentas).toBe(6);
  });
});

describe("formatearSugerencia", () => {
  test("retorna string vacío si mostrar=false", () => {
    const result = formatearSugerencia({ promedio: 0, ultimoPrecio: 0, cantidadVentas: 0, mostrar: false });
    expect(result).toBe("");
  });

  test("retorna string formateado si mostrar=true", () => {
    const sugerencia = { promedio: 110, ultimoPrecio: 100, cantidadVentas: 3, mostrar: true };
    const result = formatearSugerencia(sugerencia);
    expect(result).toContain("S/110.00");
    expect(result).toContain("S/100.00");
    expect(result).toContain("Sugerencia");
  });
});
