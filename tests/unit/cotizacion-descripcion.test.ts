import { describe, expect, test } from "vitest";
import {
  buildDescripcionComercialSugerida,
  buildLineasResumen,
  getDescripcionPersonalizada,
} from "@/lib/cotizacion-unificada-lineas";
import {
  defaultCotizacionDetalleV1,
  parseCotizacionDetalle,
} from "@/lib/cotizacion-unificada-payload";

function servicio() {
  const detalle = defaultCotizacionDetalleV1();
  detalle.rubros.aserradero = true;
  detalle.aserradero = {
    modo: "total", precioHora: 0, horas: 0,
    montoTotalFijo: 300, descripcion: "Corte para puertas",
  };
  return detalle;
}

describe("descripción comercial de la cotización", () => {
  test("cambiar de rubro genera el texto del servicio actual", () => {
    const detalle = servicio();
    detalle.descripcion_cliente = "MUEBLE PERSONALIZADO\nPieza";
    detalle.descripcion_modo = "automatica";
    expect(buildDescripcionComercialSugerida(detalle)).toBe(
      "SERVICIO ASERRADERO / MANO DE OBRA\nCorte para puertas\nServicio a precio cerrado",
    );
    detalle.rubros = { muebles: false, aserradero: false, alquiler: true };
    detalle.alquiler!.nombre_maquinaria = "Mixer";
    expect(buildDescripcionComercialSugerida(detalle)).toContain("ALQUILER — MIXER");
    expect(buildDescripcionComercialSugerida(detalle)).not.toContain("ASERRADERO");
  });

  test("el modo automático sobrevive al guardado y no vuelve a convertirse en manual", () => {
    const detalle = servicio();
    detalle.descripcion_cliente = buildDescripcionComercialSugerida(detalle);
    detalle.descripcion_modo = "automatica";
    const recuperada = parseCotizacionDetalle(JSON.parse(JSON.stringify(detalle)));
    expect(recuperada.descripcion_modo).toBe("automatica");
    expect(getDescripcionPersonalizada(recuperada)).toBeNull();
    recuperada.aserradero!.descripcion = "Corte de ventanas";
    expect(buildDescripcionComercialSugerida(recuperada)).toContain("Corte de ventanas");
  });

  test.each(["Incluye entrega el viernes", ""])(
    "conserva una descripción manual, incluso vacía: %s", (texto) => {
      const detalle = servicio();
      detalle.descripcion_cliente = texto;
      detalle.descripcion_modo = "manual";
      const recuperada = parseCotizacionDetalle(JSON.parse(JSON.stringify(detalle)));
      recuperada.aserradero!.montoTotalFijo = 900;
      expect(getDescripcionPersonalizada(recuperada)).toBe(texto);
      expect(buildLineasResumen(recuperada, 30)[0].bullets).toEqual(texto ? [texto] : []);
      expect(buildLineasResumen(recuperada, 30)[0].precioTotal).toBe(1170);
    },
  );

  test("los textos anteriores sin modo se conservan como personalizados", () => {
    const detalle = servicio();
    detalle.descripcion_cliente = "Condición histórica acordada";
    expect(getDescripcionPersonalizada(parseCotizacionDetalle(detalle))).toBe(
      "Condición histórica acordada",
    );
  });

  test("restablecer genera una sugerencia independiente del texto personalizado", () => {
    const detalle = servicio();
    detalle.descripcion_cliente = "TEXTO QUE NO DEBE CONTAMINAR LA SUGERENCIA";
    detalle.descripcion_modo = "manual";
    expect(buildDescripcionComercialSugerida(detalle)).not.toContain("CONTAMINAR");
    expect(buildDescripcionComercialSugerida(detalle)).toContain("Corte para puertas");
  });

  test("el documento de alquiler muestra la descripción editada sin cambiar sus importes", () => {
    const detalle = servicio();
    detalle.rubros = { muebles: false, aserradero: false, alquiler: true };
    detalle.alquiler!.nombre_maquinaria = "Mixer";
    detalle.alquiler!.tarifa = 150;
    detalle.alquiler!.unidades_tiempo = 2;
    detalle.descripcion_cliente = "Incluye operador";
    detalle.descripcion_modo = "manual";
    expect(buildLineasResumen(detalle, 30)[0]).toMatchObject({
      bullets: ["Incluye operador"], precioTotal: 390,
    });
  });

  test("en una cotización combinada el texto personalizado aparece una sola vez", () => {
    const detalle = servicio();
    detalle.rubros.alquiler = true;
    detalle.descripcion_cliente = "Condiciones comunes";
    detalle.descripcion_modo = "manual";
    expect(buildLineasResumen(detalle).flatMap((linea) => linea.bullets)
      .filter((bullet) => bullet === "Condiciones comunes")).toHaveLength(1);
  });

  test("el documento no presenta el costo base como si fuera el precio acordado", () => {
    const detalle = servicio();
    const linea = buildLineasResumen(detalle, 30)[0];
    expect(linea.precioTotal).toBe(390);
    expect(linea.bullets.join(" ")).not.toContain("300.00");
    detalle.aserradero!.modo = "hora";
    detalle.aserradero!.precioHora = 100;
    detalle.aserradero!.horas = 3;
    expect(buildDescripcionComercialSugerida(detalle)).toContain("3 h");
    detalle.aserradero!.horas = 4;
    expect(buildDescripcionComercialSugerida(detalle)).toContain("4 h");
  });
});
