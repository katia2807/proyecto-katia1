import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPen(value: number | null | undefined) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(safe);
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
