import {
  calcularPieTablar,
  computeTotalesDetalle,
  round2,
  totalPtLinea,
} from "@/lib/cotizacion-calculos";
import type { CotizacionDetalleV1 } from "@/lib/cotizacion-unificada-payload";
import { formatPen } from "@/lib/utils";

export type LineaFormal = {
  cantidad: number;
  titulo: string;
  bullets: string[];
  precioUnit: number;
  precioTotal: number;
};

/** Arma las filas tipo documento comercial (ítem, cant., descripción con viñetas, unitario, total). */
export function buildLineasResumen(detalle: CotizacionDetalleV1): LineaFormal[] {
  const lineas: LineaFormal[] = [];
  const des = Math.max(0, detalle.desperdicioPctMuebles);

  if (detalle.rubros.muebles && detalle.muebles_lineas.length > 0) {
    for (const linea of detalle.muebles_lineas) {
      const ptNet = totalPtLinea(linea.piezas);
      const ptCompra = ptNet * (1 + des / 100);
      const montoLinea = round2(ptCompra * Math.max(0, linea.precioPorPt));
      const cantidad = Math.max(1, linea.piezas.reduce((acc, p) => acc + p.cantidad, 0));

      const bullets: string[] = [
        `PT neto ${ptNet.toFixed(2)} · PT compra (${des}% desp.) ${ptCompra.toFixed(2)} · S/ por PT ${formatPen(linea.precioPorPt)}`,
      ];
      for (const p of linea.piezas) {
        const pt = calcularPieTablar(p.cantidad, p.espesor, p.ancho, p.largo);
        bullets.push(
          `${p.descripcion}: ${p.cantidad} × ${p.espesor}″ × ${p.ancho}″ × ${p.largo}′ → ${pt.toFixed(2)} PT`,
        );
      }

      const titulo = (linea.especie_label || "Madera").trim().toUpperCase();
      lineas.push({
        cantidad,
        titulo,
        bullets,
        precioUnit: round2(montoLinea / cantidad),
        precioTotal: montoLinea,
      });
    }
  }

  const totRubros = computeTotalesDetalle(detalle);

  if (detalle.rubros.aserradero && detalle.aserradero) {
    const a = detalle.aserradero;
    const tot = totRubros.aserradero;
    const bullets: string[] = [];
    const desc = (a.descripcion ?? "").trim();
    if (desc) {
      bullets.push(desc);
    }
    if (a.modo === "hora") {
      bullets.push(`S/ ${a.precioHora.toFixed(2)} × ${a.horas} h`);
    } else {
      bullets.push(`Monto acordado: ${formatPen(a.montoTotalFijo)}`);
    }
    lineas.push({
      cantidad: 1,
      titulo: "SERVICIO ASERRADERO / MANO DE OBRA",
      bullets,
      precioUnit: tot,
      precioTotal: tot,
    });
  }

  if (detalle.rubros.alquiler && detalle.alquiler) {
    const al = detalle.alquiler;
    const base = totRubros.alquiler_base;
    const cant = Math.max(1, al.unidades_tiempo || 1);
    const nombre = (al.nombre_maquinaria || "Maquinaria").trim().toUpperCase();
    const bullets: string[] = [
      `Cobro por ${al.tarifaUnidad === "hora" ? "hora" : "día"}: ${formatPen(al.tarifa)} × ${al.unidades_tiempo} ${al.tarifaUnidad === "hora" ? "h" : "día(s)"}`,
    ];
    const notasAlq = (al.notas ?? "").trim();
    if (notasAlq) {
      bullets.push(notasAlq);
    }
    lineas.push({
      cantidad: cant,
      titulo: `ALQUILER — ${nombre}`,
      bullets,
      precioUnit: round2(base / cant),
      precioTotal: base,
    });
    if (al.incluye_garantia_danios && totRubros.garantia > 0) {
      lineas.push({
        cantidad: 1,
        titulo: "GARANTÍA / POSIBLES DAÑOS",
        bullets: ["Monto referencial asociado al uso del equipo."],
        precioUnit: totRubros.garantia,
        precioTotal: totRubros.garantia,
      });
    }
  }

  return lineas;
}
