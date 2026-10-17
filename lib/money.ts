import Decimal from "decimal.js";

// Constructor privado: no cambia la configuración decimal de otras dependencias.
const MoneyDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export function roundMoney(value: number): number {
  const result = new MoneyDecimal(value).toDecimalPlaces(2).toNumber();
  return result === 0 ? 0 : result;
}
export function sumMoney(values: readonly number[]): number {
  return new MoneyDecimal(values.reduce((sum, value) => sum.plus(value), new MoneyDecimal(0))).toDecimalPlaces(2).toNumber();
}
/** Producto/cociente decimal, sin redondear cantidades o precios intermedios. */
export function productMoney(values: readonly number[], divisor = 1): number {
  return values.reduce((total,value) => total.times(value), new MoneyDecimal(1)).div(divisor).toDecimalPlaces(2).toNumber();
}
/** Exclusivo de reconstrucciones históricas: conserva el criterio anterior. */
export function roundLegacyMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
export { MoneyDecimal };
