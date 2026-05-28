import { clsx, type ClassValue } from "clsx";
import { z } from "zod";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const roundMoney = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const safeDivide = (a: number, b: number): number => {
  if (b === 0) return 0;
  return roundMoney(a / b);
};

export function formatPen(value: number | null | undefined): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const rounded = roundMoney(safe);
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function formatDate(date: string | null | undefined) {
  const raw = date?.trim() ?? "";
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return raw;
  }
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function parseDecimal(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  
  let str = String(value).trim();
  // Remove currency symbols, spaces, and common formatting text like S/ or s/
  str = str.replace(/[sS]\/?\.?\s*/g, ""); // removes S/, s/, S., s., S, s and following spaces
  str = str.replace(/[^\d.,-]/g, "");      // keeps only digits, dots, commas and minus sign
  
  if (!str) return 0;
  
  const hasComma = str.includes(",");
  const hasDot = str.includes(".");
  
  if (hasComma && hasDot) {
    const commaIndex = str.lastIndexOf(",");
    const dotIndex = str.lastIndexOf(".");
    if (commaIndex > dotIndex) {
      // Comma is closer to the end, so dot is thousands and comma is decimal
      str = str.replace(/\./g, "").replace(/,/g, ".");
    } else {
      // Dot is closer to the end, so comma is thousands and dot is decimal
      str = str.replace(/,/g, "");
    }
  } else if (hasComma) {
    const commas = (str.match(/,/g) || []).length;
    if (commas === 1) {
      // Single comma is decimal
      str = str.replace(/,/g, ".");
    } else {
      // Multiple commas are thousands
      str = str.replace(/,/g, "");
    }
  } else if (hasDot) {
    const dots = (str.match(/\./g) || []).length;
    if (dots > 1) {
      // Multiple dots are thousands
      str = str.replace(/\./g, "");
    }
  }
  
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDecimalOptional(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const str = String(value).trim();
  if (!str) return undefined;
  const parsed = parseDecimal(str);
  return parsed;
}

export function preprocessDecimal(label: string, isOptional: boolean = false) {
  return z.preprocess((val) => {
    if (val === null || val === undefined || val === "") {
      return isOptional ? undefined : 0;
    }
    return parseDecimal(val as any);
  }, isOptional ? z.number().min(0).optional() : z.number().min(0, { message: `El campo ${label} debe ser mayor o igual a 0.` }));
}

export function decimalSchema(label: string, options?: { optional?: boolean; min?: number }) {
  const minVal = options?.min ?? 0;
  
  const baseSchema = z.custom<number>((val) => {
    return typeof val === "number" && !Number.isNaN(val);
  }, {
    message: `El campo ${label} debe ser un número válido.`
  }).refine((val) => val >= minVal, {
    message: `El campo ${label} debe ser mayor o igual a ${minVal}.`
  });

  return z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === "") {
        return undefined;
      }
      return parseDecimal(val as any);
    },
    options?.optional
      ? baseSchema.optional()
      : z.custom<number>((val) => val !== undefined, {
          message: `El campo ${label} es requerido.`
        }).pipe(baseSchema)
  );
}
