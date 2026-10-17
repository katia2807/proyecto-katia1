import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  demoCreateCotizacionUnificada: vi.fn(),
  demoGetCotizacionUnificada: vi.fn(),
  demoUpdateCotizacionUnificada: vi.fn(),
  getEmpresaConfig: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  hasSupabaseEnv: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
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
vi.mock('@/lib/store-persistence', () => ({ readStoreFromDisk: () => null, writeStoreToDisk: vi.fn() }));
vi.mock('@/lib/demo-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/demo-store')>();
  return {
    ...actual,
    demoCreateCotizacionUnificada: mocks.demoCreateCotizacionUnificada,
    demoGetCotizacionUnificada: mocks.demoGetCotizacionUnificada,
    demoUpdateCotizacionUnificada: mocks.demoUpdateCotizacionUnificada,
    demoClientesRows: () => [{ id: '11111111-1111-4111-8111-111111111111', organization_id: '00000000-0000-0000-0000-000000000001' }],
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
    submissionId: crypto.randomUUID(),
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
    mocks.requireAuthContext.mockResolvedValue({ role: 'owner_admin', uiRole: 'owner_admin', organizationId: '00000000-0000-0000-0000-000000000001', userId: '10000000-0000-4000-8000-000000000001' });
    mocks.getEmpresaConfig.mockResolvedValue({ margen_ganancia_default_pct: 30 });
    mocks.nextCorrelativo.mockResolvedValue('N°0026');
    mocks.demoCreateCotizacionUnificada.mockReturnValue({
      id: '22222222-2222-4222-8222-222222222222',
    });
    mocks.demoGetCotizacionUnificada.mockReturnValue({ id: '22222222-2222-4222-8222-222222222222' });

    const single = vi.fn().mockResolvedValue({
      data: { id: '33333333-3333-4333-8333-333333333333' },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    mocks.insert.mockReturnValue({ select });
    mocks.getSupabaseServerClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: mocks.insert }),
      rpc: mocks.rpc.mockResolvedValue({ data: '33333333-3333-4333-8333-333333333333', error: null }),
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
            precisionVersion: 2,
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
    expect(mocks.rpc).toHaveBeenCalledWith('registrar_cotizacion_unificada_segura',
      expect.objectContaining({ p_datos:
      expect.objectContaining({
        total: 312,
        detalle: expect.objectContaining({
          resumenCalculo: {
            precisionVersion: 2,
            margenPctAplicado: 30,
            subtotalBase: 240,
            margenMonto: 72,
            totalFinal: 312,
          },
        }),
      }) }),
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

  test.each(['lista_produccion', 'en_produccion', 'terminado', 'entregado'])(
    'guardar una edición conserva el estado existente: %s', async (estado) => {
      mocks.hasSupabaseEnv.mockReturnValue(false);
      mocks.demoGetCotizacionUnificada.mockReturnValue({
        estado_flujo: estado, total: 312, detalle: inputCotizacion(312).detalle,
      });
      await expect(saveCotizacionUnificada({
        ...inputCotizacion(312), id: '44444444-4444-4444-8444-444444444444',
      })).resolves.toMatchObject({ ok: true });
      expect(mocks.demoUpdateCotizacionUnificada).toHaveBeenCalledWith(
        '44444444-4444-4444-8444-444444444444',
        expect.objectContaining({ estado_flujo: estado }),
      );
    },
  );

  test('rechaza editar una cotización cobrada sin modificarla', async () => {
    mocks.hasSupabaseEnv.mockReturnValue(false);
    mocks.demoGetCotizacionUnificada.mockReturnValue({ estado_flujo: 'cobrada' });
    await expect(saveCotizacionUnificada({
      ...inputCotizacion(312), id: '44444444-4444-4444-8444-444444444444',
    })).resolves.toMatchObject({ ok: false });
    expect(mocks.demoUpdateCotizacionUnificada).not.toHaveBeenCalled();
  });

  test.each([NaN, Infinity, '', '312'])('rechaza total inválido antes de persistir: %s', async (total) => {
    mocks.hasSupabaseEnv.mockReturnValue(false);

    await expect(saveCotizacionUnificada(inputCotizacion(total))).resolves.toMatchObject({ ok: false });
    expect(mocks.demoCreateCotizacionUnificada).not.toHaveBeenCalled();
  });

  test('guarda las condiciones acordadas tanto en demo como en Supabase', async () => {
    const input = inputCotizacion(312);
    input.detalle.condiciones_pago = { metodo: 'yape', modalidad: 'adelanto_saldo', adelanto: 100, plazo: 15, plazoUnidad: 'dias' };
    mocks.hasSupabaseEnv.mockReturnValue(false);
    expect(await saveCotizacionUnificada(input)).toMatchObject({ ok: true });
    expect(mocks.demoCreateCotizacionUnificada).toHaveBeenCalledWith(expect.objectContaining({ detalle: expect.objectContaining({ condiciones_pago: input.detalle.condiciones_pago }) }));
    mocks.hasSupabaseEnv.mockReturnValue(true);
    expect(await saveCotizacionUnificada(input)).toMatchObject({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith('registrar_cotizacion_unificada_segura', expect.objectContaining({ p_datos: expect.objectContaining({ detalle: expect.objectContaining({ condiciones_pago: input.detalle.condiciones_pago }) }) }));
  });
  test.each([0, 312.01])('rechaza el adelanto %s antes de escribir', async (adelanto) => {
    mocks.hasSupabaseEnv.mockReturnValue(false);
    const input = inputCotizacion(312);
    input.detalle.condiciones_pago = { metodo: 'yape', modalidad: 'adelanto', adelanto, plazo: 15, plazoUnidad: 'dias' };
    expect(await saveCotizacionUnificada(input)).toMatchObject({ ok: false });
    expect(mocks.demoCreateCotizacionUnificada).not.toHaveBeenCalled();
  });

  test("guarda el céntimo corregido y la versión decimal en una cotización nueva",async()=>{
    mocks.hasSupabaseEnv.mockReturnValue(false);mocks.getEmpresaConfig.mockResolvedValue({margen_ganancia_default_pct:50});
    const input=inputCotizacion(30.23);input.detalle.aserradero!.precioHora=20.15;input.detalle.aserradero!.horas=1;
    expect(await saveCotizacionUnificada(input)).toMatchObject({ok:true});
    expect(mocks.demoCreateCotizacionUnificada).toHaveBeenCalledWith(expect.objectContaining({total:30.23,detalle:expect.objectContaining({resumenCalculo:expect.objectContaining({precisionVersion:2,margenMonto:10.08})})}));
  });
  test("guardar una nota no recalcula el precio de una cotización antigua",async()=>{
    mocks.hasSupabaseEnv.mockReturnValue(false);
    const input=inputCotizacion(30.22);input.detalle.aserradero!.precioHora=20.15;input.detalle.aserradero!.horas=1;
    input.detalle.resumenCalculo={subtotalBase:20.15,margenPctAplicado:50,margenMonto:10.07,totalFinal:30.22};
    mocks.demoGetCotizacionUnificada.mockReturnValue({estado_flujo:"pendiente",total:30.22,detalle:structuredClone(input.detalle)});
    input.detalle.notas_generales="Confirmar una medida por teléfono";
    expect(await saveCotizacionUnificada({...input,id:"44444444-4444-4444-8444-444444444444"})).toMatchObject({ok:true});
    expect(mocks.demoUpdateCotizacionUnificada).toHaveBeenCalledWith("44444444-4444-4444-8444-444444444444",expect.objectContaining({total:30.22,detalle:expect.objectContaining({resumenCalculo:expect.objectContaining({precisionVersion:1,margenMonto:10.07})})}));
  });
  test("rechaza subir un céntimo un precio antiguo sin cambiar su base económica",async()=>{
    mocks.hasSupabaseEnv.mockReturnValue(false);
    const input=inputCotizacion(30.23);input.detalle.aserradero!.precioHora=20.15;input.detalle.aserradero!.horas=1;
    input.detalle.resumenCalculo={subtotalBase:20.15,margenPctAplicado:50,margenMonto:10.07,totalFinal:30.22};
    mocks.demoGetCotizacionUnificada.mockReturnValue({estado_flujo:"pendiente",total:30.22,detalle:structuredClone(input.detalle)});
    expect(await saveCotizacionUnificada({...input,id:"44444444-4444-4444-8444-444444444444"})).toMatchObject({ok:false});
    expect(mocks.demoUpdateCotizacionUnificada).not.toHaveBeenCalled();
  });
  test("cambiar el precio de la base recalcula de forma verificable y guarda precisión nueva",async()=>{
    mocks.hasSupabaseEnv.mockReturnValue(false);
    const input=inputCotizacion(30.24);input.detalle.aserradero!.precioHora=20.15;input.detalle.aserradero!.horas=1;
    input.detalle.resumenCalculo={subtotalBase:20.15,margenPctAplicado:50,margenMonto:10.07,totalFinal:30.22};
    mocks.demoGetCotizacionUnificada.mockReturnValue({estado_flujo:"pendiente",total:30.22,detalle:structuredClone(input.detalle)});
    input.detalle.aserradero!.precioHora=20.16;
    expect(await saveCotizacionUnificada({...input,id:"44444444-4444-4444-8444-444444444444"})).toMatchObject({ok:true});
    expect(mocks.demoUpdateCotizacionUnificada).toHaveBeenCalledWith("44444444-4444-4444-8444-444444444444",expect.objectContaining({total:30.24,detalle:expect.objectContaining({resumenCalculo:expect.objectContaining({precisionVersion:2,margenMonto:10.08})})}));
  });
});
