import { z } from "zod";
import { parseDecimal, roundMoney } from "@/lib/utils";

const MONTO_DECIMAL_VALIDO =
  /^(?:[sS]\/?\.?\s*)?[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?)$/;

const costoUnitarioTextoSchema = z
  .string()
  .trim()
  .regex(MONTO_DECIMAL_VALIDO, "El costo unitario debe ser un número válido.")
  .transform((value) => parseDecimal(value));

export const inventarioCostoUnitarioOpcionalSchema = z
  .preprocess(
    (value) =>
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
        ? undefined
        : value,
    z
      .union([z.number(), costoUnitarioTextoSchema])
      .pipe(z.number().nonnegative())
      .optional(),
  )
  .transform((value) => (value === undefined ? undefined : roundMoney(value)));
