import {
  calcularPrecioConMargen,
  computeTotalesDetalle,
  round2,
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

function reconciliarLineasConTotal(lineas: LineaFormal[], totalFinal: number | undefined): LineaFormal[] {
  if (totalFinal === undefined || !Number.isFinite(totalFinal) || totalFinal < 0 || lineas.length === 0) {
    return lineas;
  }
  const totalObjetivo = round2(totalFinal);
  const sumaLineas = round2(lineas.reduce((acumulado, linea) => acumulado + linea.precioTotal, 0));
  const ajuste = round2(totalObjetivo - sumaLineas);
  if (ajuste === 0) return lineas;

  const ultimoIndice = lineas.length - 1;
  const ultimaLinea = lineas[ultimoIndice];
  const precioTotalAjustado = round2(ultimaLinea.precioTotal + ajuste);
  if (precioTotalAjustado < 0) return lineas;

  return lineas.map((linea, indice) =>
    indice === ultimoIndice
      ? {
          ...linea,
          precioUnit: round2(precioTotalAjustado / Math.max(1, linea.cantidad)),
          precioTotal: precioTotalAjustado,
        }
      : linea,
  );
}

/** Arma las filas tipo documento comercial (ítem, cant., descripción con viñetas, unitario, total). */
export function buildLineasResumen(
  detalle: CotizacionDetalleV1,
  margenGananciaPct = 0,
  totalFinal?: number,
): LineaFormal[] {
  const lineas: LineaFormal[] = [];

  if (detalle.rubros.muebles && detalle.muebles_lineas.length > 0) {
    // Calcular total de todas las líneas de madera juntas para mostrar un solo ítem
    let totalMonto = 0;
    let totalCantidad = 0;

    for (const linea of detalle.muebles_lineas) {
      const ptNet = linea.piezas.reduce((acc, p) => {
        // PT = (espesor_in × ancho_in × largo_ft) / 12
        return acc + (p.cantidad * p.espesor * p.ancho * p.largo) / 12;
      }, 0);
      const montoLinea = round2(ptNet * Math.max(0, linea.precioPorPt));
      const cantLinea = Math.max(1, linea.piezas.reduce((acc, p) => acc + p.cantidad, 0));
      totalMonto += montoLinea;
      totalCantidad += cantLinea;
    }

    totalCantidad = Math.max(1, totalCantidad);

    // Descripción visible al cliente: usa el campo editable si existe (incluso si está vacío), sino genera texto limpio
    const hasManualDesc = detalle.descripcion_cliente !== undefined && detalle.descripcion_cliente !== null;
    const bullets: string[] = [];
    if (hasManualDesc) {
      const descCliente = (detalle.descripcion_cliente ?? "").trim();
      if (descCliente) {
        // Katia escribió una descripción personalizada → mostrarla tal cual
        bullets.push(descCliente);
      }
    } else {
      // Generación automática: solo nombres de piezas, sin datos técnicos internos
      const piezasLabels: string[] = [];
      for (const linea of detalle.muebles_lineas) {
        for (const p of linea.piezas) {
          const label = (p.descripcion || linea.especie_label || "Pieza").trim();
          if (label && !piezasLabels.includes(label)) {
            piezasLabels.push(label);
          }
        }
      }
      if (piezasLabels.length > 0) {
        bullets.push(piezasLabels.join(", "));
      }
    }

    // Título: especie de la primera línea, o "MUEBLE PERSONALIZADO"
    const primeraEspecie = detalle.muebles_lineas[0]?.especie_label?.trim().toUpperCase();
    const titulo = primeraEspecie || "MUEBLE PERSONALIZADO";

    const totalMontoConMargen = calcularPrecioConMargen(totalMonto, margenGananciaPct);
    lineas.push({
      cantidad: totalCantidad,
      titulo,
      bullets,
      precioUnit: round2(totalMontoConMargen / totalCantidad),
      precioTotal: round2(totalMontoConMargen),
    });

    if (detalle.costoAcabadoSoles > 0) {
      const precioAcabadoConMargen = calcularPrecioConMargen(detalle.costoAcabadoSoles, margenGananciaPct);
      lineas.push({
        cantidad: 1,
        titulo: "ACABADO Y TERMINACIÓN",
        bullets: ["Costo de laca, barniz o pintura aplicada."],
        precioUnit: precioAcabadoConMargen,
        precioTotal: precioAcabadoConMargen,
      });
    }

    if (detalle.costoManoObra > 0) {
      const precioManoObraConMargen = calcularPrecioConMargen(detalle.costoManoObra, margenGananciaPct);
      lineas.push({
        cantidad: 1,
        titulo: "MANO DE OBRA",
        bullets: ["Costo de fabricación, armado o mano de obra."],
        precioUnit: precioManoObraConMargen,
        precioTotal: precioManoObraConMargen,
      });
    }
  }

  const totRubros = computeTotalesDetalle(detalle);

  if (detalle.rubros.aserradero && detalle.aserradero) {
    const a = detalle.aserradero;
    const tot = calcularPrecioConMargen(totRubros.aserradero, margenGananciaPct);
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
    const base = calcularPrecioConMargen(totRubros.alquiler_base, margenGananciaPct);
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
        precioUnit: calcularPrecioConMargen(totRubros.garantia, margenGananciaPct),
        precioTotal: calcularPrecioConMargen(totRubros.garantia, margenGananciaPct),
      });
    }
  }

  return reconciliarLineasConTotal(lineas, totalFinal);
}
