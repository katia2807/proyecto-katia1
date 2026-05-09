/**
 * Plantillas de notas frecuentes que Katia añade en cotizaciones, contratos
 * y órdenes de producción. Cada plantilla tiene un texto base y, opcionalmente,
 * un placeholder editable (`{zona}` por ejemplo) que el usuario completa al
 * marcar la opción.
 */

export type PlantillaNota = {
  id: string;
  titulo: string;
  texto: string;
  /** Si la plantilla incluye un campo dinámico, define su nombre y prompt. */
  campo?: { nombre: string; placeholder: string; defaultValue?: string };
};

export const plantillasNotas: PlantillaNota[] = [
  {
    id: "acabado_barniz",
    titulo: "Acabado tipo barniz",
    texto: "El acabado de las puertas y muebles es de tipo barniz tipo cera natural.",
  },
  {
    id: "incluye_instalacion",
    titulo: "Incluye instalación y transporte",
    texto: "El precio incluye instalación y transporte hasta {zona}.",
    campo: { nombre: "zona", placeholder: "Zona de entrega", defaultValue: "Lima centro" },
  },
  {
    id: "no_incluye_accesorios",
    titulo: "No incluye accesorios",
    texto: "El precio no incluye accesorios como bisagras, chapas, vidrio, jaladores ni similares.",
  },
  {
    id: "pago_30_adelanto",
    titulo: "Adelanto del 30%",
    texto: "Se requiere depósito del 30% del monto total para iniciar el servicio.",
  },
  {
    id: "sin_devolucion_adelanto",
    titulo: "Sin devolución de adelanto",
    texto: "No se realizan devoluciones del adelanto una vez iniciada la fabricación.",
  },
  {
    id: "garantia_30_dias",
    titulo: "Garantía 30 días",
    texto:
      "Garantía de 30 días contra defectos de fabricación, no cubre mal uso ni daños por humedad.",
  },
];

export function plantillaPorId(id: string): PlantillaNota | undefined {
  return plantillasNotas.find((p) => p.id === id);
}

/** Resuelve los placeholders y devuelve el texto final listo para guardar. */
export function renderPlantilla(p: PlantillaNota, valores: Record<string, string>): string {
  if (!p.campo) return p.texto;
  const valor = valores[p.campo.nombre] ?? p.campo.defaultValue ?? "";
  return p.texto.replace(`{${p.campo.nombre}}`, valor);
}
