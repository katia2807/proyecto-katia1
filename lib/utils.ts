import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPen(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
