import { describe, expect, test } from 'vitest';
import {
  calcularContratoCotizacion,
  crearInstantaneaCalculoCotizacion,
  parseMargenGananciaInput,
  resolverCalculoDocumentoCotizacion,
  totalClienteCoincideConServidor,
} from '@/lib/cotizacion-calculos';
import { buildLineasResumen } from '@/lib/cotizacion-unificada-lineas';
import {
  cotizacionDetalleV1Schema,
  defaultCotizacionDetalleV1,
  type CotizacionDetalleV1,
} from '@/lib/cotizacion-unificada-payload';

function detalleAserradero(precioHora = 120, horas = 2): CotizacionDetalleV1 {
  const detalle = defaultCotizacionDetalleV1();
  detalle.rubros.aserradero = true;
  detalle.aserradero = {
    modo: 'hora',
    precioHora,
    horas,
    montoTotalFijo: 0,
    descripcion: 'Servicio de prueba',
  };
  return detalle;
}

describe('contrato autoritativo de cotización', () => {
  test.each([
    { margen: 0, margenMonto: 0, total: 240 },
    { margen: 30, margenMonto: 72, total: 312 },
    { margen: 12.5, margenMonto: 30, total: 270 },
  ])('calcula S/240 con margen $margen%', ({ margen, margenMonto, total }) => {
    expect(calcularContratoCotizacion(detalleAserradero(), margen)).toEqual({
      subtotalBase: 240,
      margenPctAplicado: margen,
      margenMonto,
      precioSugerido: total,
      totalFinal: total,
    });
  });

  test('suma varias líneas antes de aplicar el margen una sola vez', () => {
    const detalle = detalleAserradero();
    detalle.rubros.muebles = true;
    detalle.muebles_lineas = [{
      id: 'madera-1',
      inventario_producto_id: null,
      especie_label: 'Madera',
      precioPorPt: 10,
      piezas: [{ id: 'pieza-1', cantidad: 2, espesor: 2, ancho: 6, largo: 5, descripcion: 'Pieza' }],
    }];

    expect(calcularContratoCotizacion(detalle, 30)).toMatchObject({
      subtotalBase: 340,
      margenMonto: 102,
      totalFinal: 442,
    });
  });

  test('redondea subtotal, margen y total a centavos', () => {
    expect(calcularContratoCotizacion(detalleAserradero(0.1, 3), 12.5)).toMatchObject({
      subtotalBase: 0.3,
      margenMonto: 0.04,
      totalFinal: 0.34,
    });
  });

  test('admite decimal con coma mediante el parser existente', () => {
    const margen = parseMargenGananciaInput('12,5');
    expect(calcularContratoCotizacion(detalleAserradero(), margen).totalFinal).toBe(270);
  });

  test('rechaza margen negativo o no finito', () => {
    expect(() => calcularContratoCotizacion(detalleAserradero(), -1)).toThrow(RangeError);
    expect(() => calcularContratoCotizacion(detalleAserradero(), Infinity)).toThrow(RangeError);
  });
});

describe('validación del total recibido', () => {
  test('acepta el total correcto y rechaza una manipulación de S/0.01', () => {
    expect(totalClienteCoincideConServidor(312, 312)).toBe(true);
    expect(totalClienteCoincideConServidor(312.01, 312)).toBe(false);
  });

  test.each([NaN, Infinity, '', '312', null, undefined])('rechaza total inválido: %s', (total) => {
    expect(totalClienteCoincideConServidor(total, 312)).toBe(false);
  });
});

describe('instantánea e históricos de cotización', () => {
  test('guarda y valida la instantánea de una cotización nueva', () => {
    const detalle = detalleAserradero();
    const calculo = calcularContratoCotizacion(detalle, 30);
    detalle.resumenCalculo = crearInstantaneaCalculoCotizacion(calculo);

    const normalizado = cotizacionDetalleV1Schema.parse(detalle);
    expect(normalizado.resumenCalculo).toEqual({
      margenPctAplicado: 30,
      subtotalBase: 240,
      margenMonto: 72,
      totalFinal: 312,
    });
    expect(resolverCalculoDocumentoCotizacion(normalizado, 312)).toMatchObject({
      totalFinal: 312,
      margenPctAplicado: 30,
      usaInstantanea: true,
    });
  });

  test('un histórico sin instantánea conserva el total guardado', () => {
    expect(resolverCalculoDocumentoCotizacion(detalleAserradero(), 240)).toMatchObject({
      totalFinal: 240,
      margenPctAplicado: 0,
      usaInstantanea: false,
    });
  });

  test('un histórico ambiguo conserva el total y omite el margen', () => {
    expect(resolverCalculoDocumentoCotizacion(detalleAserradero(), 200)).toMatchObject({
      totalFinal: 200,
      margenPctAplicado: null,
      margenMonto: null,
    });
  });

  test('el total histórico no cambia por un margen global posterior', () => {
    const detalle = detalleAserradero();
    detalle.resumenCalculo = crearInstantaneaCalculoCotizacion(
      calcularContratoCotizacion(detalle, 30),
    );
    expect(calcularContratoCotizacion(detalle, 80).totalFinal).toBe(432);
    expect(resolverCalculoDocumentoCotizacion(detalle, 312).totalFinal).toBe(312);
  });

  test('las líneas reconciliadas suman exactamente el total final', () => {
    const detalle = detalleAserradero(0.1, 3);
    const calculo = calcularContratoCotizacion(detalle, 12.5);
    const lineas = buildLineasResumen(detalle, calculo.margenPctAplicado, calculo.totalFinal);
    expect(lineas.reduce((total, linea) => total + linea.precioTotal, 0)).toBe(0.34);
  });
});
