import { z } from "zod";
import { cajaFechaValida, parseCajaMonto } from "@/lib/caja-movimiento";

export const cajaMovimientoSchema = z.object({
  movimientoId: z.preprocess(value => value === null ? undefined : value,
    z.string().uuid("No se pudo identificar el envío. Cierra el formulario y vuelve a abrirlo.").transform(value => value.toLowerCase()).optional()),
  fecha: z.string({ error: "Elige una fecha válida para el movimiento." }).refine(cajaFechaValida, "Elige una fecha válida para el movimiento."),
  tipo: z.enum(["ingreso", "egreso", "transferencia"], { error: "Elige el tipo de movimiento." }),
  medio: z.enum(["efectivo", "banco", "yape", "otro"], { error: "Elige el medio de pago." }),
  categoria: z.string({ error: "Escribe la categoría del movimiento." }).trim().min(2, "Escribe una categoría de al menos 2 caracteres."),
  monto: z.preprocess(value => parseCajaMonto(value), z.number({ error: "Escribe un monto válido, mayor que cero y con hasta 2 decimales." })),
  descripcion: z.preprocess(value => value ?? "", z.string().trim()),
  esPersonal: z.preprocess(value => {
    if (value === null || value === undefined || value === "" || value === false || value === "false") return false;
    if (value === true || value === "true" || value === "on") return true;
    return value;
  }, z.boolean({ error: "Elige si el movimiento corresponde a Empresa o Personal." })),
  urlComprobante: z.preprocess(value => value ?? "", z.string()),
  tipoComprobante: z.enum(["factura", "boleta", "ninguno"], { error: "Elige el tipo de comprobante." }).default("ninguno"),
});
