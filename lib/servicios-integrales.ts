import { createHash } from 'node:crypto';
import { hasSupabaseEnv } from '@/lib/runtime';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { mensajeOperacionFinanciera } from '@/lib/ventas-pago';

type Fila = Record<string, unknown>;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}

export async function registrarServicioIntegral(actor: { userId: string; organizationId: string }, input: {
  tipo: 'aserradero' | 'alquiler'; clave: string; documento: Fila; caja: Fila | null; provisional?: boolean;
}): Promise<string> {
  const { tipo, clave, documento, caja, provisional = false } = input;
  if (hasSupabaseEnv()) {
    const { data, error } = await getSupabaseServerClient().rpc('registrar_servicio_integral', {
      p_org: actor.organizationId, p_actor: actor.userId, p_tipo: tipo, p_clave: clave,
      p_documento: documento, p_caja: caja, p_provisional: provisional,
    });
    if (error) throw new Error(mensajeOperacionFinanciera(error));
    if (typeof data !== 'string') throw new Error('No se pudo confirmar el registro. Reintenta sin cerrar el formulario.');
    return data;
  }
  const d = await import('@/lib/demo-store');
  const firma = createHash('sha256').update(JSON.stringify(canonical({ documento: Object.fromEntries(Object.entries(documento).filter(([k]) => !['correlativo', 'codigo'].includes(k))), caja, provisional }))).digest('hex');
  return d.demoEjecutarSolicitud(clave, actor.organizationId, tipo, firma, () => {
    d.demoComprobarPeriodoAbierto(actor.organizationId, String(documento.fecha ?? documento.fecha_inicio));
    const clienteId = provisional ? d.demoCreateCliente({ organization_id: actor.organizationId, nombre: 'Cliente pendiente',
      documento: 'PEND-' + clave, telefono: null, ruc: null, direccion: null, tipo_persona: null }) : String(documento.cliente_id);
    if (!d.demoClientesRows().some(c => c.id === clienteId && c.organization_id === actor.organizationId)) throw new Error('Cliente no encontrado en esta empresa.');
    const row = { ...documento, cliente_id: clienteId, organization_id: actor.organizationId, confirmaIngreso: false };
    const id = tipo === 'aserradero' ? d.demoCreateServicioAserradero(row as Parameters<typeof d.demoCreateServicioAserradero>[0]).id
      : d.demoCreateContratoAlquiler(row as Parameters<typeof d.demoCreateContratoAlquiler>[0]).id;
    if (caja) d.demoCreateCaja({ ...caja, organization_id: actor.organizationId, referencia_id: id,
      modulo_origen: tipo === 'aserradero' ? 'ventas_aserradero' : 'ventas_alquiler' } as Parameters<typeof d.demoCreateCaja>[0]);
    return id;
  });
}
