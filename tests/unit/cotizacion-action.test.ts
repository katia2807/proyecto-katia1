import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  demoCreateCotizacionUnificada: vi.fn(),
  demoGetCotizacionUnificada: vi.fn(),
  demoUpdateCotizacionUnificada: vi.fn(),
  getEmpresaConfig: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  hasSupabaseEnv: vi.fn(),
  insert: vi.fn(),
  nextCorrelativo: vi.fn(),
  requireAuthContext: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireAuthContext: mocks.requireAuthContext }));
vi.mock('@/lib/runtime', () => ({ hasSupabaseEnv: mocks.hasSupabaseEnv }));
vi.mock('@/lib/numeracion', () => ({ nextCorrelativo: mocks.nextCorrelativo }));
vi.mock('@/lib/company-config', () => ({ getEmpresaConfig: mocks.getEmpresaConfig }));
vi.mock('@/lib/supabase/server', () => ({ getSupabaseServerClient: mocks.getSupabaseServerClient }));
vi.mock('@/lib/demo-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/demo-store')>();
  return {
    ...actual,
    demoCreateCotizacionUnificada: mocks.demoCreateCotizacionUnificada,
    demoGetCotizacionUnificada: mocks.demoGetCotizacionUnificada,
    demoUpdateCotizacionUnificada: mocks.demoUpdateCotizacionUnificada,
  };
});

import { saveCotizacionUnificada } from '@/app/actions';
import { defaultCotizacionDetalleV1 } from '@/lib/cotizacion-unificada-payload';

function inputCotizacion(total: unknown) {
  const detalle = defaultCotizacionDetalleV1();
  detalle.rubros.aserradero = true;
  detalle.aserradero = {
    modo: 'hora' as const,
    precioHora: 120,
    horas: 2,
    montoTotalFijo: 0,
    descripcion: 'Servicio E2E',
  };
  return {
    clienteId: '11111111-1111-4111-8111-111111111111',
    tipoCliente: 'empresa' as const,
    fecha: '2026-07-24',
    detalle,
    total,
    estadoFlujo: 'pendiente' as const,
  };
}

describe('saveCotizacionUnificada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthContext.mockResolvedValue(undefined);
    mocks.getEmpresaConfig.mockResolvedValue({ margen_ganancia_default_pct: 30 });
    mocks.nextCorrelativo.mockResolvedValue('N°0026');
    mocks.demoCreateCotizacionUnificada.mockReturnValue({
      id: '22222222-2222-4222-8222-222222222222',
    });

    const single = vi.fn().mockResolvedValue({
      data: { id: '33333333-3333-4333-8333-333333333333' },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    mocks.insert.mockReturnValue({ select });
    mocks.getSupabaseServerClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: mocks.insert }),
    });
  });

  test('demo persiste el total calculado por servidor y la instantánea', async () => {
    mocks.hasSupabaseEnv.mockReturnValue(false);

    await expect(saveCotizacionUnificada(inputCotizacion(312))).resolves.toEqual({
      ok: true,
      id: '22222222-2222-4222-8222-222222222222',
    });
    expect(mocks.demoCreateCotizacionUnificada).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 312,
        detalle: expect.objectContaining({
          resumenCalculo: {
            margenPctAplicado: 30,
            subtotalBase: 240,
            margenMonto: 72,
            totalFinal: 312,
          },
        }),
      }),
    );
  });

  test('Supabase recibe el mismo total calculado e instantánea que demo', async () => {
    mocks.hasSupabaseEnv.mockReturnValue(true);

    await expect(saveCotizacionUnificada(inputCotizacion(312))).resolves.toEqual({
      ok: true,
      id: '33333333-3333-4333-8333-333333333333',
    });
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 312,
        detalle: expect.objectContaining({
          resumenCalculo: {
            margenPctAplicado: 30,
            subtotalBase: 240,
            margenMonto: 72,
            totalFinal: 312,
          },
        }),
      }),
    );
  });

  test('una edición conserva el margen persistido aunque cambie la configuración global', async () => {
    mocks.hasSupabaseEnv.mockReturnValue(false);
    mocks.getEmpresaConfig.mockResolvedValue({ margen_ganancia_default_pct: 80 });
    const detalleAnterior = inputCotizacion(312).detalle;
    detalleAnterior.resumenCalculo = {
      margenPctAplicado: 30,
      subtotalBase: 240,
      margenMonto: 72,
      totalFinal: 312,
    };
    mocks.demoGetCotizacionUnificada.mockReturnValue({
      estado_flujo: 'pendiente',
      total: 312,
      detalle: detalleAnterior,
    });

    await expect(saveCotizacionUnificada({
      ...inputCotizacion(312),
      id: '44444444-4444-4444-8444-444444444444',
      detalle: detalleAnterior,
    })).resolves.toEqual({
      ok: true,
      id: '44444444-4444-4444-8444-444444444444',
    });
    expect(mocks.demoUpdateCotizacionUnificada).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444',
      expect.objectContaining({ total: 312 }),
    );
  });

  test('rechaza una diferencia de S/0.01 antes de persistir', async () => {
    mocks.hasSupabaseEnv.mockReturnValue(false);

    await expect(saveCotizacionUnificada(inputCotizacion(312.01))).resolves.toEqual({
      ok: false,
      error: 'El total no coincide con el detalle. Revisa los importes.',
    });
    expect(mocks.demoCreateCotizacionUnificada).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  test.each([NaN, Infinity, '', '312'])('rechaza total inválido antes de persistir: %s', async (total) => {
    mocks.hasSupabaseEnv.mockReturnValue(false);

    await expect(saveCotizacionUnificada(inputCotizacion(total))).resolves.toMatchObject({ ok: false });
    expect(mocks.demoCreateCotizacionUnificada).not.toHaveBeenCalled();
  });
});
